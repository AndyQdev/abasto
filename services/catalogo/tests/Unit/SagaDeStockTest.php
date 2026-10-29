<?php

use Catalogo\Aplicacion\LiberarStock;
use Catalogo\Aplicacion\ReservarStock;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoReserva;
use Catalogo\Dominio\ListaDePrecios;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\RelacionComercial;
use Catalogo\Infraestructura\Mensajeria\DespachadorDeComandos;
use Catalogo\Infraestructura\Mensajeria\SobreDeEvento;
use Tests\Support\EventosGrabados;
use Tests\Support\ProductosEnMemoria;
use Tests\Support\RelacionesEnMemoria;
use Tests\Support\ReservasEnMemoria;

beforeEach(function () {
    $this->productos = new ProductosEnMemoria;
    $this->relaciones = new RelacionesEnMemoria;
    $this->reservas = new ReservasEnMemoria;
    $this->eventos = new EventosGrabados;

    $this->productos->guardar(new Producto('shampoo', 'lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 312, EstadoProducto::ACTIVO, [
        new EscalaDePrecio(Presentacion::DOCENA, 12, 2000),
        new EscalaDePrecio(Presentacion::CAJA, 48, 1800),
    ]));
    $this->productos->guardar(new Producto('jabon', 'lp', 'HJ-0110', 'Jabón 110 g', 'Higiene', '', 100, EstadoProducto::ACTIVO, [
        new EscalaDePrecio(Presentacion::CAJA, 72, 300),
    ]));
    $this->productos->guardar(new Producto('pausado', 'lp', 'LD-2000', 'Detergente 2 L', 'Limpieza', '', 500, EstadoProducto::PAUSADO, [
        new EscalaDePrecio(Presentacion::CAJA, 24, 2200),
    ]));

    $relacion = RelacionComercial::solicitar('dr', 'lp');
    $relacion->aprobar(ListaDePrecios::VIP);
    $this->relaciones->guardar($relacion);

    $this->reservar = new ReservarStock($this->productos, $this->relaciones, $this->reservas, $this->eventos);
    $this->liberar = new LiberarStock($this->productos, $this->reservas, $this->eventos);
});

function lineaDe(string $productoId, string $presentacion, int $cantidad): array
{
    return ['productoId' => $productoId, 'presentacion' => $presentacion, 'cantidad' => $cantidad];
}

it('reserva el stock y responde con las unidades y el precio de la lista de la tienda', function () {
    $this->reservar->ejecutar('p1', 'lp', 'dr', [lineaDe('shampoo', 'CAJA', 2), lineaDe('jabon', 'CAJA', 1)]);

    expect($this->productos->todos['shampoo']->stock)->toBe(312 - 96)
        ->and($this->productos->todos['jabon']->stock)->toBe(100 - 72)
        ->and($this->eventos->enviados)->toHaveCount(1)
        ->and($this->eventos->enviados[0]['tipo'])->toBe('stock.reservado')
        ->and($this->eventos->enviados[0]['orgId'])->toBe('lp')
        ->and($this->eventos->enviados[0]['datos']['lineas'])->toBe([
            ['unidades' => 96, 'precioUnitarioCentavos' => 1710], // 1800 con lista VIP (95 %)
            ['unidades' => 72, 'precioUnitarioCentavos' => 285],
        ]);
});

it('rechaza si no alcanza el stock y no deja nada descontado', function () {
    $this->reservar->ejecutar('p2', 'lp', 'dr', [lineaDe('jabon', 'CAJA', 1), lineaDe('shampoo', 'CAJA', 7)]);

    expect($this->productos->todos['jabon']->stock)->toBe(100)
        ->and($this->productos->todos['shampoo']->stock)->toBe(312)
        ->and($this->eventos->enviados[0]['tipo'])->toBe('stock.rechazado')
        ->and($this->eventos->enviados[0]['datos']['motivo'])->toContain('Shampoo 400 ml');
});

it('rechaza si la tienda no es cliente aprobado del mayorista', function () {
    $this->reservar->ejecutar('p3', 'lp', 'ec', [lineaDe('shampoo', 'CAJA', 1)]);

    expect($this->productos->todos['shampoo']->stock)->toBe(312)
        ->and($this->eventos->enviados[0]['tipo'])->toBe('stock.rechazado');
});

it('rechaza productos pausados, ajenos, inexistentes o con presentación que no se vende', function (string $producto, string $presentacion) {
    $this->reservar->ejecutar('p4', 'lp', 'dr', [lineaDe($producto, $presentacion, 1)]);

    expect($this->eventos->enviados[0]['tipo'])->toBe('stock.rechazado');
})->with([
    'pausado' => ['pausado', 'CAJA'],
    'no existe' => ['fantasma', 'CAJA'],
    'presentación que no tiene' => ['jabon', 'DOCENA'],
    'presentación inválida' => ['jabon', 'MONTON'],
]);

