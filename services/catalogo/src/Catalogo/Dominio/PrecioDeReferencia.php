<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * Objeto de valor: lo que cuesta una unidad al público en un supermercado, para que la tienda compare.
 * Siempre dice dónde y cuándo se tomó: un precio de referencia sin fecha engaña cuando cambia.
 * Ejemplo: Aceite Fino 900 ml, Bs 19,00 en Fidalga el 30/10/2026.
 */
final readonly class PrecioDeReferencia
{
    public function __construct(
        public int $centavos,
        public string $donde,
        /** aaaa-mm-dd */
        public string $fecha,
    ) {
        if ($centavos <= 0) {
            throw new ErrorDeDominio('REFERENCIA_INVALIDA', 'El precio de referencia tiene que ser mayor a cero');
        }
        if (trim($donde) === '') {
            throw new ErrorDeDominio('REFERENCIA_SIN_LUGAR', 'Falta dónde se tomó el precio de referencia');
        }
        $dia = \DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);
        if ($dia === false || $dia->format('Y-m-d') !== $fecha) {
            throw new ErrorDeDominio('REFERENCIA_SIN_FECHA', 'La fecha del precio de referencia tiene que ser aaaa-mm-dd');
        }
    }
}
