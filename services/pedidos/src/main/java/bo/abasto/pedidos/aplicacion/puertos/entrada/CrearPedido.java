package bo.abasto.pedidos.aplicacion.puertos.entrada;

import bo.abasto.pedidos.dominio.MetodoPago;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.Presentacion;
import java.util.List;
import java.util.UUID;

/** Puerto de entrada: comprar. Lo usan GraphQL (Mercado) y Conecta (offline, e-commerce, n8n). */
public interface CrearPedido {

    record Linea(String productoId, Presentacion presentacion, int cantidad) {}

    record Comando(UUID clave, String tiendaId, String mayoristaId, MetodoPago metodoPago, List<Linea> lineas) {}

    /** Si la clave ya existe devuelve el mismo pedido: reintentar nunca crea otro. */
    Pedido ejecutar(Comando comando);
}
