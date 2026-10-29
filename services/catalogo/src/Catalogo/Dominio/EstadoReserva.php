<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

enum EstadoReserva: string
{
    case RESERVADA = 'RESERVADA';
    case RECHAZADA = 'RECHAZADA';
    case LIBERADA = 'LIBERADA';
}
