package bo.abasto.pedidos.adaptadores.entrada.graphql;

import bo.abasto.pedidos.aplicacion.puertos.entrada.ConsultarPedidos;
import bo.abasto.pedidos.aplicacion.puertos.entrada.CrearPedido;
import bo.abasto.pedidos.aplicacion.puertos.entrada.DecidirPedido;
import bo.abasto.pedidos.aplicacion.puertos.entrada.EntregarPedido;
import bo.abasto.pedidos.dominio.Dinero;
import bo.abasto.pedidos.dominio.DireccionDeEntrega;
import bo.abasto.pedidos.dominio.EstadoPedido;
import bo.abasto.pedidos.dominio.LineaDePedido;
import bo.abasto.pedidos.dominio.ListaDeCompras;
import bo.abasto.pedidos.dominio.MetodoPago;
import bo.abasto.pedidos.dominio.Pedido;
import bo.abasto.pedidos.dominio.Presentacion;
import bo.abasto.pedidos.dominio.ErrorDeDominio;
import bo.abasto.pedidos.dominio.Traccion;
import java.util.List;
import java.util.UUID;
import org.springframework.graphql.data.federation.EntityMapping;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Adaptador de entrada: el subgrafo de Pedidos. Traduce GraphQL ↔ casos de uso y abre la transacción.
 * La empresa siempre sale del token (org_id): nadie puede comprar ni ver pedidos a nombre de otra.
 */
@Controller
class PedidoController {

    record DineroVista(long centavos, String moneda, String texto) {
        static DineroVista de(Dinero d) {
            return d == null ? null : new DineroVista(d.centavos(), "BOB", d.texto());
        }
    }

    record Referencia(String id) {}

    record LineaVista(Referencia producto, Presentacion presentacion, int cantidad, int unidades,
                      DineroVista precioUnitario, DineroVista subtotal) {
        static LineaVista de(LineaDePedido l) {
            return new LineaVista(new Referencia(l.productoId()), l.presentacion(), l.cantidad(), l.unidades(),
                    DineroVista.de(l.precioUnitario()), DineroVista.de(l.subtotal()));
        }
    }

    record PedidoVista(String id, String codigo, String clave, Referencia tienda, Referencia mayorista,
                       List<LineaVista> lineas, EstadoPedido estado, MetodoPago metodoPago, DineroVista total,
                       String creadoEn, String motivoRechazo, EntregaVista entrega) {
        static PedidoVista de(Pedido p) {
            return new PedidoVista(p.id().toString(), p.codigo(), p.clave().toString(), new Referencia(p.tiendaId()),
                    new Referencia(p.mayoristaId()), p.lineas().stream().map(LineaVista::de).toList(), p.estado(),
                    p.metodoPago(), DineroVista.de(p.total()), p.creadoEn().toString(), p.motivoRechazo(),
                    EntregaVista.de(p.entrega()));
        }
    }

    record EntregaVista(String calle, String zona, String referencia, Double latitud, Double longitud, String texto) {
        static EntregaVista de(DireccionDeEntrega d) {
            return d == null ? null : new EntregaVista(d.calle(), d.zona(), d.referencia(), d.latitud(), d.longitud(), d.texto());
        }
    }

    record LineaDeCompraVista(Referencia producto, int unidades, DineroVista venta, List<String> pedidos) {
        static LineaDeCompraVista de(ListaDeCompras.Linea l) {
            return new LineaDeCompraVista(new Referencia(l.productoId()), l.unidades(), DineroVista.de(l.venta()), l.pedidos());
        }
    }

    record SemanaVista(String desde, int pedidos, DineroVista ventas) {}

    record TiendaCompradoraVista(Referencia tienda, int pedidos, DineroVista ventas) {}

    record TraccionVista(int pedidos, DineroVista ventas, DineroVista ticketPromedio, int tiendasActivas,
                         int tiendasQueRepiten, List<SemanaVista> semanas, List<TiendaCompradoraVista> tiendas) {
        static TraccionVista de(Traccion t) {
            return new TraccionVista(t.pedidos(), DineroVista.de(t.ventas()), DineroVista.de(t.ticketPromedio()),
                    t.tiendasActivas(), t.tiendasQueRepiten(),
                    t.semanas().stream().map(s -> new SemanaVista(s.desde().toString(), s.pedidos(), DineroVista.de(s.ventas()))).toList(),
                    t.tiendas().stream().map(x -> new TiendaCompradoraVista(new Referencia(x.tiendaId()), x.pedidos(), DineroVista.de(x.ventas()))).toList());
        }
    }

