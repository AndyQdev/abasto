<?php

use Catalogo\Aplicacion\AjustarStock;
use Catalogo\Aplicacion\CrearProducto;
use Catalogo\Aplicacion\EditarProducto;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\Presentacion;
use Tests\Support\ProductosEnMemoria;

beforeEach(function () {
    $this->productos = new ProductosEnMemoria;
    $this->crear = new CrearProducto($this->productos);
    $this->editar = new EditarProducto($this->productos);
    $this->ajustar = new AjustarStock($this->productos);
});

function escalaDe(string $presentacion, int $unidades, int $precioUnitarioCentavos): EscalaDePrecio
{
    return new EscalaDePrecio(Presentacion::from($presentacion), $unidades, $precioUnitarioCentavos);
}

function escalasDeShampoo(): array
{
    return [escalaDe('DOCENA', 12, 2000), escalaDe('CAJA', 48, 1800)];
}

it('crea un producto activo con su código en mayúscula y sus escalas', function () {
    $producto = $this->crear->ejecutar('lp', 'hp-0400', 'Shampoo 400 ml', 'Higiene', 'Fabricado por Doble H', 24, escalasDeShampoo());

    expect($producto->codigo)->toBe('HP-0400')
        ->and($producto->mayoristaId)->toBe('lp')
        ->and($producto->stock)->toBe(24)
        ->and($producto->estado)->toBe(EstadoProducto::ACTIVO)
        ->and($this->productos->porId($producto->id)?->mayoristaId)->toBe('lp'); // quedó guardado
});

it('crea un producto sin stock y lo deja como SIN_STOCK', function () {
    $producto = $this->crear->ejecutar('lp', 'VD-4500', 'Vaso 450 ml', 'Desechables', '', 0, escalasDeShampoo());

    expect($producto->stock)->toBe(0)->and($producto->estado)->toBe(EstadoProducto::SIN_STOCK);
});

it('rechaza crear con un código que el mismo mayorista ya usa', function () {
    $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());

    expect(fn () => $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo igual', 'Higiene', '', 10, escalasDeShampoo()))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('CODIGO_REPETIDO'))
        ->and($this->productos->todos)->toHaveCount(1); // y no guarda el repetido
});

it('no confunde un mismo código entre mayoristas distintos', function () {
    $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());
    $otro = $this->crear->ejecutar('dr', 'HP-0400', 'Detergente 1 L', 'Limpieza', '', 10, escalasDeShampoo());

    expect($otro->mayoristaId)->toBe('dr')->and($this->productos->todos)->toHaveCount(2);
});

it('rechaza crear con escalas donde el precio sube con el volumen y no guarda nada', function () {
    expect(fn () => $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, [
        escalaDe('DOCENA', 12, 2000),
        escalaDe('CAJA', 48, 2100),
    ]))->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('PRECIO_SUBE_CON_VOLUMEN'))
        ->and($this->productos->todos)->toBeEmpty();
});

it('rechaza stock negativo al crear', function () {
    expect(fn () => $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', -1, escalasDeShampoo()))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('STOCK_INVALIDO'))
        ->and($this->productos->todos)->toBeEmpty();
});

it('rechaza crear sin código', function () {
    expect(fn () => $this->crear->ejecutar('lp', '   ', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo()))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('CODIGO_INVALIDO'));
});

it('rechaza editar el producto de otro mayorista y no le cambia nada', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());

    expect(fn () => $this->editar->ejecutar($producto->id, 'dr', nombre: 'Producto robado'))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('PRODUCTO_AJENO'))
        ->and($this->productos->porId($producto->id)?->nombre)->toBe('Shampoo 400 ml');
});

it('no edita un producto que no existe', function () {
    expect(fn () => $this->editar->ejecutar('fantasma', 'lp', nombre: 'Algo'))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('PRODUCTO_INEXISTENTE'));
});

it('edita solo los campos que envía el mayorista', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', 'Fabricado por Doble H', 24, escalasDeShampoo());

    $editado = $this->editar->ejecutar($producto->id, 'lp', nombre: 'Shampoo 100 ml', estado: EstadoProducto::PAUSADO);

    expect($editado->nombre)->toBe('Shampoo 100 ml')
        ->and($editado->codigo)->toBe('HP-0400')
        ->and($editado->rubro)->toBe('Higiene')
        ->and($editado->descripcion)->toBe('Fabricado por Doble H')
        ->and($editado->stock)->toBe(24)
        ->and($editado->estado)->toBe(EstadoProducto::PAUSADO)
        ->and($editado->escalas())->toEqual(escalasDeShampoo());
});

