package bo.abasto.pedidos.dominio;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lo que el mayorista tiene que salir a comprar para los pedidos confirmados que todavía no preparó.
 * Es el corazón del modelo de lanzamiento (Abasto vende bajo pedido): suma las unidades de cada producto
 * de todos esos pedidos. El costo y el proveedor los pone Catálogo (el Router los junta por federación).
 */
public final class ListaDeCompras {

    /** Los estados en los que la mercadería todavía hay que conseguirla. */
    public static final Set<EstadoPedido> POR_COMPRAR = Set.of(EstadoPedido.CONFIRMADO, EstadoPedido.EN_PREPARACION);

    public record Linea(String productoId, int unidades, Dinero venta, List<String> pedidos) {}

    private ListaDeCompras() {}

    public static List<Linea> de(List<Pedido> pedidos) {
        Map<String, int[]> unidades = new LinkedHashMap<>();
        Map<String, Dinero> venta = new LinkedHashMap<>();
        Map<String, Set<String>> codigos = new LinkedHashMap<>();
        for (var pedido : pedidos) {
            if (!POR_COMPRAR.contains(pedido.estado())) continue;
            for (var linea : pedido.lineas()) {
                var id = linea.productoId();
                unidades.computeIfAbsent(id, k -> new int[1])[0] += linea.unidades();
                venta.merge(id, linea.subtotal(), Dinero::sumar);
                codigos.computeIfAbsent(id, k -> new LinkedHashSet<>()).add(pedido.codigo());
            }
        }
        var lista = new ArrayList<Linea>();
        for (var id : unidades.keySet()) {
            lista.add(new Linea(id, unidades.get(id)[0], venta.get(id), List.copyOf(codigos.get(id))));
        }
        return lista;
    }
}
