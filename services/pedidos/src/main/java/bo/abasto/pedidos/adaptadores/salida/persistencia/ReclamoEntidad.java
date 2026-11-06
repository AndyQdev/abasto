package bo.abasto.pedidos.adaptadores.salida.persistencia;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reclamos")
public class ReclamoEntidad {

    @Id
    UUID id;
    @Column(name = "pedido_id")
    UUID pedidoId;
    @Column(name = "tienda_id")
    String tiendaId;
    @Column(name = "mayorista_id")
    String mayoristaId;
    String motivo;
    String detalle;
    String estado;
    String respuesta;
    @Column(name = "devuelto_centavos")
    Long devueltoCentavos;
    String forma;
    @Column(name = "resuelto_por")
    String resueltoPor;
    @Column(name = "creado_en")
    Instant creadoEn;
    @Column(name = "resuelto_en")
    Instant resueltoEn;
}
