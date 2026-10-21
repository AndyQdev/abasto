package bo.abasto.pedidos.adaptadores.entrada.programado;

import bo.abasto.pedidos.aplicacion.puertos.entrada.AvanzarSaga;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Cada minuto deshace las sagas en las que el mayorista no confirmó a tiempo. Ninguna saga queda colgada. */
@Component
class RevisorDePlazos {

    private static final Logger log = LoggerFactory.getLogger(RevisorDePlazos.class);

    private final AvanzarSaga saga;
    private final TransactionTemplate transaccion;

    RevisorDePlazos(AvanzarSaga saga, TransactionTemplate transaccion) {
        this.saga = saga;
        this.transaccion = transaccion;
    }

    @Scheduled(fixedDelayString = "${abasto.saga.revisar-plazos-cada:60000}")
    void revisar() {
        Integer vencidas = transaccion.execute(s -> saga.vencerPlazos());
        if (vencidas != null && vencidas > 0) log.info("Sagas vencidas y compensadas: {}", vencidas);
    }
}
