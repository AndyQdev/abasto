<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

enum EstadoVerificacion: string
{
    case PENDIENTE = 'PENDIENTE';
    case VERIFICADO = 'VERIFICADO';
    case RECHAZADO = 'RECHAZADO';
}
