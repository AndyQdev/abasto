package bo.abasto.pedidos.adaptadores.salida.persistencia;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "outbox")
public class OutboxEntidad {

    @Id
    UUID id;
    String clase;
    String tipo;
    @Column(name = "correlation_id")
    UUID correlationId;
    @Column(name = "org_id")
    String orgId;
    @JdbcTypeCode(SqlTypes.JSON)
    String datos;
    @Column(name = "creado_en")
    Instant creadoEn;
    @Column(name = "publicado_en")
    Instant publicadoEn;
}
