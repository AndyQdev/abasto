package bo.abasto.pedidos.aplicacion.puertos.salida;

/** Inbox: recuerda qué mensajes ya se aplicaron. Devuelve false si el mensaje ya se había visto. */
public interface MensajesProcesados {

    boolean registrarSiEsNuevo(String mensajeId);
}
