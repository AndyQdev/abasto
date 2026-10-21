package bo.abasto.pedidos.aplicacion.puertos.entrada;

import bo.abasto.pedidos.dominio.Pedido;
import java.util.UUID;

/** Puerto de entrada: el mayorista confirma o rechaza desde el Panel. */
public interface DecidirPedido {

    Pedido confirmar(UUID pedidoId, String mayoristaId);

    Pedido rechazar(UUID pedidoId, String mayoristaId, String motivo);
}
