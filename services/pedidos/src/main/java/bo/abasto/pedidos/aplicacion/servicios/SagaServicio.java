package bo.abasto.pedidos.aplicacion.servicios;

import bo.abasto.pedidos.aplicacion.puertos.entrada.AvanzarSaga;
import bo.abasto.pedidos.aplicacion.puertos.salida.MensajesProcesados;
import bo.abasto.pedidos.aplicacion.puertos.salida.Outbox;
import bo.abasto.pedidos.aplicacion.puertos.salida.PedidoRepositorio;
import bo.abasto.pedidos.aplicacion.puertos.salida.SagaRepositorio;
import bo.abasto.pedidos.dominio.Dinero;
import bo.abasto.pedidos.dominio.LineaDePedido;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.SagaDeCompra;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Orquestador: cada respuesta de Catálogo o de Cobros mueve la saga un paso. */
public class SagaServicio implements AvanzarSaga {

    private final PedidoRepositorio pedidos;
    private final SagaRepositorio sagas;
    private final Outbox outbox;
    private final MensajesProcesados procesados;
    private final Clock reloj;

    public SagaServicio(PedidoRepositorio pedidos, SagaRepositorio sagas, Outbox outbox,
                        MensajesProcesados procesados, Clock reloj) {
        this.pedidos = pedidos;
        this.sagas = sagas;
        this.outbox = outbox;
        this.procesados = procesados;
        this.reloj = reloj;
    }

    @Override
    public void alRecibir(Respuesta r) {
        if (!procesados.registrarSiEsNuevo(r.id())) return; // mensaje repetido: ya se aplicó

        var pedidoId = UUID.fromString(String.valueOf(r.datos().get("pedidoId")));
        var pedido = pedidos.porId(pedidoId).orElse(null);
        var saga = sagas.porPedido(pedidoId).orElse(null);
        if (pedido == null || saga == null) return;

        var motivo = String.valueOf(r.datos().getOrDefault("motivo", "Sin motivo"));
        switch (r.tipo()) {
            case "stock.reservado" -> saga.alReservarStock(pedido, conPrecios(pedido, r.datos()), reloj.instant());
            case "stock.rechazado" -> saga.alFallarReserva(pedido, motivo);
            case "cobro.credito_autorizado", "cobro.qr_pagado" -> saga.alCobrar(pedido, reloj.instant());
            case "cobro.rechazado" -> saga.alFallarCobro(pedido, motivo);
            case "stock.liberado", "cobro.credito_liberado", "cobro.qr_devuelto" -> saga.alCompensar(r.tipo());
            default -> { return; }
        }
        guardar(pedido, saga);
    }

    @Override
    public int vencerPlazos() {
        var ahora = reloj.instant();
        var vencidas = sagas.esperandoConVencimientoAntesDe(ahora);
        for (var saga : vencidas) {
            pedidos.porId(saga.pedidoId()).ifPresent(pedido -> {
                saga.alRevisarPlazo(pedido, ahora);
                guardar(pedido, saga);
            });
        }
        return vencidas.size();
    }

    private void guardar(Pedido pedido, SagaDeCompra saga) {
        pedidos.guardar(pedido);
        sagas.guardar(saga);
        outbox.agregar(saga.sacarMensajes(), pedido.id(), pedido.mayoristaId());
    }

    /** Catálogo responde con las líneas en el mismo orden, cada una con sus unidades y su precio unitario. */
    @SuppressWarnings("unchecked")
    private static List<LineaDePedido> conPrecios(Pedido pedido, Map<String, Object> datos) {
        var lineas = (List<Map<String, Object>>) datos.get("lineas");
        var resultado = new java.util.ArrayList<LineaDePedido>();
        for (int i = 0; i < pedido.lineas().size(); i++) {
            var reservada = lineas.get(i);
            resultado.add(pedido.lineas().get(i).conPrecio(
                    ((Number) reservada.get("unidades")).intValue(),
                    new Dinero(((Number) reservada.get("precioUnitarioCentavos")).longValue())));
        }
        return resultado;
    }
}
