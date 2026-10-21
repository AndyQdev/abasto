package bo.abasto.pedidos.dominio;

/** Error de una regla del negocio. Trae un código para que las apps muestren el motivo correcto. */
public class ErrorDeDominio extends RuntimeException {

    private final String codigo;

    public ErrorDeDominio(String codigo, String mensaje) {
        super(mensaje);
        this.codigo = codigo;
    }

    public String codigo() {
        return codigo;
    }
}
