package bo.abasto.pedidos.adaptadores.salida.persistencia;

import bo.abasto.pedidos.aplicacion.puertos.salida.ReclamoRepositorio;
import bo.abasto.pedidos.dominio.Dinero;
import bo.abasto.pedidos.dominio.Reclamo;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;

interface ReclamoJpa extends JpaRepository<ReclamoEntidad, UUID> {

    Optional<ReclamoEntidad> findByPedidoId(UUID pedidoId);

    List<ReclamoEntidad> findByPedidoIdIn(Collection<UUID> pedidoIds);

    List<ReclamoEntidad> findAllByOrderByCreadoEnDesc();

    List<ReclamoEntidad> findByEstadoOrderByCreadoEnDesc(String estado);
}

/** Adaptador de salida: los reclamos en la base `pedidos`. */
@Component
class ReclamoAdaptador implements ReclamoRepositorio {

    private final ReclamoJpa jpa;

    ReclamoAdaptador(ReclamoJpa jpa) {
        this.jpa = jpa;
    }

    @Override
    public Optional<Reclamo> porId(UUID id) {
        return jpa.findById(id).map(ReclamoAdaptador::aDominio);
    }

    @Override
    public Optional<Reclamo> porPedido(UUID pedidoId) {
        return jpa.findByPedidoId(pedidoId).map(ReclamoAdaptador::aDominio);
    }

    @Override
    public List<Reclamo> dePedidos(Collection<UUID> pedidoIds) {
        return pedidoIds.isEmpty() ? List.of() : jpa.findByPedidoIdIn(pedidoIds).stream().map(ReclamoAdaptador::aDominio).toList();
    }

    @Override
    public List<Reclamo> listar(Reclamo.Estado estado) {
        var filas = estado == null ? jpa.findAllByOrderByCreadoEnDesc() : jpa.findByEstadoOrderByCreadoEnDesc(estado.name());
        return filas.stream().map(ReclamoAdaptador::aDominio).toList();
    }

    @Override
    public void guardar(Reclamo r) {
        var fila = new ReclamoEntidad();
        fila.id = r.id();
        fila.pedidoId = r.pedidoId();
        fila.tiendaId = r.tiendaId();
        fila.mayoristaId = r.mayoristaId();
        fila.motivo = r.motivo().name();
        fila.detalle = r.detalle();
        fila.estado = r.estado().name();
        fila.respuesta = r.respuesta();
        fila.devueltoCentavos = r.devuelto() == null ? null : r.devuelto().centavos();
        fila.forma = r.forma() == null ? null : r.forma().name();
        fila.resueltoPor = r.resueltoPor();
        fila.creadoEn = r.creadoEn();
        fila.resueltoEn = r.resueltoEn();
        jpa.save(fila);
    }

    private static Reclamo aDominio(ReclamoEntidad f) {
        return Reclamo.reconstruir(
                f.id, f.pedidoId, f.tiendaId, f.mayoristaId, Reclamo.Motivo.valueOf(f.motivo), f.detalle,
                Reclamo.Estado.valueOf(f.estado), f.respuesta,
                f.devueltoCentavos == null ? null : new Dinero(f.devueltoCentavos),
                f.forma == null ? null : Reclamo.FormaDeDevolucion.valueOf(f.forma),
                f.resueltoPor, f.creadoEn, f.resueltoEn);
    }
}
