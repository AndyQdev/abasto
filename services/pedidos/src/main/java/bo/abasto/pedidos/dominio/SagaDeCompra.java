package bo.abasto.pedidos.dominio;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Saga orquestada de la compra: Pedidos (1) → Catálogo reserva el stock (2) → Cobros cobra (3)
 * → el mayorista confirma (4). Si algo falla después de un paso, se deshacen los anteriores en orden inverso.
 *
 * Es una máquina de estados pura: recibe lo que pasó y deja en sacarMensajes() lo que hay que mandar.
 * Cada método ignora los mensajes que llegan fuera de turno, así una respuesta repetida no hace nada.
 */
public class SagaDeCompra {

    public enum Paso { RESERVANDO_STOCK, COBRANDO, ESPERANDO_MAYORISTA, COMPLETADA, COMPENSANDO, COMPENSADA }

    public static final Duration PLAZO_DEL_MAYORISTA = Duration.ofHours(2);

    private final UUID pedidoId;
    private Paso paso;
    private boolean stockReservado;
    private boolean cobrado;
    private Instant venceConfirmacionEn;
    private final List<Mensaje> pendientes = new ArrayList<>();

    public SagaDeCompra(UUID pedidoId, Paso paso, boolean stockReservado, boolean cobrado, Instant venceConfirmacionEn) {
        this.pedidoId = pedidoId;
        this.paso = paso;
        this.stockReservado = stockReservado;
        this.cobrado = cobrado;
        this.venceConfirmacionEn = venceConfirmacionEn;
    }

    /** Paso 1: el pedido existe; se le pide a Catálogo que reserve. */
    public static SagaDeCompra iniciar(Pedido pedido) {
        var saga = new SagaDeCompra(pedido.id(), Paso.RESERVANDO_STOCK, false, false, null);
        saga.pendientes.add(Mensaje.evento("pedido.creado", datosDe(pedido)));
        saga.pendientes.add(Mensaje.comando("catalogo.reservar_stock", Map.of(
                "pedidoId", pedido.id().toString(),
                "mayoristaId", pedido.mayoristaId(),
                "tiendaId", pedido.tiendaId(),
                "lineas", pedido.lineas().stream().map(l -> Map.of(
                        "productoId", l.productoId(),
                        "presentacion", l.presentacion().name(),
                        "cantidad", l.cantidad())).toList())));
        return saga;
    }

    /**
     * Paso 2 hecho: hay stock y Catálogo fijó los precios. Ahora se cobra.
     * Contra entrega no hay nada que cobrar antes: se pasa directo a esperar al mayorista.
     */
    public void alReservarStock(Pedido pedido, List<LineaDePedido> lineasConPrecio, Instant ahora) {
        if (paso != Paso.RESERVANDO_STOCK) return;
        pedido.fijarPrecios(lineasConPrecio);
        stockReservado = true;
        if (pedido.metodoPago() == MetodoPago.CONTRA_ENTREGA) {
            esperarAlMayorista(pedido, ahora);
            return;
        }
        paso = Paso.COBRANDO;
        var tipo = pedido.metodoPago() == MetodoPago.CREDITO ? "cobros.autorizar_credito" : "cobros.generar_qr";
        pendientes.add(Mensaje.comando(tipo, Map.of(
                "pedidoId", pedido.id().toString(),
                "tiendaId", pedido.tiendaId(),
                "mayoristaId", pedido.mayoristaId(),
                "centavos", pedido.total().centavos())));
    }

    /** Paso 2 falló: no hay stock. No hay nada que deshacer. */
    public void alFallarReserva(Pedido pedido, String motivo) {
        if (paso != Paso.RESERVANDO_STOCK) return;
        pedido.rechazar(motivo);
        paso = Paso.COMPENSADA;
        pendientes.add(Mensaje.evento("pedido.rechazado", conMotivo(pedido, motivo)));
    }

    /** Paso 3 hecho: el pago o el crédito están; se espera al mayorista con un plazo. */
    public void alCobrar(Pedido pedido, Instant ahora) {
        if (paso != Paso.COBRANDO) return;
        cobrado = true;
        esperarAlMayorista(pedido, ahora);
    }

