package bo.abasto.pedidos.aplicacion.servicios;

import bo.abasto.pedidos.aplicacion.puertos.entrada.ConsultarPedidos;
import bo.abasto.pedidos.aplicacion.puertos.entrada.CrearPedido;
import bo.abasto.pedidos.aplicacion.puertos.entrada.DecidirPedido;
import bo.abasto.pedidos.aplicacion.puertos.entrada.EntregarPedido;
import bo.abasto.pedidos.aplicacion.puertos.salida.Outbox;
import bo.abasto.pedidos.aplicacion.puertos.salida.PedidoRepositorio;
import bo.abasto.pedidos.aplicacion.puertos.salida.SagaRepositorio;
import bo.abasto.pedidos.dominio.EstadoPedido;
import bo.abasto.pedidos.dominio.ErrorDeDominio;
import bo.abasto.pedidos.dominio.LineaDePedido;
import bo.abasto.pedidos.dominio.ListaDeCompras;
import bo.abasto.pedidos.dominio.Mensaje;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.SagaDeCompra;
import bo.abasto.pedidos.dominio.Traccion;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Casos de uso de pedidos. No conoce Spring: la transacción la abre el adaptador de entrada
 * y los beans se arman en configuracion/CasosDeUsoConfig.
 */
public class PedidosServicio implements CrearPedido, DecidirPedido, ConsultarPedidos, EntregarPedido {

    private final PedidoRepositorio pedidos;
    private final SagaRepositorio sagas;
    private final Outbox outbox;
    private final Clock reloj;

    public PedidosServicio(PedidoRepositorio pedidos, SagaRepositorio sagas, Outbox outbox, Clock reloj) {
        this.pedidos = pedidos;
        this.sagas = sagas;
        this.outbox = outbox;
        this.reloj = reloj;
    }

    @Override
    public Pedido ejecutar(CrearPedido.Comando comando) {
        var existente = pedidos.porClave(comando.clave());
        if (existente.isPresent()) return existente.get();

        var lineas = comando.lineas().stream()
                .map(l -> LineaDePedido.sinPrecio(l.productoId(), l.presentacion(), l.cantidad()))
                .toList();
        var pedido = Pedido.nuevo(pedidos.siguienteCodigo(), comando.clave(), comando.tiendaId(),
                comando.mayoristaId(), comando.metodoPago(), lineas, reloj.instant());
        var saga = SagaDeCompra.iniciar(pedido);

        pedidos.guardar(pedido);
        sagas.guardar(saga);
        outbox.agregar(saga.sacarMensajes(), pedido.id(), pedido.mayoristaId());
        return pedido;
    }

    @Override
    public Pedido confirmar(UUID pedidoId, String mayoristaId) {
        var pedido = delMayorista(pedidoId, mayoristaId);
        var saga = sagaDe(pedido);
        saga.alConfirmarMayorista(pedido);
        return guardar(pedido, saga);
    }

    @Override
    public Pedido rechazar(UUID pedidoId, String mayoristaId, String motivo) {
        var pedido = delMayorista(pedidoId, mayoristaId);
        var saga = sagaDe(pedido);
        saga.alRechazarMayorista(pedido, motivo);
        return guardar(pedido, saga);
    }

    @Override
    public Pedido avanzar(UUID pedidoId, String mayoristaId) {
        var pedido = delMayorista(pedidoId, mayoristaId);
        var estado = pedido.avanzarEntrega();
        pedidos.guardar(pedido);
        // pedido.en_preparacion, pedido.despachado o pedido.entregado: los proyecta Asistente y Conecta los manda por webhook
        outbox.agregar(List.of(Mensaje.evento("pedido." + estado.name().toLowerCase(), pedido.datosDelEvento())),
                pedido.id(), pedido.mayoristaId());
        return pedido;
    }

    @Override
    public List<ListaDeCompras.Linea> listaDeCompras(String mayoristaId) {
        return ListaDeCompras.de(pedidos.deMayorista(mayoristaId, null));
    }

    @Override
    public Traccion traccion(String mayoristaId, int semanas) {
        var zona = ZoneId.of("America/La_Paz");
        var hoy = LocalDate.now(reloj.withZone(zona));
        var desde = hoy.minusWeeks(semanas).atStartOfDay(zona).toInstant();
        return Traccion.de(pedidos.desde(desde, mayoristaId), hoy, semanas, zona);
    }

    @Override
    public List<Pedido> compras(String tiendaId, EstadoPedido estado) {
        return pedidos.deTienda(tiendaId, estado);
    }

    @Override
    public List<Pedido> ventas(String mayoristaId, EstadoPedido estado) {
        return pedidos.deMayorista(mayoristaId, estado);
    }

    @Override
    public Optional<Pedido> uno(UUID id, String orgId) {
        return pedidos.porId(id).filter(p -> p.esDe(orgId));
    }

    @Override
    public Optional<Pedido> porId(UUID id) {
        return pedidos.porId(id);
    }

    private Pedido delMayorista(UUID pedidoId, String mayoristaId) {
        return pedidos.porId(pedidoId)
                .filter(p -> p.mayoristaId().equals(mayoristaId))
                .orElseThrow(() -> new ErrorDeDominio("PEDIDO_NO_EXISTE", "No existe ese pedido entre tus ventas"));
    }

    private SagaDeCompra sagaDe(Pedido pedido) {
        return sagas.porPedido(pedido.id())
                .orElseThrow(() -> new ErrorDeDominio("SAGA_NO_EXISTE", "El pedido " + pedido.codigo() + " no tiene saga"));
    }

    private Pedido guardar(Pedido pedido, SagaDeCompra saga) {
        pedidos.guardar(pedido);
        sagas.guardar(saga);
        outbox.agregar(saga.sacarMensajes(), pedido.id(), pedido.mayoristaId());
        return pedido;
    }
}