it('no deja fijar por edición los estados que se derivan del stock', function (EstadoProducto $derivado) {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());

    expect(fn () => $this->editar->ejecutar($producto->id, 'lp', estado: $derivado))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('ESTADO_INVALIDO'));
})->with([
    'pendiente de revisión' => EstadoProducto::PENDIENTE_DE_REVISION,
    'sin stock' => EstadoProducto::SIN_STOCK,
]);

it('deja las escalas nuevas cuando la edición las envía', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());

    $editado = $this->editar->ejecutar($producto->id, 'lp', escalas: [escalaDe('CAJA', 48, 1900)]);

    expect(count($editado->escalas()))->toBe(1)
        ->and($editado->escalaDe(Presentacion::CAJA)?->precioUnitarioCentavos)->toBe(1900)
        ->and($editado->escalaDe(Presentacion::DOCENA))->toBeNull();
});

it('rechaza en ajustar el stock de un producto ajeno o inexistente', function () {
    $propio = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());
    $ajeno = $this->crear->ejecutar('lp2', 'OTRO-1', 'Detergente 1 L', 'Limpieza', '', 24, escalasDeShampoo());

    expect(fn () => $this->ajustar->ejecutar($ajeno->id, 'lp', 1))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('PRODUCTO_AJENO'))
        ->and(fn () => $this->ajustar->ejecutar('fantasma', 'lp', 1))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('PRODUCTO_INEXISTENTE'))
        ->and($this->productos->porId($propio->id)?->stock)->toBe(24); // nada cambió de más
});

it('no acepta ajustar el stock a un número negativo', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());

    expect(fn () => $this->ajustar->ejecutar($producto->id, 'lp', -1))
        ->toThrow(fn (ErrorDeDominio $e) => expect($e->codigo)->toBe('STOCK_INVALIDO'))
        ->and($this->productos->porId($producto->id)?->stock)->toBe(24);
});

it('ajustar el stock a cero deja el producto sin stock', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());

    $ajustado = $this->ajustar->ejecutar($producto->id, 'lp', 0);

    expect($ajustado->stock)->toBe(0)->and($ajustado->estado)->toBe(EstadoProducto::SIN_STOCK);
});

it('reponerle stock a un producto sin stock lo vuelve a activar', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 0, escalasDeShampoo());
    expect($producto->estado)->toBe(EstadoProducto::SIN_STOCK);

    $ajustado = $this->ajustar->ejecutar($producto->id, 'lp', 12);

    expect($ajustado->stock)->toBe(12)->and($ajustado->estado)->toBe(EstadoProducto::ACTIVO);
});

it('subirle el stock a un producto pausado no lo reactiva', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 0, escalasDeShampoo());
    $this->editar->ejecutar($producto->id, 'lp', estado: EstadoProducto::PAUSADO);

    $ajustado = $this->ajustar->ejecutar($producto->id, 'lp', 60);

    expect($ajustado->stock)->toBe(60)->and($ajustado->estado)->toBe(EstadoProducto::PAUSADO);
});

it('un producto pausado que se queda sin stock sigue pausado', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24, escalasDeShampoo());
    $this->editar->ejecutar($producto->id, 'lp', estado: EstadoProducto::PAUSADO);

    $ajustado = $this->ajustar->ejecutar($producto->id, 'lp', 0);

    expect($ajustado->stock)->toBe(0)->and($ajustado->estado)->toBe(EstadoProducto::PAUSADO);
});

it('activar a mano un producto sin mercadería lo deja SIN_STOCK, no activo con 0', function () {
    $producto = $this->crear->ejecutar('lp', 'VD-4501', 'Vaso 450 ml', 'Desechables', '', 0, escalasDeShampoo());
    $producto = $this->editar->ejecutar($producto->id, 'lp', estado: EstadoProducto::ACTIVO);

    expect($producto->estado)->toBe(EstadoProducto::SIN_STOCK);
});

it('ajustar el stock lo guarda por la vía del stock, no con el guardado general', function () {
    $producto = $this->crear->ejecutar('lp', 'HP-0401', 'Shampoo 400 ml', 'Higiene', '', 10, escalasDeShampoo());
    $this->ajustar->ejecutar($producto->id, 'lp', 0);

    expect($this->productos->stockFijado)->toBe([$producto->id]);
});
