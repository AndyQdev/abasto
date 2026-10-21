<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

enum EstadoRelacion: string
{
    case NINGUNA = 'NINGUNA';
    case SOLICITADA = 'SOLICITADA';
    case APROBADA = 'APROBADA';
    case RECHAZADA = 'RECHAZADA';
}
