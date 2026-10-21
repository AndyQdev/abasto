package bo.abasto.pedidos.configuracion;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Solo /salud se consulta desde el navegador (Superadmin). El GraphQL lo llama el Router, no el navegador. */
@Configuration
class CorsConfig implements WebMvcConfigurer {

    @Value("${abasto.origenes-permitidos:http://localhost:5174}")
    private String[] origenes;

    @Override
    public void addCorsMappings(CorsRegistry registro) {
        registro.addMapping("/salud").allowedOrigins(origenes).allowedMethods("GET");
    }
}
