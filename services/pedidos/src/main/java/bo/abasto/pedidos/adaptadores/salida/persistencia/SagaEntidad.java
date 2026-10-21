package bo.abasto.pedidos.adaptadores.salida.persistencia;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "sagas_de_compra")
public class SagaEntidad {

    @Id
    @Column(name = "pedido_id")
    UUID pedidoId;
    String paso;
    @Column(name = "stock_reservado")
    boolean stockReservado;
    boolean cobrado;
    @Column(name = "vence_confirmacion_en")
    Instant venceConfirmacionEn;
    /** Bloqueo optimista: si dos mensajes llegan a la vez, uno se reintenta en vez de pisar al otro. */
    @Version
    long version;
}
