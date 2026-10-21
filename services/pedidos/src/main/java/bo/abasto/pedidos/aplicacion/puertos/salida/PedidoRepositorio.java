package bo.abasto.pedidos.aplicacion.puertos.salida;

import bo.abasto.pedidos.dominio.EstadoPedido;
import bo.abasto.pedidos.dominio.Pedido;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Puerto de salida: dónde viven los pedidos. El adaptador de JPA lo implementa. */
public interface PedidoRepositorio {

    Optional<Pedido> porId(UUID id);

    Optional<Pedido> porClave(UUID clave);

    List<Pedido> deTienda(String tiendaId, EstadoPedido estado);

    List<Pedido> deMayorista(String mayoristaId, EstadoPedido estado);

    void guardar(Pedido pedido);

    /** Código legible y correlativo, por ejemplo A-1042. */
    String siguienteCodigo();
}
