package bo.abasto.pedidos.aplicacion.puertos.entrada;

import java.util.Map;

/** Puerto de entrada: llega una respuesta de Catálogo o de Cobros por RabbitMQ. */
public interface AvanzarSaga {

    record Respuesta(String id, String tipo, Map<String, Object> datos) {}

    void alRecibir(Respuesta respuesta);

    /** Revisa las sagas esperando al mayorista y deshace las que vencieron. */
    int vencerPlazos();
}
