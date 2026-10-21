package bo.abasto.pedidos.adaptadores.entrada.http;

import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Mismo formato que /salud en los demás servicios, para que el Superadmin los lea igual. */
@RestController
class SaludController {

    @GetMapping("/salud")
    Map<String, String> salud() {
        return Map.of("servicio", "pedidos", "estado", "ok", "hora", Instant.now().toString());
    }
}
