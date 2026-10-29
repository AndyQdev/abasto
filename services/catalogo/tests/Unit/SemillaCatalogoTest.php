<?php

declare(strict_types=1);

use App\Console\Commands\SembrarCatalogo;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;

it('trae 40 productos con códigos únicos', function () {
    $productos = SembrarCatalogo::productosDemo();
    $codigos = array_column($productos, 'codigo');

    expect($productos)->toHaveCount(40)
        ->and($codigos)->toHaveCount(40)
        ->and(array_unique($codigos))->toHaveCount(40);
});

it('da a cada producto cuarta, docena y caja con el precio bajando', function () {
    foreach (SembrarCatalogo::productosDemo() as $p) {
        $escalas = $p['escalas'];

        expect($escalas)->toHaveCount(3)
            ->and(array_map(static fn (EscalaDePrecio $e): Presentacion => $e->presentacion, $escalas))
            ->toBe([Presentacion::CUARTA, Presentacion::DOCENA, Presentacion::CAJA]);

        [$cuarta, $docena, $caja] = $escalas;
        expect($cuarta->precioUnitarioCentavos)->toBeGreaterThan($docena->precioUnitarioCentavos)
            ->and($docena->precioUnitarioCentavos)->toBeGreaterThan($caja->precioUnitarioCentavos);
    }
});

it('arma cada producto sin violar las reglas del dominio', function () {
    foreach (SembrarCatalogo::productosDemo() as $p) {
        $producto = new Producto($p['codigo'], $p['mayorista'], $p['codigo'], $p['nombre'], $p['rubro'], '', $p['stock'], $p['estado'], $p['escalas']);

        expect($producto->escalaDe(Presentacion::CAJA))->not->toBeNull();
    }
});

it('deja la mayoría activa y mezcla los demás estados', function () {
    $productos = SembrarCatalogo::productosDemo();
    $estados = array_count_values(array_map(static fn (array $p): string => $p['estado']->value, $productos));

    expect($estados[EstadoProducto::ACTIVO->value] ?? 0)->toBeGreaterThan(20)
        ->and($estados[EstadoProducto::SIN_STOCK->value] ?? 0)->toBeGreaterThan(0)
        ->and($estados[EstadoProducto::PAUSADO->value] ?? 0)->toBeGreaterThan(0)
        ->and($estados[EstadoProducto::PENDIENTE_DE_REVISION->value] ?? 0)->toBeGreaterThan(0);

    foreach ($productos as $p) {
        if ($p['estado'] === EstadoProducto::SIN_STOCK) {
            expect($p['stock'])->toBe(0);
        }
    }
});

it('reparte los productos entre Los Pozos y La Ramada con Los Pozos de mayoría', function () {
    $porMayorista = array_count_values(array_map(static fn (array $p): string => $p['mayorista'], SembrarCatalogo::productosDemo()));
    $mayoristas = array_keys($porMayorista);
    sort($mayoristas);

    expect($mayoristas)->toBe(['lp', 'lr'])
        ->and($porMayorista['lp'])->toBeGreaterThan($porMayorista['lr']);
});
