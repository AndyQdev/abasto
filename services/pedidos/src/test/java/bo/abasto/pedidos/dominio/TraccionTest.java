package bo.abasto.pedidos.dominio;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Los números del Superadmin: solo cuentan las ventas confirmadas, por semana y por tienda. */
class TraccionTest {

    private final ZoneId bolivia = ZoneId.of("America/La_Paz");
    // Miércoles 28/10/2026: la semana empieza el lunes 26
    private final LocalDate hoy = LocalDate.of(2026, 10, 28);

    private Pedido pedido(String tienda, String dia, EstadoPedido estado, long centavos) {
        var linea = LineaDePedido.sinPrecio("AB-001", Presentacion.DOCENA, 1).conPrecio(1, new Dinero(centavos));
        var creado = LocalDate.parse(dia).atTime(10, 0).atZone(bolivia).toInstant();
        return new Pedido(UUID.randomUUID(), "A-" + dia, UUID.randomUUID(), tienda, "abasto", MetodoPago.CONTRA_ENTREGA,
                List.of(linea), estado, null, creado);
    }

    @Test
    void cuenta_ventas_por_semana_tiendas_activas_y_las_que_repiten() {
        var pedidos = List.of(
                pedido("dr", "2026-10-27", EstadoPedido.CONFIRMADO, 30000),
                pedido("dr", "2026-10-20", EstadoPedido.ENTREGADO, 10000),
                pedido("ec", "2026-10-21", EstadoPedido.DESPACHADO, 20000),
                // No son venta: rechazado y todavía sin confirmar
                pedido("am", "2026-10-26", EstadoPedido.RECHAZADO, 99900),
                pedido("dl", "2026-10-26", EstadoPedido.POR_CONFIRMAR, 99900),
                // Antes de las 3 semanas pedidas
                pedido("sj", "2026-09-01", EstadoPedido.ENTREGADO, 50000));

        var t = Traccion.de(pedidos, hoy, 3, bolivia);

        assertThat(t.pedidos()).isEqualTo(3);
        assertThat(t.ventas().centavos()).isEqualTo(60000);
        assertThat(t.ticketPromedio().centavos()).isEqualTo(20000);
        assertThat(t.tiendasActivas()).isEqualTo(2);
        assertThat(t.tiendasQueRepiten()).isEqualTo(1);
        assertThat(t.semanas()).extracting(Traccion.Semana::desde)
                .containsExactly(LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 19), LocalDate.of(2026, 10, 26));
        assertThat(t.semanas()).extracting(Traccion.Semana::pedidos).containsExactly(0, 2, 1);
        assertThat(t.semanas()).extracting(Traccion.Semana::tiendas).allSatisfy((n) -> assertThat(n).isBetween(0, 2));
        assertThat(t.tiendas()).extracting(Traccion.TiendaCompradora::tiendaId).containsExactly("dr", "ec");
    }

    @Test
    void sin_ventas_todo_en_cero() {
        var t = Traccion.de(List.of(), hoy, 8, bolivia);
        assertThat(t.pedidos()).isZero();
        assertThat(t.ticketPromedio().centavos()).isZero();
        assertThat(t.semanas()).hasSize(8);
    }
}
