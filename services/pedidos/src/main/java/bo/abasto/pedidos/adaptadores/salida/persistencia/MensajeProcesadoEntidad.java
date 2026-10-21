package bo.abasto.pedidos.adaptadores.salida.persistencia;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Inbox: cada mensaje recibido deja su id aquí. Si ya estaba, el mensaje es repetido y se ignora. */
@Entity
@Table(name = "mensajes_procesados")
public class MensajeProcesadoEntidad {

    @Id
    String id;
    @Column(name = "procesado_en")
    Instant procesadoEn;
}
