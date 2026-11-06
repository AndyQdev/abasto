<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\GraphQL;

use Catalogo\Aplicacion\VistaDeProducto;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\NegocioDelCliente;
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
            'usos' => $p->usos(),
        ];
    }

    /**
     * Un producto que ya no está en el catálogo (o que nunca estuvo) pero que figura en un pedido viejo.
     * Sin esto, el Router no puede completar Producto.nombre y anula la lista entera de pedidos (Panel › Pedidos vacío).
     *
     * @return array<string, mixed>
     */
    public static function productoQueYaNoEsta(string $id): array
    {
        return [
            'id' => $id,
            'codigo' => $id,
            'nombre' => "Producto que ya no está en el catálogo ({$id})",
            'rubro' => '',
            'descripcion' => '',
            'stock' => 0,
            'estado' => 'PAUSADO',
            'mayorista' => self::mayorista(null, ''),
            'precioVisible' => false,
            'escalas' => [],
            'abastecimiento' => 'STOCK',
            'entregaHoras' => null,
            'costoUnitario' => null,
            'proveedor' => null,
            'foto' => null,
            'marca' => null,
            'marcaBoliviana' => false,
            'precioEnSuper' => null,
            'precioPorConfirmar' => false,
            'usos' => [],
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
            'dePrueba' => $o->dePrueba ?? false,
        ];
    }

    /** @return array{tipo: string, subtipo: string|null, elegidoEn: string}|null */
    public static function negocio(?NegocioDelCliente $n): ?array
    {
        return $n === null ? null : ['tipo' => $n->tipo, 'subtipo' => $n->subtipo, 'elegidoEn' => $n->elegidoEn];
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
    public static function tiendaDeAbasto(Organizacion $o): array
    {
        return [
            'id' => $o->id,
            'nombre' => $o->nombre,
            'ciudad' => $o->ciudad,
            'telefono' => $o->telefono,
            'registradaEn' => $o->registradaEn,
            'dePrueba' => $o->dePrueba,
            'suspendida' => $o->suspendida,
            'motivoSuspension' => $o->motivoSuspension,
            'negocio' => self::negocio($o->negocio),
        ];
    }

    /** @return array<string, mixed> */
    public static function tienda(?Organizacion $o, string $id): array
    {
        return ['id' => $id, 'nombre' => $o->nombre ?? $id, 'ciudad' => $o->ciudad ?? '', 'negocio' => self::negocio($o?->negocio)];
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
