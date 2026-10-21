package bo.abasto.pedidos.dominio;

import java.util.Map;

/**
 * Lo que la saga necesita mandar. Un comando le pide algo a otro servicio (exchange abasto.comandos);
 * un evento cuenta algo que ya pasó (abasto.eventos). El tipo es también la routing key.
 * Los nombres y los datos de cada uno están en contracts/asyncapi.yaml.
 */
public record Mensaje(Clase clase, String tipo, Map<String, Object> datos) {

    public enum Clase { COMANDO, EVENTO }

    public static Mensaje comando(String tipo, Map<String, Object> datos) {
        return new Mensaje(Clase.COMANDO, tipo, datos);
    }

    public static Mensaje evento(String tipo, Map<String, Object> datos) {
        return new Mensaje(Clase.EVENTO, tipo, datos);
    }
}
