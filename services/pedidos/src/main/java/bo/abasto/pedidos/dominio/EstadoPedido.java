package bo.abasto.pedidos.dominio;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/** Los estados de un pedido y a cuáles puede pasar cada uno. Todo lo demás es una transición inválida. */
public enum EstadoPedido {
    PENDIENTE,
    POR_CONFIRMAR,
    CONFIRMADO,
    EN_PREPARACION,
    DESPACHADO,
    ENTREGADO,
    RECHAZADO,
    CANCELADO;

    private static final Map<EstadoPedido, Set<EstadoPedido>> SIGUIENTES = Map.of(
            PENDIENTE, EnumSet.of(POR_CONFIRMAR, RECHAZADO, CANCELADO),
            POR_CONFIRMAR, EnumSet.of(CONFIRMADO, RECHAZADO, CANCELADO),
            CONFIRMADO, EnumSet.of(EN_PREPARACION),
            EN_PREPARACION, EnumSet.of(DESPACHADO),
            DESPACHADO, EnumSet.of(ENTREGADO),
            ENTREGADO, EnumSet.noneOf(EstadoPedido.class),
            RECHAZADO, EnumSet.noneOf(EstadoPedido.class),
            CANCELADO, EnumSet.noneOf(EstadoPedido.class));

    public boolean puedePasarA(EstadoPedido siguiente) {
        return SIGUIENTES.get(this).contains(siguiente);
    }
}
