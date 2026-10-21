package bo.abasto.pedidos.adaptadores.salida.persistencia;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface PedidoJpa extends JpaRepository<PedidoEntidad, UUID> {

    Optional<PedidoEntidad> findByClave(UUID clave);

    List<PedidoEntidad> findByTiendaIdOrderByCreadoEnDesc(String tiendaId);

    List<PedidoEntidad> findByTiendaIdAndEstadoOrderByCreadoEnDesc(String tiendaId, String estado);

    List<PedidoEntidad> findByMayoristaIdOrderByCreadoEnDesc(String mayoristaId);

    List<PedidoEntidad> findByMayoristaIdAndEstadoOrderByCreadoEnDesc(String mayoristaId, String estado);

    @Query(value = "SELECT nextval('pedido_codigo_seq')", nativeQuery = true)
    long siguienteNumero();
}

interface SagaJpa extends JpaRepository<SagaEntidad, UUID> {

    List<SagaEntidad> findByPasoAndVenceConfirmacionEnBefore(String paso, Instant momento);
}

interface OutboxJpa extends JpaRepository<OutboxEntidad, UUID> {

    /** SKIP LOCKED: si hay dos instancias de Pedidos, cada mensaje lo publica una sola. */
    @Query(value = "SELECT * FROM outbox WHERE publicado_en IS NULL ORDER BY creado_en LIMIT 100 FOR UPDATE SKIP LOCKED",
            nativeQuery = true)
    List<OutboxEntidad> pendientes();
}

interface MensajeProcesadoJpa extends JpaRepository<MensajeProcesadoEntidad, String> {

    @Modifying
    @Query(value = "INSERT INTO mensajes_procesados (id) VALUES (?1) ON CONFLICT DO NOTHING", nativeQuery = true)
    int registrar(String id);
}
