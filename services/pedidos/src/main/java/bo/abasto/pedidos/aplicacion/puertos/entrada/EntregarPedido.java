package bo.abasto.pedidos.aplicacion.puertos.entrada;

import bo.abasto.pedidos.dominio.ListaDeCompras;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.Traccion;
import java.util.List;
import java.util.UUID;

/**
 * Puerto de entrada: lo que hace el mayorista después de confirmar.
 * En el modelo de lanzamiento, Abasto compra bajo pedido: primero mira la lista de compras,
 * sale al mercado y después avanza cada pedido hasta entregarlo.
 */
public interface EntregarPedido {

    /** CONFIRMADO → EN_PREPARACION → DESPACHADO → ENTREGADO, de a un paso. */
    Pedido avanzar(UUID pedidoId, String mayoristaId);

    /** Lo que hay que comprar para los pedidos confirmados que todavía no se prepararon. */
    List<ListaDeCompras.Linea> listaDeCompras(String mayoristaId);

    /** Los números de la plataforma (Superadmin); con mayoristaId, solo los de ese vendedor (por ejemplo Abasto). */
    Traccion traccion(String mayoristaId, int semanas);
}
