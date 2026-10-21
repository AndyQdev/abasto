<?php

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoRelacion;
use Catalogo\Dominio\ListaDePrecios;
use Catalogo\Dominio\PoliticaDePrecios;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\RelacionComercial;

beforeEach(function () {
    $this->producto = new Producto('HP-0400', 'lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 312, EstadoProducto::ACTIVO, [
        new EscalaDePrecio(Presentacion::DOCENA, 12, 2000),
        new EscalaDePrecio(Presentacion::CAJA, 48, 1800),
    ]);
});

it('una tienda que no es cliente no ve precios', function () {
    expect(PoliticaDePrecios::escalasPara($this->producto, 'dr', null))->toBeNull();
});

it('una solicitud pendiente todavía no deja ver precios', function () {
    $relacion = RelacionComercial::solicitar('dr', 'lp');
    expect(PoliticaDePrecios::escalasPara($this->producto, 'dr', $relacion))->toBeNull();
});

it('una tienda aprobada ve la escala con el porcentaje de su lista', function () {
    $relacion = RelacionComercial::solicitar('dr', 'lp');
    $relacion->aprobar(ListaDePrecios::VIP);

    $escalas = PoliticaDePrecios::escalasPara($this->producto, 'dr', $relacion);

    expect(array_map(fn ($e) => $e->precioUnitarioCentavos, $escalas))->toBe([1900, 1710]);
});

it('el mayorista siempre ve sus precios base', function () {
    $escalas = PoliticaDePrecios::escalasPara($this->producto, 'lp', null);
    expect($escalas[1]->precioUnitarioCentavos)->toBe(1800);
});

it('rechazar quita la lista y vuelve a ocultar los precios', function () {
    $relacion = RelacionComercial::solicitar('dr', 'lp');
    $relacion->aprobar(ListaDePrecios::NUEVOS);
    $relacion->rechazar();

    expect($relacion->estado())->toBe(EstadoRelacion::RECHAZADA)
        ->and(PoliticaDePrecios::escalasPara($this->producto, 'dr', $relacion))->toBeNull();
});

it('una empresa no puede ser cliente de sí misma', function () {
    RelacionComercial::solicitar('lp', 'lp');
})->throws(ErrorDeDominio::class);
