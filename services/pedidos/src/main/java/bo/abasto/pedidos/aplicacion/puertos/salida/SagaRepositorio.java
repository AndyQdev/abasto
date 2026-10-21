package bo.abasto.pedidos.aplicacion.puertos.salida;

import bo.abasto.pedidos.dominio.SagaDeCompra;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Puerto de salida: el estado de cada saga se guarda en PostgreSQL junto al pedido. */
public interface SagaRepositorio {

    Optional<SagaDeCompra> porPedido(UUID pedidoId);

    List<SagaDeCompra> esperandoConVencimientoAntesDe(Instant momento);

    void guardar(SagaDeCompra saga);
}
