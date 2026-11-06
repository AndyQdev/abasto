package bo.abasto.pedidos.dominio;

import java.time.Instant;
import java.util.UUID;

/**
 * CU-16: la tienda reporta un problema con su pedido y Abasto lo resuelve a mano.
 * Resolver solo anota lo que se hizo: la devolución la hace una persona, afuera del sistema.
 */
public class Reclamo {

    public enum Motivo { INCOMPLETO, DANADO, NO_LLEGO, COBRO_EQUIVOCADO, OTRO }

    public enum Estado { ABIERTO, APROBADO, RECHAZADO }

    public enum FormaDeDevolucion { EFECTIVO, TRANSFERENCIA, QR, OTRA }

    private static final int MAXIMO_DE_TEXTO = 500;

    private final UUID id;
    private final UUID pedidoId;
    private final String tiendaId;
    private final String mayoristaId;
    private final Motivo motivo;
    private final String detalle;
    private final Instant creadoEn;
    private Estado estado;
    private String respuesta;
    private Dinero devuelto;
    private FormaDeDevolucion forma;
    private String resueltoPor;
    private Instant resueltoEn;

    private Reclamo(UUID id, UUID pedidoId, String tiendaId, String mayoristaId, Motivo motivo, String detalle,
                    Instant creadoEn) {
        this.id = id;
        this.pedidoId = pedidoId;
        this.tiendaId = tiendaId;
        this.mayoristaId = mayoristaId;
        this.motivo = motivo;
        this.detalle = detalle;
        this.creadoEn = creadoEn;
    }

    /** Un pedido que la saga todavía está procesando no tiene de qué reclamarse: todavía puede cambiar solo. */
    public static Reclamo abrir(UUID id, Pedido pedido, Motivo motivo, String detalle, Instant ahora) {
        if (pedido.estado() == EstadoPedido.PENDIENTE) {
            throw new ErrorDeDominio("PEDIDO_EN_PROCESO", "Tu pedido se está procesando: espera un momento");
        }
        if (motivo == null) {
            throw new ErrorDeDominio("MOTIVO_REQUERIDO", "Elige qué pasó con tu pedido");
        }
        var limpio = texto(detalle);
        if (motivo == Motivo.OTRO && limpio == null) {
            throw new ErrorDeDominio("DETALLE_REQUERIDO", "Cuéntanos qué pasó");
        }
        var reclamo = new Reclamo(id, pedido.id(), pedido.tiendaId(), pedido.mayoristaId(), motivo, limpio, ahora);
        reclamo.estado = Estado.ABIERTO;
        return reclamo;
    }

    /** Para leerlo de la base. No valida: lo que se guardó ya pasó por las reglas. */
    public static Reclamo reconstruir(UUID id, UUID pedidoId, String tiendaId, String mayoristaId, Motivo motivo,
                                      String detalle, Estado estado, String respuesta, Dinero devuelto,
                                      FormaDeDevolucion forma, String resueltoPor, Instant creadoEn, Instant resueltoEn) {
        var reclamo = new Reclamo(id, pedidoId, tiendaId, mayoristaId, motivo, detalle, creadoEn);
        reclamo.estado = estado;
        reclamo.respuesta = respuesta;
        reclamo.devuelto = devuelto;
        reclamo.forma = forma;
        reclamo.resueltoPor = resueltoPor;
        reclamo.resueltoEn = resueltoEn;
        return reclamo;
    }

    /**
     * Abasto le da la razón. Puede devolver todo, una parte o nada (por ejemplo, si repuso el producto).
     * Lo devuelto nunca pasa el total del pedido.
     */
    public void aprobar(Dinero devuelto, FormaDeDevolucion forma, String respuesta, Dinero totalDelPedido, String quien, Instant ahora) {
        exigirAbierto();
        if (devuelto.centavos() < 0) {
            throw new ErrorDeDominio("MONTO_INVALIDO", "El monto devuelto no puede ser negativo");
        }
        if (devuelto.centavos() > totalDelPedido.centavos()) {
            throw new ErrorDeDominio("DEVUELTO_MAYOR_QUE_EL_TOTAL", "El pedido fue de " + totalDelPedido.texto() + ": no se puede anotar una devolución de " + devuelto.texto());
        }
        if (devuelto.centavos() > 0 && forma == null) {
            throw new ErrorDeDominio("FORMA_REQUERIDA", "Elige cómo se devolvió el dinero");
        }
        cerrar(Estado.APROBADO, respuesta, quien, ahora);
        this.devuelto = devuelto;
        this.forma = devuelto.centavos() > 0 ? forma : null;
    }

    public void rechazar(String respuesta, String quien, Instant ahora) {
        exigirAbierto();
        cerrar(Estado.RECHAZADO, respuesta, quien, ahora);
    }

    private void exigirAbierto() {
        if (estado != Estado.ABIERTO) {
            throw new ErrorDeDominio("RECLAMO_YA_RESUELTO", "Este reclamo ya se resolvió");
        }
    }

    /** La tienda siempre lee por qué se decidió así. */
    private void cerrar(Estado nuevo, String texto, String quien, Instant ahora) {
        var limpio = texto(texto);
        if (limpio == null) {
            throw new ErrorDeDominio("RESPUESTA_REQUERIDA", "Escribe qué se le responde a la tienda");
        }
        this.estado = nuevo;
        this.respuesta = limpio;
        this.resueltoPor = quien;
        this.resueltoEn = ahora;
    }

    private static String texto(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        var limpio = valor.trim();
        return limpio.length() > MAXIMO_DE_TEXTO ? limpio.substring(0, MAXIMO_DE_TEXTO) : limpio;
    }

    public UUID id() { return id; }
    public UUID pedidoId() { return pedidoId; }
    public String tiendaId() { return tiendaId; }
    public String mayoristaId() { return mayoristaId; }
    public Motivo motivo() { return motivo; }
    public String detalle() { return detalle; }
    public Estado estado() { return estado; }
    public String respuesta() { return respuesta; }
    public Dinero devuelto() { return devuelto; }
    public FormaDeDevolucion forma() { return forma; }
    public String resueltoPor() { return resueltoPor; }
    public Instant creadoEn() { return creadoEn; }
    public Instant resueltoEn() { return resueltoEn; }
}