    private void esperarAlMayorista(Pedido pedido, Instant ahora) {
        pedido.quedarPorConfirmar();
        venceConfirmacionEn = ahora.plus(PLAZO_DEL_MAYORISTA);
        paso = Paso.ESPERANDO_MAYORISTA;
        pendientes.add(Mensaje.evento("pedido.por_confirmar", datosDe(pedido)));
    }

    /** Paso 3 falló (QR vencido, crédito insuficiente): se libera el stock. */
    public void alFallarCobro(Pedido pedido, String motivo) {
        if (paso != Paso.COBRANDO) return;
        compensar(pedido, motivo);
    }

    /** Paso 4: el mayorista confirma. La saga termina bien. */
    public void alConfirmarMayorista(Pedido pedido) {
        if (paso != Paso.ESPERANDO_MAYORISTA) {
            throw new ErrorDeDominio("PEDIDO_NO_ESPERA_CONFIRMACION", "El pedido " + pedido.codigo() + " no está esperando confirmación");
        }
        pedido.confirmar();
        paso = Paso.COMPLETADA;
        pendientes.add(Mensaje.evento("pedido.confirmado", datosDe(pedido)));
    }

    public void alRechazarMayorista(Pedido pedido, String motivo) {
        if (paso != Paso.ESPERANDO_MAYORISTA) {
            throw new ErrorDeDominio("PEDIDO_NO_ESPERA_CONFIRMACION", "El pedido " + pedido.codigo() + " no está esperando confirmación");
        }
        compensar(pedido, motivo);
    }

    /** Nadie queda colgado: si el mayorista no responde a tiempo, se deshace todo. */
    public void alRevisarPlazo(Pedido pedido, Instant ahora) {
        if (paso == Paso.ESPERANDO_MAYORISTA && ahora.isAfter(venceConfirmacionEn)) {
            compensar(pedido, "El mayorista no respondió a tiempo");
        }
    }

    /** Llegó la confirmación de una compensación. Cuando no queda nada por deshacer, la saga termina. */
    public void alCompensar(String tipoDeRespuesta) {
        if (paso != Paso.COMPENSANDO) return;
        if (tipoDeRespuesta.equals("stock.liberado")) stockReservado = false;
        if (tipoDeRespuesta.equals("cobro.credito_liberado") || tipoDeRespuesta.equals("cobro.qr_devuelto")) cobrado = false;
        if (!stockReservado && !cobrado) paso = Paso.COMPENSADA;
    }

    private void compensar(Pedido pedido, String motivo) {
        pedido.rechazar(motivo);
        paso = Paso.COMPENSANDO;
        // Orden inverso: primero se devuelve el dinero, después el stock
        if (cobrado) {
            var tipo = pedido.metodoPago() == MetodoPago.CREDITO ? "cobros.liberar_credito" : "cobros.devolver_qr";
            pendientes.add(Mensaje.comando(tipo, Map.of(
                    "pedidoId", pedido.id().toString(),
                    "tiendaId", pedido.tiendaId(),
                    "mayoristaId", pedido.mayoristaId())));
        }
        if (stockReservado) {
            pendientes.add(Mensaje.comando("catalogo.liberar_stock", Map.of(
                    "pedidoId", pedido.id().toString(),
                    "mayoristaId", pedido.mayoristaId())));
        }
        pendientes.add(Mensaje.evento("pedido.rechazado", conMotivo(pedido, motivo)));
        if (!cobrado && !stockReservado) paso = Paso.COMPENSADA;
    }

    private static Map<String, Object> datosDe(Pedido pedido) {
        return pedido.datosDelEvento();
    }

    private static Map<String, Object> conMotivo(Pedido pedido, String motivo) {
        var datos = new java.util.HashMap<>(datosDe(pedido));
        datos.put("motivo", motivo);
        return datos;
    }

    /** Entrega una sola vez los mensajes nuevos, para guardarlos en el outbox. */
    public List<Mensaje> sacarMensajes() {
        var copia = List.copyOf(pendientes);
        pendientes.clear();
        return copia;
    }

    public UUID pedidoId() { return pedidoId; }
    public Paso paso() { return paso; }
    public boolean stockReservado() { return stockReservado; }
    public boolean cobrado() { return cobrado; }
    public Instant venceConfirmacionEn() { return venceConfirmacionEn; }
}
