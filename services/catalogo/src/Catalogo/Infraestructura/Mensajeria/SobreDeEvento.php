<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mensajeria;

use DateTimeImmutable;
use DateTimeInterface;

/** El sobre común de contracts/asyncapi.yaml. El id sale del tipo y del pedido, no es aleatorio. */
final class SobreDeEvento
{
    /**
     * @param  array<string, mixed>  $datos
     * @return array<string, mixed>
     */
    public static function armar(string $tipo, string $pedidoId, string $orgId, array $datos, ?DateTimeImmutable $ahora = null): array
    {
        return [
            'id' => self::idDeterminista($tipo, $pedidoId),
            'tipo' => $tipo,
            'version' => 1,
            'ocurridoEn' => ($ahora ?? new DateTimeImmutable)->format(DateTimeInterface::ATOM),
            'correlationId' => $pedidoId,
            'orgId' => $orgId,
            'datos' => $datos,
        ];
    }

    /** UUID con forma de v5: el mismo tipo y pedido dan siempre el mismo id. */
    public static function idDeterminista(string $tipo, string $pedidoId): string
    {
        $h = sha1("catalogo:{$tipo}:{$pedidoId}");

        return sprintf(
            '%s-%s-5%s-%s%s-%s',
            substr($h, 0, 8),
            substr($h, 8, 4),
            substr($h, 13, 3),
            dechex((hexdec($h[16]) & 0x3) | 0x8),
            substr($h, 17, 3),
            substr($h, 20, 12),
        );
    }
}
