package bo.abasto.pedidos.adaptadores.entrada.graphql;

import bo.abasto.pedidos.aplicacion.puertos.entrada.AtenderReclamos;
import bo.abasto.pedidos.dominio.ErrorDeDominio;
import bo.abasto.pedidos.dominio.Reclamo;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.BatchMapping;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.SchemaMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Adaptador de entrada (CU-16). La tienda sale del token, nunca de un argumento; ver y resolver todos los reclamos es
 * solo del equipo de Abasto. Un pedido muestra su reclamo a quien ya puede ver el pedido.
 */
@Controller
class ReclamoController {

    record ReclamoVista(String id, String pedidoId, Reclamo.Motivo motivo, String detalle, Reclamo.Estado estado,
                        String respuesta, PedidoController.DineroVista devuelto, Reclamo.FormaDeDevolucion forma,
                        String creadoEn, String resueltoEn) {
        static ReclamoVista de(Reclamo r) {
            return new ReclamoVista(r.id().toString(), r.pedidoId().toString(), r.motivo(), r.detalle(), r.estado(), r.respuesta(),
                    PedidoController.DineroVista.de(r.devuelto()), r.forma(), r.creadoEn().toString(),
                    r.resueltoEn() == null ? null : r.resueltoEn().toString());
        }
    }

    record AbrirReclamoEntrada(UUID pedidoId, Reclamo.Motivo motivo, String detalle) {}

    record ResolverReclamoEntrada(UUID reclamoId, boolean aprobado, Long devueltoCentavos,
                                  Reclamo.FormaDeDevolucion forma, String respuesta) {}

    private final AtenderReclamos reclamos;
    private final TransactionTemplate transaccion;

    ReclamoController(AtenderReclamos reclamos, TransactionTemplate transaccion) {
        this.reclamos = reclamos;
        this.transaccion = transaccion;
    }

    @MutationMapping
    ReclamoVista abrirReclamo(@Argument AbrirReclamoEntrada entrada, @AuthenticationPrincipal Jwt jwt) {
        var tienda = jwt.getClaimAsString("org_id");
        return ReclamoVista.de(transaccion.execute(s -> reclamos.abrir(entrada.pedidoId(), tienda, entrada.motivo(), entrada.detalle())));
    }

    @MutationMapping
    ReclamoVista resolverReclamo(@Argument ResolverReclamoEntrada entrada, @AuthenticationPrincipal Jwt jwt) {
        exigirAdmin(jwt);
        var resolucion = new AtenderReclamos.Resolucion(entrada.reclamoId(), entrada.aprobado(), entrada.devueltoCentavos(),
                entrada.forma(), entrada.respuesta(), jwt.getSubject());
        return ReclamoVista.de(transaccion.execute(s -> reclamos.resolver(resolucion)));
    }

    @QueryMapping
    List<ReclamoVista> reclamos(@Argument Reclamo.Estado estado, @AuthenticationPrincipal Jwt jwt) {
        exigirAdmin(jwt);
        return reclamos.listar(estado).stream().map(ReclamoVista::de).toList();
    }

    @SchemaMapping(typeName = "Reclamo", field = "pedido")
    PedidoController.PedidoVista pedido(ReclamoVista reclamo) {
        return reclamos.pedido(UUID.fromString(reclamo.pedidoId())).map(PedidoController.PedidoVista::de).orElse(null);
    }

    /** En lote: una lista de 100 pedidos hace una sola consulta. */
    @BatchMapping(typeName = "Pedido", field = "reclamo")
    Map<PedidoController.PedidoVista, ReclamoVista> reclamo(List<PedidoController.PedidoVista> pedidos) {
        var porPedido = reclamos.dePedidos(pedidos.stream().map(p -> UUID.fromString(p.id())).toList());
        var respuesta = new HashMap<PedidoController.PedidoVista, ReclamoVista>();
        for (var pedido : pedidos) {
            var reclamo = porPedido.get(UUID.fromString(pedido.id()));
            if (reclamo != null) {
                respuesta.put(pedido, ReclamoVista.de(reclamo));
            }
        }
        return respuesta;
    }

    @SuppressWarnings("unchecked")
    private static void exigirAdmin(Jwt jwt) {
        var acceso = jwt.getClaimAsMap("realm_access");
        var roles = acceso == null ? List.<String>of() : (List<String>) acceso.getOrDefault("roles", List.of());
        if (!roles.contains("admin")) {
            throw new ErrorDeDominio("SOLO_ADMIN", "Los reclamos los resuelve el equipo de Abasto");
        }
    }
}
