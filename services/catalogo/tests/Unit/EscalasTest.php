<?php

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;

function shampoo(array $escalas): Producto
{
    return new Producto('HP-0400', 'lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 312, EstadoProducto::ACTIVO, $escalas);
}

it('acepta una escala donde el precio baja con el volumen', function () {
    $p = shampoo([
        new EscalaDePrecio(Presentacion::CUARTA, 3, 2200),
        new EscalaDePrecio(Presentacion::DOCENA, 12, 2000),
        new EscalaDePrecio(Presentacion::CAJA, 48, 1800),
    ]);

    expect($p->escalaDe(Presentacion::CAJA)?->precioUnitarioCentavos)->toBe(1800);
});

it('rechaza un precio por unidad que sube al comprar más', function () {
    shampoo([
        new EscalaDePrecio(Presentacion::DOCENA, 12, 2000),
        new EscalaDePrecio(Presentacion::CAJA, 48, 2100),
    ]);
})->throws(ErrorDeDominio::class, 'no puede subir');

it('rechaza presentaciones repetidas', function () {
    shampoo([
        new EscalaDePrecio(Presentacion::CAJA, 24, 1900),
        new EscalaDePrecio(Presentacion::CAJA, 48, 1800),
    ]);
})->throws(ErrorDeDominio::class, 'dos veces');

it('rechaza escalas que no crecen en unidades', function () {
    shampoo([
        new EscalaDePrecio(Presentacion::CAJA, 48, 1800),
        new EscalaDePrecio(Presentacion::DOCENA, 12, 1700),
    ]);
})->throws(ErrorDeDominio::class, 'más unidades');

it('un producto sin precios no existe', function () {
    shampoo([]);
})->throws(ErrorDeDominio::class);

it('no acepta precios en cero', function () {
    new EscalaDePrecio(Presentacion::CAJA, 48, 0);
})->throws(ErrorDeDominio::class);
