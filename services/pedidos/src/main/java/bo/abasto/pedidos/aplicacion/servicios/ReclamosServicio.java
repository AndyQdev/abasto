package bo.abasto.pedidos.aplicacion.servicios;

import bo.abasto.pedidos.aplicacion.puertos.entrada.AtenderReclamos;
import bo.abasto.pedidos.aplicacion.puertos.salida.Outbox;
import bo.abasto.pedidos.aplicacion.puertos.salida.PedidoRepositorio;
import bo.abasto.pedidos.aplicacion.puertos.salida.ReclamoRepositorio;
import bo.abasto.pedidos.dominio.Dinero;
import bo.abasto.pedidos.dominio.ErrorDeDominio;
import bo.abasto.pedidos.dominio.Mensaje;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.Reclamo;
import java.time.Clock;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * CU-16. Decisión de Andrés (06/11): la tienda reporta, Abasto resuelve a mano y el sistema solo anota la devolución.
 * Por eso aquí no hay saga ni compensación: no se toca el cobro, el crédito ni la cuenta por cobrar.
 */
public class ReclamosServicio implements AtenderReclamos {

    private final ReclamoRepositorio reclamos;
    private final PedidoRepositorio pedidos;
    private final Outbox outbox;
    private final Clock reloj;

    public ReclamosServicio(ReclamoRepositorio reclamos, PedidoRepositorio pedidos, Outbox outbox, Clock reloj) {
        this.reclamos = reclamos;
        this.pedidos = pedidos;
        this.outbox = outbox;
        this.reloj = reloj;
    }

    @Override
    public Reclamo abrir(UUID pedidoId, String tiendaId, Reclamo.Motivo motivo, String detalle) {
        // Un pedido ajeno se responde igual que uno que no existe: no se dice que existe
        var pedido = pedidos.porId(pedidoId)
                .filter(p -> p.tiendaId().equals(tiendaId))
                .orElseThrow(() -> new ErrorDeDominio("PEDIDO_NO_EXISTE", "No encontramos ese pedido entre tus compras"));
        var existente = reclamos.porPedido(pedidoId);
        if (existente.isPresent()) {
            return existente.get();
        }
        var reclamo = Reclamo.abrir(UUID.randomUUID(), pedido, motivo, detalle, reloj.instant());
        reclamos.guardar(reclamo);
        publicar("pedido.reclamo_abierto", pedido, reclamo);
        return reclamo;
    }

    @Override
    public Reclamo resolver(Resolucion r) {
        var reclamo = reclamos.porId(r.reclamoId())
                .orElseThrow(() -> new ErrorDeDominio("RECLAMO_NO_EXISTE", "Ese reclamo no existe"));
        var pedido = pedidos.porId(reclamo.pedidoId())
                .orElseThrow(() -> new ErrorDeDominio("PEDIDO_NO_EXISTE", "El pedido de este reclamo ya no existe"));
        if (r.aprobado()) {
            var devuelto = new Dinero(r.devueltoCentavos() == null ? 0 : r.devueltoCentavos());
            reclamo.aprobar(devuelto, r.forma(), r.respuesta(), pedido.total(), r.quien(), reloj.instant());
        } else {
            reclamo.rechazar(r.respuesta(), r.quien(), reloj.instant());
        }
        reclamos.guardar(reclamo);
        publicar("pedido.reclamo_resuelto", pedido, reclamo);
        return reclamo;
    }

    @Override
    public List<Reclamo> listar(Reclamo.Estado estado) {
        return reclamos.listar(estado);
    }

    @Override
    public Map<UUID, Reclamo> dePedidos(Collection<UUID> pedidoIds) {
        return reclamos.dePedidos(pedidoIds).stream().collect(Collectors.toMap(Reclamo::pedidoId, Function.identity()));
    }

    @Override
    public Optional<Pedido> pedido(UUID pedidoId) {
        return pedidos.porId(pedidoId);
    }

    /** Conecta le avisa a la app en tiempo real y al e-commerce por webhook; Asistente lo ignora. */
    private void publicar(String tipo, Pedido pedido, Reclamo reclamo) {
        var datos = new HashMap<>(pedido.datosDelEvento());
        datos.put("reclamoId", reclamo.id().toString());
        datos.put("motivo", reclamo.motivo().name());
        datos.put("estadoDelReclamo", reclamo.estado().name());
        if (reclamo.devuelto() != null) {
            datos.put("devueltoCentavos", reclamo.devuelto().centavos());
        }
        outbox.agregar(List.of(Mensaje.evento(tipo, Map.copyOf(datos))), pedido.id(), pedido.mayoristaId());
    }
}
