package bo.abasto.pedidos.adaptadores.salida.mensajeria;

import bo.abasto.pedidos.adaptadores.salida.persistencia.OutboxLector;
import java.util.LinkedHashMap;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Publica lo que quedó en el outbox. Corre cada segundo; si RabbitMQ no está, los mensajes esperan en la base
 * y salen cuando vuelve. Cada mensaje sale con el sobre que define contracts/asyncapi.yaml.
 */
@Component
@ConditionalOnProperty(name = "abasto.outbox.publicar", havingValue = "true", matchIfMissing = true)
class PublicadorOutbox {

    private final OutboxLector outbox;
    private final RabbitTemplate rabbit;
    private final JsonMapper json;

    PublicadorOutbox(OutboxLector outbox, RabbitTemplate rabbit, JsonMapper json) {
        this.outbox = outbox;
        this.rabbit = rabbit;
        this.json = json;
    }

    @Scheduled(fixedDelayString = "${abasto.outbox.cada:1000}")
    @Transactional
    public void publicar() {
        for (var pendiente : outbox.pendientes()) {
            var correlationId = pendiente.correlationId() == null ? null : pendiente.correlationId().toString();
            var sobre = new LinkedHashMap<String, Object>();
            sobre.put("id", pendiente.id().toString());
            sobre.put("tipo", pendiente.tipo());
            sobre.put("version", 1);
            sobre.put("ocurridoEn", pendiente.creadoEn().toString());
            sobre.put("correlationId", correlationId);
            sobre.put("orgId", pendiente.orgId());
            sobre.put("datos", json.readTree(pendiente.datos()));

            var mensaje = MessageBuilder.withBody(json.writeValueAsBytes(sobre))
                    .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                    .setMessageId(pendiente.id().toString())
                    .setCorrelationId(correlationId)
                    .build();
            rabbit.send(pendiente.esComando() ? "abasto.comandos" : "abasto.eventos", pendiente.tipo(), mensaje);
            outbox.marcarPublicado(pendiente.id());
        }
    }
}
