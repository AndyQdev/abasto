package bo.abasto.pedidos.dominio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class DireccionDeEntregaTest {

    @Test
    void limpia_los_espacios_y_arma_el_texto() {
        var d = new DireccionDeEntrega("  Av. Banzer 123 ", " Equipetrol ", null, -17.76, -63.18);
        assertThat(d.calle()).isEqualTo("Av. Banzer 123");
        assertThat(d.referencia()).isEmpty();
        assertThat(d.texto()).isEqualTo("Av. Banzer 123, Equipetrol");
        assertThat(d.tienePunto()).isTrue();
        assertThat(new DireccionDeEntrega("Bolívar 55", "", "", null, null).texto()).isEqualTo("Bolívar 55");
    }

    @Test
    void sin_calle_no_hay_direccion() {
        assertThatThrownBy(() -> new DireccionDeEntrega("  ", "Centro", "", null, null))
                .isInstanceOf(ErrorDeDominio.class).hasMessageContaining("calle");
    }

    @Test
    void el_punto_del_mapa_va_completo_y_en_rango() {
        assertThatThrownBy(() -> new DireccionDeEntrega("Bolívar 55", "", "", -17.7, null))
                .isInstanceOf(ErrorDeDominio.class);
        assertThatThrownBy(() -> new DireccionDeEntrega("Bolívar 55", "", "", 120.0, -63.0))
                .isInstanceOf(ErrorDeDominio.class);
    }
}
