<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;

final class ProductosEnMemoria implements ProductoRepositorio
{
    /** @var array<string, Producto> */
    public array $todos = [];

    public function porId(string $id): ?Producto
    {
        return $this->todos[$id] ?? null;
    }

    public function porCodigo(string $mayoristaId, string $codigo): ?Producto
    {
        foreach ($this->todos as $producto) {
            if ($producto->mayoristaId === $mayoristaId && $producto->codigo === $codigo) {
                return $producto;
            }
        }

        return null;
    }

    public function deMayorista(string $mayoristaId, ?string $busqueda = null): array
    {
        return array_values($this->todos);
    }

    public function publicados(?string $busqueda = null, ?string $mayoristaId = null): array
    {
        return array_values($this->todos);
    }

    public function guardar(Producto $producto): void
    {
        $this->todos[$producto->id] = $producto;
    }

    public function siguienteId(): string
    {
        return 'id-'.count($this->todos);
    }

    public function descontarStock(string $id, int $unidades): bool
    {
        if ($this->todos[$id]->stock < $unidades) {
            return false;
        }
        $this->todos[$id]->stock -= $unidades;

        return true;
    }

    public function devolverStock(string $id, int $unidades): void
    {
        $this->todos[$id]->stock += $unidades;
    }
}