it('rechaza un pedido sin líneas', function () {
    $this->reservar->ejecutar('p5', 'lp', 'dr', []);

    expect($this->eventos->enviados[0]['tipo'])->toBe('stock.rechazado');
});

it('el mismo comando dos veces no descuenta dos veces y repite la respuesta', function () {
    $this->reservar->ejecutar('p6', 'lp', 'dr', [lineaDe('shampoo', 'CAJA', 1)]);
    $this->reservar->ejecutar('p6', 'lp', 'dr', [lineaDe('shampoo', 'CAJA', 1)]);

    expect($this->productos->todos['shampoo']->stock)->toBe(312 - 48)
        ->and($this->eventos->enviados)->toHaveCount(2)
        ->and($this->eventos->enviados[1])->toBe($this->eventos->enviados[0]);
});

it('liberar devuelve el stock apartado y responde stock.liberado', function () {
    $this->reservar->ejecutar('p7', 'lp', 'dr', [lineaDe('shampoo', 'CAJA', 2)]);
    $this->liberar->ejecutar('p7', 'lp');

    expect($this->productos->todos['shampoo']->stock)->toBe(312)
        ->and($this->reservas->de('p7')->estado())->toBe(EstadoReserva::LIBERADA)
        ->and(end($this->eventos->enviados)['tipo'])->toBe('stock.liberado');
});

it('liberar dos veces no devuelve el stock dos veces', function () {
    $this->reservar->ejecutar('p8', 'lp', 'dr', [lineaDe('shampoo', 'CAJA', 2)]);
    $this->liberar->ejecutar('p8', 'lp');
    $this->liberar->ejecutar('p8', 'lp');

    expect($this->productos->todos['shampoo']->stock)->toBe(312);
});

it('liberar un pedido sin reserva no toca el stock pero deja cerrar la saga', function () {
    $this->liberar->ejecutar('nunca', 'lp');

    expect($this->productos->todos['shampoo']->stock)->toBe(312)
        ->and($this->eventos->enviados[0]['tipo'])->toBe('stock.liberado');
});

it('una reserva liberada no se vuelve a reservar ni a anunciar', function () {
    $this->reservar->ejecutar('p9', 'lp', 'dr', [lineaDe('shampoo', 'CAJA', 1)]);
    $this->liberar->ejecutar('p9', 'lp');
    $antes = count($this->eventos->enviados);

    $this->reservar->ejecutar('p9', 'lp', 'dr', [lineaDe('shampoo', 'CAJA', 1)]);

    expect($this->productos->todos['shampoo']->stock)->toBe(312)
        ->and($this->eventos->enviados)->toHaveCount($antes);
});

it('el despachador traduce los comandos del contrato', function () {
    $despachador = new DespachadorDeComandos($this->reservar, $this->liberar);
    $sobre = static fn (string $tipo, array $datos) => json_encode(['id' => 'x', 'tipo' => $tipo, 'orgId' => 'lp', 'datos' => $datos]);

    $despachador->despachar($sobre('catalogo.reservar_stock', [
        'pedidoId' => 'p10', 'mayoristaId' => 'lp', 'tiendaId' => 'dr',
        'lineas' => [lineaDe('shampoo', 'CAJA', 1)],
    ]));
    expect($this->eventos->enviados[0]['tipo'])->toBe('stock.reservado');

    $despachador->despachar($sobre('catalogo.liberar_stock', ['pedidoId' => 'p10']));
    expect($this->productos->todos['shampoo']->stock)->toBe(312);
});

it('el despachador rechaza mensajes mal formados o desconocidos', function (string $cuerpo) {
    $despachador = new DespachadorDeComandos($this->reservar, $this->liberar);

    expect(fn () => $despachador->despachar($cuerpo))->toThrow(InvalidArgumentException::class);
})->with([
    'no es JSON' => ['esto no es json'],
    'sin datos' => ['{"tipo":"catalogo.reservar_stock"}'],
    'sin pedidoId' => ['{"tipo":"catalogo.reservar_stock","orgId":"lp","datos":{}}'],
    'comando desconocido' => ['{"tipo":"catalogo.baila","orgId":"lp","datos":{"pedidoId":"p"}}'],
]);

it('el id del mensaje es estable para un mismo tipo y pedido', function () {
    $a = SobreDeEvento::idDeterminista('stock.reservado', 'p1');

    expect($a)->toBe(SobreDeEvento::idDeterminista('stock.reservado', 'p1'))
        ->and($a)->not->toBe(SobreDeEvento::idDeterminista('stock.liberado', 'p1'))
        ->and($a)->toMatch('/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/');
});
