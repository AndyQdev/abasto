<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * De dónde sale la mercadería.
 *   - STOCK: el mayorista la tiene en su depósito; reservar descuenta stock.
 *   - BAJO_PEDIDO: se compra cuando entra el pedido (Abasto al empezar). No hay stock que descontar
 *     y el producto sigue a la venta aunque el stock sea 0.
 */
enum Abastecimiento: string
{
    case STOCK = 'STOCK';
    case BAJO_PEDIDO = 'BAJO_PEDIDO';
}
