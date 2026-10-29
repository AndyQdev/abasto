package bo.abasto.pedidos.dominio;

/**
 * Cómo paga la tienda.
 * QR y CREDITO pasan por Cobros en la saga; CONTRA_ENTREGA se paga al recibir (efectivo o QR),
 * así que la saga no cobra nada antes de que el mayorista confirme.
 */
public enum MetodoPago {
    QR, CREDITO, CONTRA_ENTREGA
}
