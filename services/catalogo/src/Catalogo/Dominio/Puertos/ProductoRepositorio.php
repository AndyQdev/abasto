<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\Producto;

/** Puerto de salida. Lo implementa Infraestructura/Mongo; las pruebas usan uno en memoria. */
interface ProductoRepositorio
{
    public function porId(string $id): ?Producto;

    /** El único producto del mayorista con ese código; null si no lo tiene. */
    public function porCodigo(string $mayoristaId, string $codigo): ?Producto;

    /** @return list<Producto> */
    public function deMayorista(string $mayoristaId, ?string $busqueda = null): array;

    /**
     * Productos activos de mayoristas verificados, para las tiendas.
     *
     * @return list<Producto>
     */
    public function publicados(?string $busqueda = null, ?string $mayoristaId = null): array;

    /**
     * Crea el producto o guarda sus datos. En un producto que ya existe NO toca el stock: el stock solo
     * cambia con descontarStock, devolverStock o fijarStock. Así editar el nombre no pisa una reserva
     * que la saga hizo entre la lectura y el guardado.
     */
    public function guardar(Producto $producto): void;

    /** El mayorista corrige el stock a mano: se guardan el stock y el estado que se deriva de él. */
    public function fijarStock(Producto $producto): void;

    public function siguienteId(): string;

    /** Descuenta el stock solo si alcanza, en una sola operación atómica. Devuelve false si no alcanzaba. */
    public function descontarStock(string $id, int $unidades): bool;

    public function devolverStock(string $id, int $unidades): void;
}
