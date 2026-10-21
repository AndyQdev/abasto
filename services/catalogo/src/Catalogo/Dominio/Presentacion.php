<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/** Cómo se vende al por mayor. Mismo enum que en Pedidos (contrato del supergrafo). */
enum Presentacion: string
{
    case UNIDAD = 'UNIDAD';
    case CUARTA = 'CUARTA';
    case DOCENA = 'DOCENA';
    case CAJA = 'CAJA';
    case FARDO = 'FARDO';
}
