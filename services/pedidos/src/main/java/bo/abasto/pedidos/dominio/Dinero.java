package bo.abasto.pedidos.dominio;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/** Objeto de valor: un monto en bolivianos, guardado en centavos. */
public record Dinero(long centavos) {

    public static final Dinero CERO = new Dinero(0);

    public Dinero sumar(Dinero otro) {
        return new Dinero(Math.addExact(centavos, otro.centavos));
    }

    public Dinero por(int cantidad) {
        return new Dinero(Math.multiplyExact(centavos, cantidad));
    }

    /** «Bs 1.728,00», igual que en todas las pantallas de Abasto. */
    public String texto() {
        var simbolos = new DecimalFormatSymbols(Locale.of("es", "BO"));
        simbolos.setGroupingSeparator('.');
        simbolos.setDecimalSeparator(',');
        return "Bs " + new DecimalFormat("#,##0.00", simbolos).format(centavos / 100.0);
    }
}