    record LineaEntrada(String productoId, Presentacion presentacion, int cantidad) {}

    record DireccionEntrada(String calle, String zona, String referencia, Double latitud, Double longitud) {
        DireccionDeEntrega aDominio() {
            return new DireccionDeEntrega(calle, zona, referencia, latitud, longitud);
        }
    }

    record CrearPedidoEntrada(UUID clave, String mayoristaId, MetodoPago metodoPago, List<LineaEntrada> lineas,
                              DireccionEntrada entrega) {}

    private final CrearPedido crear;
    private final DecidirPedido decidir;
    private final ConsultarPedidos consultar;
    private final EntregarPedido entregar;
    private final TransactionTemplate transaccion;

    PedidoController(CrearPedido crear, DecidirPedido decidir, ConsultarPedidos consultar, EntregarPedido entregar,
                     TransactionTemplate transaccion) {
        this.crear = crear;
        this.decidir = decidir;
        this.consultar = consultar;
        this.entregar = entregar;
        this.transaccion = transaccion;
    }

    @QueryMapping
    List<PedidoVista> misCompras(@Argument EstadoPedido estado, @AuthenticationPrincipal Jwt jwt) {
        return consultar.compras(org(jwt), estado).stream().map(PedidoVista::de).toList();
    }

    @QueryMapping
    List<PedidoVista> misVentas(@Argument EstadoPedido estado, @AuthenticationPrincipal Jwt jwt) {
        return consultar.ventas(org(jwt), estado).stream().map(PedidoVista::de).toList();
    }

    @QueryMapping
    PedidoVista pedido(@Argument UUID id, @AuthenticationPrincipal Jwt jwt) {
        return consultar.uno(id, org(jwt)).map(PedidoVista::de).orElse(null);
    }

    @MutationMapping
    PedidoVista crearPedido(@Argument CrearPedidoEntrada entrada, @AuthenticationPrincipal Jwt jwt) {
        var comando = new CrearPedido.Comando(entrada.clave(), org(jwt), entrada.mayoristaId(), entrada.metodoPago(),
                entrada.lineas().stream()
                        .map(l -> new CrearPedido.Linea(l.productoId(), l.presentacion(), l.cantidad()))
                        .toList(),
                entrada.entrega() == null ? null : entrada.entrega().aDominio());
        return PedidoVista.de(transaccion.execute(s -> crear.ejecutar(comando)));
    }

    @MutationMapping
    PedidoVista confirmarPedido(@Argument UUID id, @AuthenticationPrincipal Jwt jwt) {
        return PedidoVista.de(transaccion.execute(s -> decidir.confirmar(id, org(jwt))));
    }

    @MutationMapping
    PedidoVista rechazarPedido(@Argument UUID id, @Argument String motivo, @AuthenticationPrincipal Jwt jwt) {
        return PedidoVista.de(transaccion.execute(s -> decidir.rechazar(id, org(jwt), motivo)));
    }

    @MutationMapping
    PedidoVista avanzarEntrega(@Argument UUID id, @AuthenticationPrincipal Jwt jwt) {
        return PedidoVista.de(transaccion.execute(s -> entregar.avanzar(id, org(jwt))));
    }

    @QueryMapping
    List<LineaDeCompraVista> listaDeCompras(@AuthenticationPrincipal Jwt jwt) {
        return entregar.listaDeCompras(org(jwt)).stream().map(LineaDeCompraVista::de).toList();
    }

    /** Solo el equipo de Abasto (rol admin): los números de la plataforma o de un vendedor. */
    @QueryMapping
    TraccionVista traccion(@Argument String mayoristaId, @Argument Integer semanas, @AuthenticationPrincipal Jwt jwt) {
        if (!roles(jwt).contains("admin")) {
            throw new ErrorDeDominio("SOLO_ADMIN", "La tracción es solo para el equipo de Abasto");
        }
        return TraccionVista.de(entregar.traccion(mayoristaId, semanas == null ? 8 : Math.max(1, Math.min(semanas, 26))));
    }

    /** Federación: otro subgrafo (por ejemplo Cobros) pide un Pedido por su id. */
    @EntityMapping
    PedidoVista pedido(@Argument String id) {
        return consultar.porId(UUID.fromString(id)).map(PedidoVista::de).orElse(null);
    }

    @SuppressWarnings("unchecked")
    private static List<String> roles(Jwt jwt) {
        var acceso = jwt.getClaimAsMap("realm_access");
        return acceso == null ? List.of() : (List<String>) acceso.getOrDefault("roles", List.of());
    }

    private static String org(Jwt jwt) {
        return jwt.getClaimAsString("org_id");
    }
}
