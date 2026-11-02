package bo.abasto.pedidos.dominio;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Los eventos pedido.* llevan las líneas: con pedido.entregado, Cobros arma el inventario de «Mi negocio». */
class DatosDelEventoTest {

    @Test
    @SuppressWarnings("unchecked")
    void el_evento_lleva_cada_linea_con_sus_unidades_y_lo_pagado() {
        var harina = LineaDePedido.sinPrecio("AB-101", Presentacion.UNIDAD, 2).conPrecio(2, new Dinero(28500));
        var sal = LineaDePedido.sinPrecio("AB-007", Presentacion.DOCENA, 1).conPrecio(12, new Dinero(640));
        var pedido = new Pedido(UUID.randomUUID(), "A-0001", UUID.randomUUID(), "rosa", "abasto", MetodoPago.CONTRA_ENTREGA,
                List.of(harina, sal), EstadoPedido.ENTREGADO, null, Instant.parse("2026-11-01T12:00:00Z"));

        var datos = pedido.datosDelEvento();

        assertThat(datos).containsEntry("totalCentavos", 64680L).containsEntry("tiendaId", "rosa");
        var lineas = (List<Map<String, Object>>) datos.get("lineas");
        assertThat(lineas).containsExactly(
                Map.of("productoId", "AB-101", "presentacion", "UNIDAD", "cantidad", 2, "unidades", 2, "subtotalCentavos", 57000L),
                Map.of("productoId", "AB-007", "presentacion", "DOCENA", "cantidad", 1, "unidades", 12, "subtotalCentavos", 7680L));
    }
}
