package bo.abasto.pedidos.dominio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Una prueba por transición de la saga, incluidas las que no deberían pasar. */
class SagaDeCompraTest {

    private final Instant ahora = Instant.parse("2026-10-20T12:42:00Z");

    private Pedido pedido(MetodoPago metodo) {
        return Pedido.nuevo("A-1042", UUID.randomUUID(), "dr", "lp", metodo,
                List.of(LineaDePedido.sinPrecio("HP-0400", Presentacion.CAJA, 2)), ahora);
    }

    private List<LineaDePedido> conPrecio(Pedido p) {
        return List.of(p.lineas().getFirst().conPrecio(96, new Dinero(1800)));
    }

    private static List<String> tipos(SagaDeCompra saga) {
        return saga.sacarMensajes().stream().map(Mensaje::tipo).toList();
    }

    @Test
    void al_iniciar_pide_reservar_stock() {
        var saga = SagaDeCompra.iniciar(pedido(MetodoPago.QR));
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.RESERVANDO_STOCK);
        assertThat(tipos(saga)).containsExactly("pedido.creado", "catalogo.reservar_stock");
    }

    @Test
    void con_stock_fija_el_precio_y_pide_cobrar_segun_el_metodo() {
        var qr = pedido(MetodoPago.QR);
        var sagaQr = SagaDeCompra.iniciar(qr);
        sagaQr.sacarMensajes();
        sagaQr.alReservarStock(qr, conPrecio(qr), ahora);
        assertThat(qr.total().texto()).isEqualTo("Bs 1.728,00");
        assertThat(tipos(sagaQr)).containsExactly("cobros.generar_qr");

        var credito = pedido(MetodoPago.CREDITO);
        var sagaCredito = SagaDeCompra.iniciar(credito);
        sagaCredito.sacarMensajes();
        sagaCredito.alReservarStock(credito, conPrecio(credito), ahora);
        assertThat(tipos(sagaCredito)).containsExactly("cobros.autorizar_credito");
    }

    @Test
    void sin_stock_rechaza_sin_nada_que_deshacer() {
        var p = pedido(MetodoPago.QR);
        var saga = SagaDeCompra.iniciar(p);
        saga.sacarMensajes();
        saga.alFallarReserva(p, "Sin stock");
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.COMPENSADA);
        assertThat(p.estado()).isEqualTo(EstadoPedido.RECHAZADO);
        assertThat(tipos(saga)).containsExactly("pedido.rechazado");
    }

    @Test
    void si_el_cobro_falla_libera_el_stock() {
        var p = pedido(MetodoPago.QR);
        var saga = SagaDeCompra.iniciar(p);
        saga.alReservarStock(p, conPrecio(p), ahora);
        saga.sacarMensajes();
        saga.alFallarCobro(p, "El QR venció");
        assertThat(tipos(saga)).containsExactly("catalogo.liberar_stock", "pedido.rechazado");
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.COMPENSANDO);
        saga.alCompensar("stock.liberado");
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.COMPENSADA);
    }

    @Test
    void el_mayorista_confirma_y_la_saga_termina() {
        var p = pedido(MetodoPago.QR);
        var saga = SagaDeCompra.iniciar(p);
        saga.alReservarStock(p, conPrecio(p), ahora);
        saga.alCobrar(p, ahora);
        saga.sacarMensajes();
        saga.alConfirmarMayorista(p);
        assertThat(p.estado()).isEqualTo(EstadoPedido.CONFIRMADO);
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.COMPLETADA);
        assertThat(tipos(saga)).containsExactly("pedido.confirmado");
    }

    @Test
    void si_el_mayorista_rechaza_se_deshace_en_orden_inverso() {
        var p = pedido(MetodoPago.CREDITO);
        var saga = SagaDeCompra.iniciar(p);
        saga.alReservarStock(p, conPrecio(p), ahora);
        saga.alCobrar(p, ahora);
        saga.sacarMensajes();
        saga.alRechazarMayorista(p, "No llego a esa zona");
        assertThat(tipos(saga)).containsExactly("cobros.liberar_credito", "catalogo.liberar_stock", "pedido.rechazado");
        saga.alCompensar("cobro.credito_liberado");
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.COMPENSANDO);
        saga.alCompensar("stock.liberado");
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.COMPENSADA);
    }

    @Test
    void si_el_mayorista_no_responde_en_dos_horas_se_deshace_todo() {
        var p = pedido(MetodoPago.QR);
        var saga = SagaDeCompra.iniciar(p);
        saga.alReservarStock(p, conPrecio(p), ahora);
        saga.alCobrar(p, ahora);
        saga.sacarMensajes();

        saga.alRevisarPlazo(p, ahora.plus(Duration.ofMinutes(119)));
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.ESPERANDO_MAYORISTA);

        saga.alRevisarPlazo(p, ahora.plus(Duration.ofMinutes(121)));
        assertThat(p.motivoRechazo()).isEqualTo("El mayorista no respondió a tiempo");
        assertThat(tipos(saga)).containsExactly("cobros.devolver_qr", "catalogo.liberar_stock", "pedido.rechazado");
    }

    @Test
    void una_respuesta_repetida_o_fuera_de_turno_no_hace_nada() {
        var p = pedido(MetodoPago.QR);
        var saga = SagaDeCompra.iniciar(p);
        saga.alReservarStock(p, conPrecio(p), ahora);
        saga.sacarMensajes();
        saga.alReservarStock(p, conPrecio(p), ahora); // repetida
        saga.alFallarReserva(p, "tarde");      // fuera de turno
        assertThat(saga.sacarMensajes()).isEmpty();
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.COBRANDO);
    }

    @Test
    void no_se_puede_confirmar_un_pedido_que_no_espera_confirmacion() {
        var p = pedido(MetodoPago.QR);
        var saga = SagaDeCompra.iniciar(p);
        assertThatThrownBy(() -> saga.alConfirmarMayorista(p))
                .isInstanceOf(ErrorDeDominio.class)
                .hasMessageContaining("no está esperando confirmación");
    }

    @Test
    void las_transiciones_imposibles_del_pedido_fallan() {
        var p = pedido(MetodoPago.QR);
        p.rechazar("Sin stock");
        assertThatThrownBy(p::confirmar).isInstanceOf(ErrorDeDominio.class);
        assertThatThrownBy(() -> Pedido.nuevo("A-1", UUID.randomUUID(), "lp", "lp", MetodoPago.QR,
                List.of(LineaDePedido.sinPrecio("x", Presentacion.CAJA, 1)), ahora))
                .hasMessageContaining("a sí misma");
    }

    @Test
    void contra_entrega_no_cobra_y_pasa_directo_a_esperar_al_mayorista() {
        var p = pedido(MetodoPago.CONTRA_ENTREGA);
        var saga = SagaDeCompra.iniciar(p);
        saga.sacarMensajes();
        saga.alReservarStock(p, conPrecio(p), ahora);
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.ESPERANDO_MAYORISTA);
        assertThat(saga.cobrado()).isFalse();
        assertThat(p.estado()).isEqualTo(EstadoPedido.POR_CONFIRMAR);
        assertThat(saga.venceConfirmacionEn()).isEqualTo(ahora.plus(SagaDeCompra.PLAZO_DEL_MAYORISTA));
        assertThat(tipos(saga)).containsExactly("pedido.por_confirmar");
    }

    @Test
    void contra_entrega_rechazado_solo_libera_el_stock() {
        var p = pedido(MetodoPago.CONTRA_ENTREGA);
        var saga = SagaDeCompra.iniciar(p);
        saga.alReservarStock(p, conPrecio(p), ahora);
        saga.sacarMensajes();
        saga.alRechazarMayorista(p, "No llego hoy");
        assertThat(tipos(saga)).containsExactly("catalogo.liberar_stock", "pedido.rechazado");
        saga.alCompensar("stock.liberado");
        assertThat(saga.paso()).isEqualTo(SagaDeCompra.Paso.COMPENSADA);
    }

    @Test
    void despues_de_confirmar_se_avanza_de_a_un_paso_hasta_entregar() {
        var p = pedido(MetodoPago.CONTRA_ENTREGA);
        var saga = SagaDeCompra.iniciar(p);
        saga.alReservarStock(p, conPrecio(p), ahora);
        saga.alConfirmarMayorista(p);
        assertThat(p.avanzarEntrega()).isEqualTo(EstadoPedido.EN_PREPARACION);
        assertThat(p.avanzarEntrega()).isEqualTo(EstadoPedido.DESPACHADO);
        assertThat(p.avanzarEntrega()).isEqualTo(EstadoPedido.ENTREGADO);
        assertThatThrownBy(p::avanzarEntrega).hasMessageContaining("solo se avanza un pedido confirmado");
    }

    @Test
    void no_se_avanza_un_pedido_que_el_mayorista_no_confirmo() {
        var p = pedido(MetodoPago.QR);
        assertThatThrownBy(p::avanzarEntrega).hasMessageContaining("PENDIENTE");
    }

    @Test
    void la_lista_de_compras_suma_lo_que_piden_los_pedidos_confirmados() {
        var arroz = LineaDePedido.sinPrecio("AB-001", Presentacion.FARDO, 2).conPrecio(48, new Dinero(790));
        var azucar = LineaDePedido.sinPrecio("AB-002", Presentacion.DOCENA, 1).conPrecio(12, new Dinero(720));
        var otroArroz = LineaDePedido.sinPrecio("AB-001", Presentacion.DOCENA, 1).conPrecio(12, new Dinero(820));
        var a = new Pedido(UUID.randomUUID(), "A-1", UUID.randomUUID(), "dr", "abasto", MetodoPago.QR,
                List.of(arroz, azucar), EstadoPedido.CONFIRMADO, null, ahora);
        var b = new Pedido(UUID.randomUUID(), "A-2", UUID.randomUUID(), "ec", "abasto", MetodoPago.CONTRA_ENTREGA,
                List.of(otroArroz), EstadoPedido.EN_PREPARACION, null, ahora);
        // Ya despachado o todavía sin confirmar: no se compra
        var c = new Pedido(UUID.randomUUID(), "A-3", UUID.randomUUID(), "am", "abasto", MetodoPago.QR,
                List.of(arroz), EstadoPedido.DESPACHADO, null, ahora);
        var d = new Pedido(UUID.randomUUID(), "A-4", UUID.randomUUID(), "dl", "abasto", MetodoPago.QR,
                List.of(arroz), EstadoPedido.POR_CONFIRMAR, null, ahora);

        var lista = ListaDeCompras.de(List.of(a, b, c, d));

        assertThat(lista).hasSize(2);
        assertThat(lista.get(0).productoId()).isEqualTo("AB-001");
        assertThat(lista.get(0).unidades()).isEqualTo(60);
        assertThat(lista.get(0).venta().centavos()).isEqualTo(48 * 790 + 12 * 820);
        assertThat(lista.get(0).pedidos()).containsExactly("A-1", "A-2");
        assertThat(lista.get(1).unidades()).isEqualTo(12);
    }
}
