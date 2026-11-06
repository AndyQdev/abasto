package bo.abasto.pedidos.aplicacion.servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import bo.abasto.pedidos.aplicacion.puertos.entrada.AtenderReclamos;
import bo.abasto.pedidos.aplicacion.puertos.salida.Outbox;
import bo.abasto.pedidos.aplicacion.puertos.salida.PedidoRepositorio;
import bo.abasto.pedidos.aplicacion.puertos.salida.ReclamoRepositorio;
import bo.abasto.pedidos.dominio.Dinero;
import bo.abasto.pedidos.dominio.ErrorDeDominio;
import bo.abasto.pedidos.dominio.LineaDePedido;
import bo.abasto.pedidos.dominio.Mensaje;
import bo.abasto.pedidos.dominio.MetodoPago;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.Presentacion;
import bo.abasto.pedidos.dominio.Reclamo;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** CU-16: la tienda reporta, Abasto resuelve a mano y el sistema solo anota la devolución. */
class ReclamosServicioTest {

    private final PedidoRepositorio pedidos = mock(PedidoRepositorio.class);
    private final ReclamoRepositorio reclamos = mock(ReclamoRepositorio.class);
    private final Outbox outbox = mock(Outbox.class);
    private final ReclamosServicio servicio = new ReclamosServicio(reclamos, pedidos, outbox, Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

    private final Pedido pedido = Pedido.nuevo(
            "A-1", UUID.randomUUID(), "dr", "abasto", MetodoPago.CONTRA_ENTREGA,
            List.of(LineaDePedido.sinPrecio("AB-1", Presentacion.UNIDAD, 1)), Instant.EPOCH, null);

    @BeforeEach
    void preparar() {
        when(pedidos.porId(pedido.id())).thenReturn(Optional.of(pedido));
    }

    /** Un reclamo ya abierto, como el que Abasto ve en el Superadmin. */
    private Reclamo abierto() {
        return Reclamo.reconstruir(UUID.randomUUID(), pedido.id(), "dr", "abasto", Reclamo.Motivo.DANADO, "Llegó roto",
                Reclamo.Estado.ABIERTO, null, null, null, null, Instant.EPOCH, null);
    }

    private AtenderReclamos.Resolucion aprobar(UUID id, Long centavos, Reclamo.FormaDeDevolucion forma, String respuesta) {
        return new AtenderReclamos.Resolucion(id, true, centavos, forma, respuesta, "admin");
    }

    @Test
    void unPedidoQueLaSagaTodaviaProcesaNoSePuedeReclamar() {
        assertThatThrownBy(() -> servicio.abrir(pedido.id(), "dr", Reclamo.Motivo.NO_LLEGO, null))
                .isInstanceOfSatisfying(ErrorDeDominio.class, e -> assertThat(e.codigo()).isEqualTo("PEDIDO_EN_PROCESO"));
        verify(reclamos, never()).guardar(any());
    }

    @Test
    void otraTiendaNoPuedeReclamarNiSaberQueElPedidoExiste() {
        assertThatThrownBy(() -> servicio.abrir(pedido.id(), "otra", Reclamo.Motivo.NO_LLEGO, null))
                .isInstanceOfSatisfying(ErrorDeDominio.class, e -> assertThat(e.codigo()).isEqualTo("PEDIDO_NO_EXISTE"));
        verify(reclamos, never()).guardar(any());
        verify(outbox, never()).agregar(any(), any(), any());
    }

    @Test
    void repetirElReclamoDevuelveElMismoYNoAvisaOtraVez() {
        var existente = abierto();
        when(reclamos.porPedido(pedido.id())).thenReturn(Optional.of(existente));
        assertThat(servicio.abrir(pedido.id(), "dr", Reclamo.Motivo.OTRO, "otra cosa")).isSameAs(existente);
        verify(reclamos, never()).guardar(any());
        verify(outbox, never()).agregar(any(), any(), any());
    }

    @Test
    void aprobarAnotaLoDevueltoYAvisaALaTienda() {
        var reclamo = abierto();
        when(reclamos.porId(reclamo.id())).thenReturn(Optional.of(reclamo));
        // Pedido sin precios fijados: total cero. Solo se puede aprobar sin devolver dinero
        servicio.resolver(aprobar(reclamo.id(), 0L, null, "Te repusimos el producto"));

        assertThat(reclamo.estado()).isEqualTo(Reclamo.Estado.APROBADO);
        assertThat(reclamo.respuesta()).isEqualTo("Te repusimos el producto");
        assertThat(reclamo.forma()).isNull();
        verify(reclamos).guardar(reclamo);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Mensaje>> mensajes = ArgumentCaptor.forClass(List.class);
        verify(outbox).agregar(mensajes.capture(), eq(pedido.id()), eq("abasto"));
        assertThat(mensajes.getValue().get(0).tipo()).isEqualTo("pedido.reclamo_resuelto");
        assertThat(mensajes.getValue().get(0).datos()).containsEntry("tiendaId", "dr").containsEntry("estadoDelReclamo", "APROBADO");
    }

    @Test
    void loDevueltoNoPuedePasarElTotalDelPedido() {
        var reclamo = abierto();
        assertThatThrownBy(() -> reclamo.aprobar(new Dinero(10_001), Reclamo.FormaDeDevolucion.QR, "Sí", new Dinero(10_000), "admin", Instant.EPOCH))
                .isInstanceOfSatisfying(ErrorDeDominio.class, e -> assertThat(e.codigo()).isEqualTo("DEVUELTO_MAYOR_QUE_EL_TOTAL"));
        assertThat(reclamo.estado()).isEqualTo(Reclamo.Estado.ABIERTO);
    }

    @Test
    void devolverDineroPideComoSeDevolvio() {
        var reclamo = abierto();
        assertThatThrownBy(() -> reclamo.aprobar(new Dinero(500), null, "Sí", new Dinero(10_000), "admin", Instant.EPOCH))
                .isInstanceOfSatisfying(ErrorDeDominio.class, e -> assertThat(e.codigo()).isEqualTo("FORMA_REQUERIDA"));
        reclamo.aprobar(new Dinero(500), Reclamo.FormaDeDevolucion.TRANSFERENCIA, "Te devolvimos", new Dinero(10_000), "admin", Instant.EPOCH);
        assertThat(reclamo.devuelto().centavos()).isEqualTo(500);
        assertThat(reclamo.forma()).isEqualTo(Reclamo.FormaDeDevolucion.TRANSFERENCIA);
    }

    @Test
    void sinRespuestaNoSeResuelve() {
        var reclamo = abierto();
        assertThatThrownBy(() -> reclamo.rechazar("  ", "admin", Instant.EPOCH))
                .isInstanceOfSatisfying(ErrorDeDominio.class, e -> assertThat(e.codigo()).isEqualTo("RESPUESTA_REQUERIDA"));
    }

    @Test
    void unReclamoResueltoNoCambia() {
        var reclamo = abierto();
        reclamo.rechazar("El pedido llegó completo", "admin", Instant.EPOCH);
        assertThatThrownBy(() -> reclamo.aprobar(new Dinero(0), null, "Mejor sí", new Dinero(100), "admin", Instant.EPOCH))
                .isInstanceOfSatisfying(ErrorDeDominio.class, e -> assertThat(e.codigo()).isEqualTo("RECLAMO_YA_RESUELTO"));
        assertThat(reclamo.estado()).isEqualTo(Reclamo.Estado.RECHAZADO);
    }

    @Test
    void laTiendaReclamaUnPedidoYaProcesadoYSeAvisa() {
        pedido.quedarPorConfirmar();
        when(reclamos.porPedido(pedido.id())).thenReturn(Optional.empty());

        var reclamo = servicio.abrir(pedido.id(), "dr", Reclamo.Motivo.INCOMPLETO, "  Faltó una caja  ");

        assertThat(reclamo.estado()).isEqualTo(Reclamo.Estado.ABIERTO);
        assertThat(reclamo.detalle()).isEqualTo("Faltó una caja");
        verify(reclamos).guardar(reclamo);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Mensaje>> mensajes = ArgumentCaptor.forClass(List.class);
        verify(outbox).agregar(mensajes.capture(), eq(pedido.id()), eq("abasto"));
        assertThat(mensajes.getValue().get(0).tipo()).isEqualTo("pedido.reclamo_abierto");
    }

    @Test
    void elMotivoOtroPideContarQuePaso() {
        pedido.quedarPorConfirmar();
        when(reclamos.porPedido(pedido.id())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> servicio.abrir(pedido.id(), "dr", Reclamo.Motivo.OTRO, "   "))
                .isInstanceOfSatisfying(ErrorDeDominio.class, e -> assertThat(e.codigo()).isEqualTo("DETALLE_REQUERIDO"));
        verify(reclamos, never()).guardar(any());
    }

    @Test
    void resolverUnReclamoQueNoExisteLoDice() {
        var id = UUID.randomUUID();
        when(reclamos.porId(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> servicio.resolver(aprobar(id, 0L, null, "Sí")))
                .isInstanceOfSatisfying(ErrorDeDominio.class, e -> assertThat(e.codigo()).isEqualTo("RECLAMO_NO_EXISTE"));
    }
}
