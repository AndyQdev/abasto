package bo.abasto.pedidos.aplicacion.servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import bo.abasto.pedidos.aplicacion.puertos.entrada.CrearPedido;
import bo.abasto.pedidos.aplicacion.puertos.salida.Outbox;
import bo.abasto.pedidos.aplicacion.puertos.salida.PedidoRepositorio;
import bo.abasto.pedidos.aplicacion.puertos.salida.SagaRepositorio;
import bo.abasto.pedidos.dominio.ErrorDeDominio;
import bo.abasto.pedidos.dominio.LineaDePedido;
import bo.abasto.pedidos.dominio.MetodoPago;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.Presentacion;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** La clave de idempotencia es de cada tienda: reutilizar la de otra nunca puede devolver el pedido ajeno. */
class ClaveDeOtraTiendaTest {

    private final PedidoRepositorio pedidos = mock(PedidoRepositorio.class);
    private final PedidosServicio servicio = new PedidosServicio(
            pedidos, mock(SagaRepositorio.class), mock(Outbox.class), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));

    private final UUID clave = UUID.randomUUID();
    private final Pedido dePrimera = Pedido.nuevo(
            "A-1", clave, "primera", "lp", MetodoPago.QR,
            List.of(LineaDePedido.sinPrecio("P-1", Presentacion.UNIDAD, 1)), Instant.EPOCH, null);

    private CrearPedido.Comando comandoDe(String tienda) {
        return new CrearPedido.Comando(clave, tienda, "lp", MetodoPago.QR,
                List.of(new CrearPedido.Linea("P-1", Presentacion.UNIDAD, 1)), null);
    }

    @Test
    void laMismaTiendaRecibeSuPedidoOtraVez() {
        when(pedidos.porClave(clave)).thenReturn(Optional.of(dePrimera));
        assertThat(servicio.ejecutar(comandoDe("primera"))).isSameAs(dePrimera);
        verify(pedidos, never()).guardar(any());
    }

    @Test
    void otraTiendaNoRecibeElPedidoAjeno() {
        when(pedidos.porClave(clave)).thenReturn(Optional.of(dePrimera));
        assertThatThrownBy(() -> servicio.ejecutar(comandoDe("otra")))
                .isInstanceOf(ErrorDeDominio.class)
                .hasMessageNotContaining("A-1")
                .hasMessageContaining("Otra clave");
        verify(pedidos, never()).guardar(any());
    }
}
