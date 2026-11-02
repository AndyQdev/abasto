package bo.abasto.pedidos.dominio;

/**
 * Objeto de valor: a dónde lleva el mayorista el pedido. La elige la tienda en el mapa de la app.
 * Es opcional en el pedido (los que llegan del e-commerce o de n8n pueden no traerla), pero si viene,
 * la calle no puede estar vacía y el punto del mapa tiene que ser válido o no estar.
 */
public record DireccionDeEntrega(String calle, String zona, String referencia, Double latitud, Double longitud) {

    public DireccionDeEntrega {
        calle = calle == null ? "" : calle.trim();
        zona = zona == null ? "" : zona.trim();
        referencia = referencia == null ? "" : referencia.trim();
        if (calle.isEmpty()) {
            throw new ErrorDeDominio("DIRECCION_SIN_CALLE", "La dirección de entrega tiene que tener la calle");
        }
        if (calle.length() > 200 || zona.length() > 200 || referencia.length() > 300) {
            throw new ErrorDeDominio("DIRECCION_MUY_LARGA", "La dirección de entrega es demasiado larga");
        }
        if ((latitud == null) != (longitud == null)) {
            throw new ErrorDeDominio("DIRECCION_PUNTO_INCOMPLETO", "El punto del mapa necesita latitud y longitud");
        }
        if (latitud != null && (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180)) {
            throw new ErrorDeDominio("DIRECCION_PUNTO_INVALIDO", "El punto del mapa está fuera de rango");
        }
    }

    /** «Av. Banzer 123, Equipetrol» para el Panel y los avisos. */
    public String texto() {
        return zona.isEmpty() ? calle : calle + ", " + zona;
    }

    public boolean tienePunto() {
        return latitud != null;
    }
}
