package bo.abasto.pedidos.adaptadores.salida.persistencia;

import bo.abasto.pedidos.aplicacion.puertos.salida.MensajesProcesados;
import bo.abasto.pedidos.aplicacion.puertos.salida.Outbox;
import bo.abasto.pedidos.aplicacion.puertos.salida.PedidoRepositorio;
import bo.abasto.pedidos.aplicacion.puertos.salida.SagaRepositorio;
import bo.abasto.pedidos.dominio.Dinero;
import bo.abasto.pedidos.dominio.EstadoPedido;
import bo.abasto.pedidos.dominio.LineaDePedido;
import bo.abasto.pedidos.dominio.Mensaje;
import bo.abasto.pedidos.dominio.MetodoPago;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.Presentacion;
import bo.abasto.pedidos.dominio.SagaDeCompra;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** Adaptador de salida: implementa los cuatro puertos de persistencia con JPA sobre la base `pedidos`. */
@Component
class PersistenciaAdaptador implements PedidoRepositorio, SagaRepositorio, Outbox, MensajesProcesados {

    private final PedidoJpa pedidos;
    private final SagaJpa sagas;
    private final OutboxJpa outbox;
    private final MensajeProcesadoJpa procesados;
    private final JsonMapper json;
    private final Clock reloj;

    PersistenciaAdaptador(PedidoJpa pedidos, SagaJpa sagas, OutboxJpa outbox, MensajeProcesadoJpa procesados,
                          JsonMapper json, Clock reloj) {
        this.pedidos = pedidos;
        this.sagas = sagas;
        this.outbox = outbox;
        this.procesados = procesados;
        this.json = json;
        this.reloj = reloj;
    }

    // ---------------------------------------------------------------- pedidos

    @Override
    public Optional<Pedido> porId(UUID id) {
        return pedidos.findById(id).map(PersistenciaAdaptador::aDominio);
    }

    @Override
    public Optional<Pedido> porClave(UUID clave) {
        return pedidos.findByClave(clave).map(PersistenciaAdaptador::aDominio);
    }

    @Override
    public List<Pedido> deTienda(String tiendaId, EstadoPedido estado) {
        var filas = estado == null
                ? pedidos.findByTiendaIdOrderByCreadoEnDesc(tiendaId)
                : pedidos.findByTiendaIdAndEstadoOrderByCreadoEnDesc(tiendaId, estado.name());
        return filas.stream().map(PersistenciaAdaptador::aDominio).toList();
    }

    @Override
    public List<Pedido> deMayorista(String mayoristaId, EstadoPedido estado) {
        var filas = estado == null
                ? pedidos.findByMayoristaIdOrderByCreadoEnDesc(mayoristaId)
                : pedidos.findByMayoristaIdAndEstadoOrderByCreadoEnDesc(mayoristaId, estado.name());
        return filas.stream().map(PersistenciaAdaptador::aDominio).toList();
    }

    @Override
    public List<Pedido> desde(java.time.Instant desde, String mayoristaId) {
        var filas = mayoristaId == null
                ? pedidos.findByCreadoEnGreaterThanEqual(desde)
                : pedidos.findByMayoristaIdAndCreadoEnGreaterThanEqual(mayoristaId, desde);
        return filas.stream().map(PersistenciaAdaptador::aDominio).toList();
    }

    @Override
    public void guardar(Pedido pedido) {
        var e = pedidos.findById(pedido.id()).orElseGet(PedidoEntidad::new);
        e.id = pedido.id();
        e.codigo = pedido.codigo();
        e.clave = pedido.clave();
        e.tiendaId = pedido.tiendaId();
        e.mayoristaId = pedido.mayoristaId();
        e.metodoPago = pedido.metodoPago().name();
        e.estado = pedido.estado().name();
        e.motivoRechazo = pedido.motivoRechazo();
        e.creadoEn = pedido.creadoEn();
        e.lineas.clear();
        for (var l : pedido.lineas()) {
            var fila = new PedidoEntidad.Linea();
            fila.productoId = l.productoId();
            fila.presentacion = l.presentacion().name();
            fila.cantidad = l.cantidad();
            fila.unidades = l.unidades();
            fila.precioUnitarioCentavos = l.precioUnitario() == null ? null : l.precioUnitario().centavos();
            e.lineas.add(fila);
        }
        pedidos.save(e);
    }

    @Override
    public String siguienteCodigo() {
        return "A-" + pedidos.siguienteNumero();
    }

    private static Pedido aDominio(PedidoEntidad e) {
        var lineas = e.lineas.stream()
                .map(l -> new LineaDePedido(l.productoId, Presentacion.valueOf(l.presentacion), l.cantidad, l.unidades,
                        l.precioUnitarioCentavos == null ? null : new Dinero(l.precioUnitarioCentavos)))
                .toList();
        return new Pedido(e.id, e.codigo, e.clave, e.tiendaId, e.mayoristaId, MetodoPago.valueOf(e.metodoPago),
                lineas, EstadoPedido.valueOf(e.estado), e.motivoRechazo, e.creadoEn);
    }

    // ---------------------------------------------------------------- sagas

    @Override
    public Optional<SagaDeCompra> porPedido(UUID pedidoId) {
        return sagas.findById(pedidoId).map(PersistenciaAdaptador::aDominio);
    }

    @Override
    public List<SagaDeCompra> esperandoConVencimientoAntesDe(Instant momento) {
        return sagas.findByPasoAndVenceConfirmacionEnBefore(SagaDeCompra.Paso.ESPERANDO_MAYORISTA.name(), momento)
                .stream().map(PersistenciaAdaptador::aDominio).toList();
    }

    @Override
    public void guardar(SagaDeCompra saga) {
        var e = sagas.findById(saga.pedidoId()).orElseGet(SagaEntidad::new);
        e.pedidoId = saga.pedidoId();
        e.paso = saga.paso().name();
        e.stockReservado = saga.stockReservado();
        e.cobrado = saga.cobrado();
        e.venceConfirmacionEn = saga.venceConfirmacionEn();
        sagas.save(e);
    }

    private static SagaDeCompra aDominio(SagaEntidad s) {
        return new SagaDeCompra(s.pedidoId, SagaDeCompra.Paso.valueOf(s.paso), s.stockReservado, s.cobrado,
                s.venceConfirmacionEn);
    }

    // ---------------------------------------------------------------- outbox e inbox

    @Override
    public void agregar(List<Mensaje> mensajes, UUID correlationId, String orgId) {
        for (var m : mensajes) {
            var e = new OutboxEntidad();
            e.id = UUID.randomUUID();
            e.clase = m.clase().name();
            e.tipo = m.tipo();
            e.correlationId = correlationId;
            e.orgId = orgId;
            e.datos = json.writeValueAsString(m.datos());
            e.creadoEn = reloj.instant();
            outbox.save(e);
        }
    }

    @Override
    public boolean registrarSiEsNuevo(String mensajeId) {
        return procesados.registrar(mensajeId) == 1;
    }
}
