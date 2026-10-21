package bo.abasto.pedidos.adaptadores.entrada.mensajeria;

import bo.abasto.pedidos.aplicacion.puertos.entrada.AvanzarSaga;
import java.util.Map;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Adaptador de entrada: las respuestas de Catálogo y Cobros (cola pedidos.respuestas).
 * Si algo falla, el mensaje se reintenta; después de 5 intentos termina en pedidos.respuestas.dlq
 * y el Superadmin lo muestra en Salud.
 */
@Component
class RespuestasListener {

    private final AvanzarSaga saga;
    private final TransactionTemplate transaccion;
    private final JsonMapper json;

    RespuestasListener(AvanzarSaga saga, TransactionTemplate transaccion, JsonMapper json) {
        this.saga = saga;
        this.transaccion = transaccion;
        this.json = json;
    }

    @RabbitListener(queues = "pedidos.respuestas")
    void recibir(Message mensaje) {
        Map<String, Object> sobre = json.readValue(mensaje.getBody(), new TypeReference<>() {});
        @SuppressWarnings("unchecked")
        var datos = (Map<String, Object>) sobre.get("datos");
        var respuesta = new AvanzarSaga.Respuesta(String.valueOf(sobre.get("id")), String.valueOf(sobre.get("tipo")), datos);
        transaccion.executeWithoutResult(s -> saga.alRecibir(respuesta));
    }
}
