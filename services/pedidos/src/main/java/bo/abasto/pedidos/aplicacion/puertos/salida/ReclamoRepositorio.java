package bo.abasto.pedidos.aplicacion.puertos.salida;

import bo.abasto.pedidos.dominio.Reclamo;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Puerto de salida: dónde viven los reclamos (CU-16). */
public interface ReclamoRepositorio {

    Optional<Reclamo> porId(UUID id);

    Optional<Reclamo> porPedido(UUID pedidoId);

    List<Reclamo> dePedidos(Collection<UUID> pedidoIds);

    /** Lo más nuevo primero. Con estado null, todos. */
    List<Reclamo> listar(Reclamo.Estado estado);

    void guardar(Reclamo reclamo);
}
