package bo.abasto.pedidos.dominio;

/**
 * Una línea del pedido. El precio unitario lo fija Catálogo al reservar el stock (paso 2 de la saga)
 * y el pedido guarda una copia: si después el mayorista cambia el precio, este pedido no cambia.
 */
public record LineaDePedido(
        String productoId,
        Presentacion presentacion,
        int cantidad,
        int unidades,
        Dinero precioUnitario) {

    public LineaDePedido {
        if (cantidad <= 0) throw new ErrorDeDominio("CANTIDAD_INVALIDA", "La cantidad tiene que ser mayor a cero");
    }

    public static LineaDePedido sinPrecio(String productoId, Presentacion presentacion, int cantidad) {
        return new LineaDePedido(productoId, presentacion, cantidad, 0, null);
    }

    public LineaDePedido conPrecio(int unidades, Dinero precioUnitario) {
        return new LineaDePedido(productoId, presentacion, cantidad, unidades, precioUnitario);
    }

    public Dinero subtotal() {
        return precioUnitario == null ? Dinero.CERO : precioUnitario.por(unidades);
    }
}
