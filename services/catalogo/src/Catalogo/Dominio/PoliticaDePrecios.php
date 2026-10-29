<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * Servicio de dominio de la red privada: decide qué precio ve quién.
 *   - El mayorista ve siempre sus precios base.
 *   - Una tienda aprobada ve la escala con el porcentaje de su lista.
 *   - Abasto, el vendedor de la casa, le muestra sus precios base a cualquier tienda registrada
 *     (y la lista que tenga si la aprobó con una).
 *   - Cualquier otra tienda no ve precios (null).
 */
final class PoliticaDePrecios
{
    /** @return list<EscalaDePrecio>|null */
    public static function escalasPara(Producto $producto, string $orgId, ?RelacionComercial $relacion, bool $deLaCasa = false): ?array
    {
        if ($producto->mayoristaId === $orgId) {
            return $producto->escalas();
        }
        if ($relacion !== null && $relacion->permiteVerPrecios()) {
            $porcentaje = $relacion->lista()?->porcentaje() ?? 100;

            return array_map(static fn (EscalaDePrecio $e) => $e->conPorcentaje($porcentaje), $producto->escalas());
        }

        return $deLaCasa ? $producto->escalas() : null;
    }
}
