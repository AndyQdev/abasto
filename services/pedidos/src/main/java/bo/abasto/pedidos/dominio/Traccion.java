package bo.abasto.pedidos.dominio;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Los números con los que Abasto le muestra a un mayorista que vender en la app funciona:
 * cuántos pedidos y cuánta venta por semana, cuántas tiendas compran y cuántas vuelven a comprar.
 * Solo cuentan los pedidos que el mayorista confirmó (los rechazados o pendientes no son venta).
 */
public record Traccion(
        int pedidos,
        Dinero ventas,
        Dinero ticketPromedio,
        int tiendasActivas,
        int tiendasQueRepiten,
        List<Semana> semanas,
        List<TiendaCompradora> tiendas) {

    public record Semana(LocalDate desde, int pedidos, Dinero ventas) {}

    public record TiendaCompradora(String tiendaId, int pedidos, Dinero ventas) {}

    public static final Set<EstadoPedido> SON_VENTA =
            Set.of(EstadoPedido.CONFIRMADO, EstadoPedido.EN_PREPARACION, EstadoPedido.DESPACHADO, EstadoPedido.ENTREGADO);

    /** Una tienda está activa si compró en los últimos 30 días. */
    public static final int DIAS_ACTIVA = 30;

    /**
     * @param hoy     el día de hoy en Bolivia
     * @param semanas cuántas semanas hacia atrás (la actual incluida), empezando en lunes
     */
    public static Traccion de(List<Pedido> todos, LocalDate hoy, int semanas, ZoneId zona) {
        var desde = hoy.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(semanas - 1L);
        var ventas = todos.stream()
                .filter(p -> SON_VENTA.contains(p.estado()))
                .filter(p -> !dia(p, zona).isBefore(desde))
                .toList();

        var porSemana = new ArrayList<Semana>();
        for (int i = 0; i < semanas; i++) {
            var inicio = desde.plusWeeks(i);
            var fin = inicio.plusWeeks(1);
            var deLaSemana = ventas.stream().filter(p -> !dia(p, zona).isBefore(inicio) && dia(p, zona).isBefore(fin)).toList();
            porSemana.add(new Semana(inicio, deLaSemana.size(), suma(deLaSemana)));
        }

        Map<String, List<Pedido>> porTienda = new HashMap<>();
        for (var p : ventas) porTienda.computeIfAbsent(p.tiendaId(), k -> new ArrayList<>()).add(p);
        var tiendas = porTienda.entrySet().stream()
                .map(e -> new TiendaCompradora(e.getKey(), e.getValue().size(), suma(e.getValue())))
                .sorted(Comparator.comparingLong((TiendaCompradora t) -> t.ventas().centavos()).reversed()
                        .thenComparing(TiendaCompradora::tiendaId))
                .toList();

        var limiteActiva = hoy.minusDays(DIAS_ACTIVA);
        int activas = (int) porTienda.values().stream()
                .filter(ps -> ps.stream().anyMatch(p -> dia(p, zona).isAfter(limiteActiva)))
                .count();
        int repiten = (int) porTienda.values().stream().filter(ps -> ps.size() >= 2).count();
        var total = suma(ventas);
        var ticket = ventas.isEmpty() ? Dinero.CERO : new Dinero(Math.round((double) total.centavos() / ventas.size()));

        return new Traccion(ventas.size(), total, ticket, activas, repiten, porSemana, tiendas);
    }

    private static LocalDate dia(Pedido p, ZoneId zona) {
        return p.creadoEn().atZone(zona).toLocalDate();
    }

    private static Dinero suma(List<Pedido> pedidos) {
        return pedidos.stream().map(Pedido::total).reduce(Dinero.CERO, Dinero::sumar);
    }
}
