package bo.abasto.pedidos.adaptadores.salida.persistencia;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Forma del pedido en la base. Solo la conoce este adaptador; el dominio no sabe que existe JPA. */
@Entity
@Table(name = "pedidos")
public class PedidoEntidad {

    @Id
    UUID id;
    String codigo;
    UUID clave;
    @Column(name = "tienda_id")
    String tiendaId;
    @Column(name = "mayorista_id")
    String mayoristaId;
    @Column(name = "metodo_pago")
    String metodoPago;
    String estado;
    @Column(name = "motivo_rechazo")
    String motivoRechazo;
    @Column(name = "creado_en")
    Instant creadoEn;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "lineas_de_pedido", joinColumns = @JoinColumn(name = "pedido_id"))
    @OrderColumn(name = "posicion")
    List<Linea> lineas = new ArrayList<>();

    @Embeddable
    public static class Linea {
        @Column(name = "producto_id")
        String productoId;
        String presentacion;
        int cantidad;
        int unidades;
        @Column(name = "precio_unitario_centavos")
        Long precioUnitarioCentavos;
    }
}
