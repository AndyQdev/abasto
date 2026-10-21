package bo.abasto.pedidos.adaptadores.salida.persistencia;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Lectura del outbox para el publicador. Va aparte del puerto Outbox porque solo lo usa infraestructura. */
@Component
public class OutboxLector {

    public record Pendiente(UUID id, String clase, String tipo, UUID correlationId, String orgId, String datos,
                            Instant creadoEn) {
        public boolean esComando() {
            return "COMANDO".equals(clase);
        }
    }

    private final OutboxJpa outbox;
    private final Clock reloj;

    OutboxLector(OutboxJpa outbox, Clock reloj) {
        this.outbox = outbox;
        this.reloj = reloj;
    }

    public List<Pendiente> pendientes() {
        return outbox.pendientes().stream()
                .map(e -> new Pendiente(e.id, e.clase, e.tipo, e.correlationId, e.orgId, e.datos, e.creadoEn))
                .toList();
    }

    public void marcarPublicado(UUID id) {
        outbox.findById(id).ifPresent(e -> {
            e.publicadoEn = reloj.instant();
            outbox.save(e);
        });
    }
}
