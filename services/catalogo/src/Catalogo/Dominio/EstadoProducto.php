<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

enum EstadoProducto: string
{
    case ACTIVO = 'ACTIVO';
    case PAUSADO = 'PAUSADO';
    case SIN_STOCK = 'SIN_STOCK';
    case PENDIENTE_DE_REVISION = 'PENDIENTE_DE_REVISION';
}
