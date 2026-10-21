package bo.abasto.pedidos.aplicacion.puertos.salida;

import bo.abasto.pedidos.dominio.Mensaje;
import java.util.List;
import java.util.UUID;

/**
 * Puerto de salida: los mensajes se guardan en la misma transacción que el cambio y después
 * un proceso aparte los publica en RabbitMQ. Así nunca se cambia un pedido sin avisar ni se avisa sin cambiarlo.
 */
public interface Outbox {

    void agregar(List<Mensaje> mensajes, UUID correlationId, String orgId);
}
