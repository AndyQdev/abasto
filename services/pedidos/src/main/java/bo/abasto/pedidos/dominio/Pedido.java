package bo.abasto.pedidos.dominio;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Agregado raíz: un pedido mayorista de una tienda a un mayorista.
 * La clave es la que generó la bandeja offline o el e-commerce: con la misma clave nunca hay dos pedidos.
 */
public class Pedido {

    private final UUID id;
    private final String codigo;
    private final UUID clave;
    private final String tiendaId;
    private final String mayoristaId;
    private final MetodoPago metodoPago;
    private final Instant creadoEn;
    private List<LineaDePedido> lineas;
    private EstadoPedido estado;
    private String motivoRechazo;
    /** A dónde se lleva. Null en los pedidos que llegan sin dirección (e-commerce, n8n) o de antes del 31/10. */
    private final DireccionDeEntrega entrega;

    public Pedido(UUID id, String codigo, UUID clave, String tiendaId, String mayoristaId, MetodoPago metodoPago,
                  List<LineaDePedido> lineas, EstadoPedido estado, String motivoRechazo, Instant creadoEn) {
        this(id, codigo, clave, tiendaId, mayoristaId, metodoPago, lineas, estado, motivoRechazo, creadoEn, null);
    }

    public Pedido(UUID id, String codigo, UUID clave, String tiendaId, String mayoristaId, MetodoPago metodoPago,
                  List<LineaDePedido> lineas, EstadoPedido estado, String motivoRechazo, Instant creadoEn,
                  DireccionDeEntrega entrega) {
        this.entrega = entrega;
        this.id = id;
        this.codigo = codigo;
        this.clave = clave;
        this.tiendaId = tiendaId;
        this.mayoristaId = mayoristaId;
        this.metodoPago = metodoPago;
        this.lineas = List.copyOf(lineas);
        this.estado = estado;
        this.motivoRechazo = motivoRechazo;
        this.creadoEn = creadoEn;
    }

    public static Pedido nuevo(String codigo, UUID clave, String tiendaId, String mayoristaId, MetodoPago metodoPago,
                               List<LineaDePedido> lineas, Instant ahora) {
        return nuevo(codigo, clave, tiendaId, mayoristaId, metodoPago, lineas, ahora, null);
    }

    public static Pedido nuevo(String codigo, UUID clave, String tiendaId, String mayoristaId, MetodoPago metodoPago,
                               List<LineaDePedido> lineas, Instant ahora, DireccionDeEntrega entrega) {
        if (lineas == null || lineas.isEmpty()) {
            throw new ErrorDeDominio("PEDIDO_VACIO", "El pedido tiene que tener al menos un producto");
        }
        if (tiendaId.equals(mayoristaId)) {
            throw new ErrorDeDominio("PEDIDO_A_SI_MISMO", "Una empresa no puede hacerse un pedido a sí misma");
        }
        return new Pedido(UUID.randomUUID(), codigo, clave, tiendaId, mayoristaId, metodoPago, lineas,
                EstadoPedido.PENDIENTE, null, ahora, entrega);
    }

    /** Paso 2 de la saga: Catálogo reservó el stock y devolvió el precio por volumen de cada línea. */
    public void fijarPrecios(List<LineaDePedido> conPrecio) {
        if (conPrecio.size() != lineas.size()) {
            throw new ErrorDeDominio("LINEAS_DISTINTAS", "La reserva no trae las mismas líneas del pedido");
        }
        this.lineas = List.copyOf(conPrecio);
    }

    public void quedarPorConfirmar() {
        pasarA(EstadoPedido.POR_CONFIRMAR);
    }

    public void confirmar() {
        pasarA(EstadoPedido.CONFIRMADO);
    }

    public void rechazar(String motivo) {
        pasarA(EstadoPedido.RECHAZADO);
        this.motivoRechazo = motivo;
    }

    public void cancelar(String motivo) {
        pasarA(EstadoPedido.CANCELADO);
        this.motivoRechazo = motivo;
    }

    public void pasarA(EstadoPedido siguiente) {
        if (!estado.puedePasarA(siguiente)) {
            throw new ErrorDeDominio("TRANSICION_INVALIDA",
                    "El pedido " + codigo + " está " + estado + " y no puede pasar a " + siguiente);
        }
        this.estado = siguiente;
    }

    /**
     * Después de confirmar, el mayorista mueve el pedido hasta la tienda:
     * CONFIRMADO → EN_PREPARACION → DESPACHADO → ENTREGADO. Devuelve el estado nuevo.
     */
    public EstadoPedido avanzarEntrega() {
        var siguiente = switch (estado) {
            case CONFIRMADO -> EstadoPedido.EN_PREPARACION;
            case EN_PREPARACION -> EstadoPedido.DESPACHADO;
            case DESPACHADO -> EstadoPedido.ENTREGADO;
            default -> throw new ErrorDeDominio("NO_SE_PUEDE_AVANZAR",
                    "El pedido " + codigo + " está " + estado + ": solo se avanza un pedido confirmado que todavía no se entregó");
        };
        pasarA(siguiente);
        return siguiente;
    }

    /** Lo que viaja en los eventos pedido.* (contracts/asyncapi.yaml, DatosPedido). */
    public Map<String, Object> datosDelEvento() {
        return Map.of(
                "pedidoId", id.toString(),
                "codigo", codigo,
                "tiendaId", tiendaId,
                "mayoristaId", mayoristaId,
                "metodoPago", metodoPago.name().toLowerCase(),
                "totalCentavos", total().centavos());
    }

    public Dinero total() {
        return lineas.stream().map(LineaDePedido::subtotal).reduce(Dinero.CERO, Dinero::sumar);
    }

    public boolean esDe(String orgId) {
        return tiendaId.equals(orgId) || mayoristaId.equals(orgId);
    }

    public UUID id() { return id; }
    public String codigo() { return codigo; }
    public UUID clave() { return clave; }
    public String tiendaId() { return tiendaId; }
    public String mayoristaId() { return mayoristaId; }
    public MetodoPago metodoPago() { return metodoPago; }
    public Instant creadoEn() { return creadoEn; }
    public List<LineaDePedido> lineas() { return lineas; }
    public EstadoPedido estado() { return estado; }
    public String motivoRechazo() { return motivoRechazo; }
    public DireccionDeEntrega entrega() { return entrega; }
}
