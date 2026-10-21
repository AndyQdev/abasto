package bo.abasto.pedidos;

import static org.assertj.core.api.Assertions.assertThat;

import bo.abasto.pedidos.aplicacion.puertos.entrada.AvanzarSaga;
import bo.abasto.pedidos.aplicacion.puertos.entrada.CrearPedido;
import bo.abasto.pedidos.aplicacion.puertos.salida.SagaRepositorio;
import bo.abasto.pedidos.dominio.MetodoPago;
import bo.abasto.pedidos.dominio.Presentacion;
import bo.abasto.pedidos.dominio.SagaDeCompra;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** Contra PostgreSQL real (Testcontainers): migraciones, idempotencia, saga y outbox en la misma transacción. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = {
        "spring.rabbitmq.listener.simple.auto-startup=false",
        "abasto.outbox.publicar=false",
        "abasto.saga.revisar-plazos-cada=3600000"
})
class PedidosIT {

    @Autowired CrearPedido crear;
    @Autowired AvanzarSaga saga;
    @Autowired SagaRepositorio sagas;
    @Autowired TransactionTemplate transaccion;
    @Autowired JdbcTemplate jdbc;

    private CrearPedido.Comando comando(UUID clave) {
        return new CrearPedido.Comando(clave, "dr", "lp", MetodoPago.QR,
                List.of(new CrearPedido.Linea("HP-0400", Presentacion.CAJA, 2)));
    }

    private List<String> outboxDe(UUID pedidoId) {
        return jdbc.queryForList("SELECT tipo FROM outbox WHERE correlation_id = ? ORDER BY creado_en, tipo", String.class, pedidoId);
    }

    @Test
    void la_misma_clave_nunca_crea_dos_pedidos() {
        var clave = UUID.randomUUID();
        var primero = transaccion.execute(s -> crear.ejecutar(comando(clave)));
        var segundo = transaccion.execute(s -> crear.ejecutar(comando(clave)));

        assertThat(segundo.id()).isEqualTo(primero.id());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pedidos WHERE clave = ?", Long.class, clave)).isEqualTo(1L);
        assertThat(primero.codigo()).startsWith("A-");
    }

    @Test
    void el_pedido_su_saga_y_sus_mensajes_se_guardan_juntos() {
        var pedido = transaccion.execute(s -> crear.ejecutar(comando(UUID.randomUUID())));

        assertThat(sagas.porPedido(pedido.id())).get().extracting(SagaDeCompra::paso)
                .isEqualTo(SagaDeCompra.Paso.RESERVANDO_STOCK);
        assertThat(outboxDe(pedido.id())).containsExactlyInAnyOrder("pedido.creado", "catalogo.reservar_stock");
    }

    @Test
    void una_respuesta_repetida_de_catalogo_se_aplica_una_sola_vez() {
        var pedido = transaccion.execute(s -> crear.ejecutar(comando(UUID.randomUUID())));
        var respuesta = new AvanzarSaga.Respuesta("msg-" + UUID.randomUUID(), "stock.reservado", Map.of(
                "pedidoId", pedido.id().toString(),
                "lineas", List.of(Map.of("unidades", 96, "precioUnitarioCentavos", 1800))));

        transaccion.executeWithoutResult(s -> saga.alRecibir(respuesta));
        transaccion.executeWithoutResult(s -> saga.alRecibir(respuesta));

        assertThat(sagas.porPedido(pedido.id())).get().extracting(SagaDeCompra::paso)
                .isEqualTo(SagaDeCompra.Paso.COBRANDO);
        assertThat(outboxDe(pedido.id())).filteredOn("cobros.generar_qr"::equals).hasSize(1);
        assertThat(jdbc.queryForObject(
                "SELECT precio_unitario_centavos FROM lineas_de_pedido WHERE pedido_id = ?", Long.class, pedido.id()))
                .isEqualTo(1800L);
    }
}
