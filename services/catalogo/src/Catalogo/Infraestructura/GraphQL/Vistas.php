<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\GraphQL;

use Catalogo\Aplicacion\VistaDeProducto;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\RelacionComercial;

/** Traduce los objetos del dominio a la forma del esquema GraphQL. */
final class Vistas
{
    /** @return array<string, mixed> */
    public static function dinero(int $centavos): array
    {
        return [
            'centavos' => $centavos,
            'moneda' => 'BOB',
            'texto' => 'Bs '.number_format($centavos / 100, 2, ',', '.'),
        ];
    }

    /** @return array<string, mixed> */
    public static function producto(VistaDeProducto $vista): array
    {
        $p = $vista->producto;
        $visibles = $vista->escalasVisibles;

        return [
            'id' => $p->id,
            'codigo' => $p->codigo,
            'nombre' => $p->nombre,
            'rubro' => $p->rubro,
            'descripcion' => $p->descripcion,
            'stock' => $p->stock,
            'estado' => $p->estado->value,
            'mayorista' => self::mayorista($vista->mayorista, $p->mayoristaId, $vista->relacion->value),
            'precioVisible' => $visibles !== null,
            'escalas' => array_map(static function (EscalaDePrecio $base) use ($visibles) {
                $visible = null;
                foreach ($visibles ?? [] as $e) {
                    if ($e->presentacion === $base->presentacion) {
                        $visible = $e;
                    }
                }

                return [
                    'presentacion' => $base->presentacion->value,
                    'cantidad' => $base->unidades,
                    'precioUnitario' => $visible === null ? null : self::dinero($visible->precioUnitarioCentavos),
                ];
            }, $p->escalas()),
        ];
    }

    /** @return array<string, mixed> */
    public static function mayorista(?Organizacion $o, string $id, string $relacion = 'NINGUNA'): array
    {
        return [
            'id' => $id,
            'nombre' => $o->nombre ?? $id,
            'ciudad' => $o->ciudad ?? '',
            'verificado' => $o?->estaVerificada() ?? false,
            'estadoVerificacion' => ($o->verificacion ?? EstadoVerificacion::PENDIENTE)->value,
            'relacion' => $relacion,
        ];
    }

    /** @return array<string, mixed> */
    public static function tienda(?Organizacion $o, string $id): array
    {
        return ['id' => $id, 'nombre' => $o->nombre ?? $id, 'ciudad' => $o->ciudad ?? ''];
    }

    /** @return array<string, mixed> */
    public static function relacion(RelacionComercial $r, ?Organizacion $tienda, ?Organizacion $mayorista): array
    {
        return [
            'tienda' => self::tienda($tienda, $r->tiendaId),
            'mayorista' => self::mayorista($mayorista, $r->mayoristaId, $r->estado()->value),
            'estado' => $r->estado()->value,
            'lista' => $r->lista()?->value,
        ];
    }
}
