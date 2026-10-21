package bo.abasto.pedidos.configuracion;

import bo.abasto.pedidos.aplicacion.puertos.salida.MensajesProcesados;
import bo.abasto.pedidos.aplicacion.puertos.salida.Outbox;
import bo.abasto.pedidos.aplicacion.puertos.salida.PedidoRepositorio;
import bo.abasto.pedidos.aplicacion.puertos.salida.SagaRepositorio;
import bo.abasto.pedidos.aplicacion.servicios.PedidosServicio;
import bo.abasto.pedidos.aplicacion.servicios.SagaServicio;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Aquí se enchufan los adaptadores a los casos de uso. Es el único lugar que conoce las dos partes. */
@Configuration
class CasosDeUsoConfig {

    @Bean
    Clock reloj() {
        return Clock.systemUTC();
    }

    @Bean
    PedidosServicio pedidosServicio(PedidoRepositorio pedidos, SagaRepositorio sagas, Outbox outbox, Clock reloj) {
        return new PedidosServicio(pedidos, sagas, outbox, reloj);
    }

    @Bean
    SagaServicio sagaServicio(PedidoRepositorio pedidos, SagaRepositorio sagas, Outbox outbox,
                              MensajesProcesados procesados, Clock reloj) {
        return new SagaServicio(pedidos, sagas, outbox, procesados, reloj);
    }
}
