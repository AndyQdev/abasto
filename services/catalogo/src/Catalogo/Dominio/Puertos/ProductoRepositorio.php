<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\Producto;

/** Puerto de salida. Lo implementa Infraestructura/Mongo; las pruebas usan uno en memoria. */
interface ProductoRepositorio
{
    public function porId(string $id): ?Producto;

    /** @return list<Producto> */
    public function deMayorista(string $mayoristaId, ?string $busqueda = null): array;

    /**
     * Productos activos de mayoristas verificados, para las tiendas.
     *
     * @return list<Producto>
     */
    public function publicados(?string $busqueda = null, ?string $mayoristaId = null): array;

    public function guardar(Producto $producto): void;

    public function siguienteId(): string;

    /** Descuenta el stock solo si alcanza, en una sola operación atómica. Devuelve false si no alcanzaba. */
    public function descontarStock(string $id, int $unidades): bool;

    public function devolverStock(string $id, int $unidades): void;
}
