package bo.abasto.pedidos.aplicacion.puertos.entrada;

import bo.abasto.pedidos.dominio.EstadoPedido;
import bo.abasto.pedidos.dominio.Pedido;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConsultarPedidos {

    List<Pedido> compras(String tiendaId, EstadoPedido estado);

    List<Pedido> ventas(String mayoristaId, EstadoPedido estado);

    /** Solo lo ven la tienda que compró y el mayorista que vende. */
    Optional<Pedido> uno(UUID id, String orgId);

    /** Para resolver la entidad Pedido desde el Router (otros subgrafos). */
    Optional<Pedido> porId(UUID id);
}
