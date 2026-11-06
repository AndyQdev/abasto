package bo.abasto.pedidos.aplicacion.puertos.entrada;

import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.Reclamo;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Puerto de entrada (CU-16): la tienda reporta un problema y Abasto lo resuelve a mano. */
public interface AtenderReclamos {

    /** Solo la tienda del pedido. Repetirlo devuelve el mismo reclamo: hay uno por pedido. */
    Reclamo abrir(UUID pedidoId, String tiendaId, Reclamo.Motivo motivo, String detalle);

    /** Sin devolver dinero, `devueltoCentavos` es 0 o null. */
    record Resolucion(UUID reclamoId, boolean aprobado, Long devueltoCentavos, Reclamo.FormaDeDevolucion forma,
                      String respuesta, String quien) {}

    Reclamo resolver(Resolucion resolucion);

    /** Los del estado pedido, o todos si es null; lo más nuevo primero. */
    List<Reclamo> listar(Reclamo.Estado estado);

    Map<UUID, Reclamo> dePedidos(Collection<UUID> pedidoIds);

    Optional<Pedido> pedido(UUID pedidoId);
}
