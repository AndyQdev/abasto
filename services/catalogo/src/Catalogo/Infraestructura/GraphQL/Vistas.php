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
            'abastecimiento' => $p->abastecimiento->value,
            'entregaHoras' => $p->entregaHoras,
            // El costo y el proveedor son del mayorista: nadie más los ve
            'costoUnitario' => $vista->esDelDueno && $p->costoUnitarioCentavos !== null ? self::dinero($p->costoUnitarioCentavos) : null,
            'proveedor' => $vista->esDelDueno ? $p->proveedor : null,
            'foto' => $p->foto === null ? null : rtrim((string) config('catalogo.fotos_url'), '/').'/'.$p->foto,
            'marca' => $p->marca,
            'marcaBoliviana' => $p->marcaBoliviana,
            'precioEnSuper' => $p->precioEnSuper === null ? null : [
                'precio' => self::dinero($p->precioEnSuper->centavos),
                'donde' => $p->precioEnSuper->donde,
                'fecha' => $p->precioEnSuper->fecha,
            ],
            'precioPorConfirmar' => $p->precioPorConfirmar,
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
            'deLaCasa' => $o->deLaCasa ?? false,
        ];
    }

    /** @return array<string, mixed> */
    public static function solicitud(Organizacion $o): array
    {
        return [
            'id' => $o->id,
            'nombre' => $o->nombre,
            'nit' => $o->nit,
            'ciudad' => $o->ciudad,
            'representante' => $o->representante,
            'telefono' => $o->telefono,
            'correo' => $o->correo,
            'estadoVerificacion' => $o->verificacion->value,
            'motivoRechazo' => $o->motivoRechazo,
            'registradaEn' => $o->registradaEn,
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
