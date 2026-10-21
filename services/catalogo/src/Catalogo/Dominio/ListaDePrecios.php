<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * Lista de precios que el mayorista le asigna a cada cliente.
 * Hoy es un porcentaje fijo sobre la escala base. Que cada mayorista lo configure es una tarea de F1.
 */
enum ListaDePrecios: string
{
    case NUEVOS = 'NUEVOS';
    case FRECUENTES = 'FRECUENTES';
    case VIP = 'VIP';

    /** Porcentaje del precio base que paga el cliente: 100, 97 o 95. */
    public function porcentaje(): int
    {
        return match ($this) {
            self::NUEVOS => 100,
            self::FRECUENTES => 97,
            self::VIP => 95,
        };
    }
}
