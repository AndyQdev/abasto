<?php

// El repositorio de productos contra MongoDB real (base catalogo_pruebas). Necesita `pnpm infra`.

use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    DB::connection('mongodb')->getCollection('productos')->drop();
    $this->repositorio = app(ProductoRepositorio::class);
    $this->repositorio->guardar(new Producto('p1', 'lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 100, EstadoProducto::ACTIVO, [
        new EscalaDePrecio(Presentacion::CAJA, 48, 1800),
    ]));
});

it('editar con una copia vieja del producto no pisa el stock que reservó la saga', function () {
    $leido = $this->repositorio->porId('p1');
    $this->repositorio->descontarStock('p1', 48); // la saga reserva mientras el mayorista edita
    $leido->nombre = 'Shampoo 400 ml · Nuevo';
    $this->repositorio->guardar($leido);

    $ahora = $this->repositorio->porId('p1');
    expect($ahora->stock)->toBe(52)
        ->and($ahora->nombre)->toBe('Shampoo 400 ml · Nuevo');
});

it('fijar el stock sí reemplaza el stock y su estado', function () {
    $producto = $this->repositorio->porId('p1');
    $producto->ajustarStock(0);
    $this->repositorio->fijarStock($producto);

    $ahora = $this->repositorio->porId('p1');
    expect($ahora->stock)->toBe(0)
        ->and($ahora->estado)->toBe(EstadoProducto::SIN_STOCK);
});
