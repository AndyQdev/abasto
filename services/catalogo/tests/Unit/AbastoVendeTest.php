<?php

declare(strict_types=1);

use App\Console\Commands\SembrarAbasto;
use Catalogo\Aplicacion\ConsultarCatalogo;
use Catalogo\Aplicacion\LiberarStock;
use Catalogo\Aplicacion\ReservarStock;
use Catalogo\Dominio\Abastecimiento;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\ListaDePrecios;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\PoliticaDePrecios;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\RelacionComercial;
use Catalogo\Infraestructura\GraphQL\Vistas;
use Tests\Support\EventosGrabados;
use Tests\Support\OrganizacionesEnMemoria;
use Tests\Support\ProductosEnMemoria;
use Tests\Support\RelacionesEnMemoria;
use Tests\Support\ReservasEnMemoria;

/** Abasto vendiendo por su cuenta: vendedor de la casa y productos bajo pedido (28/10/2026). */
function arrozDeAbasto(): Producto
{
    return new Producto('AB-001', 'abasto', 'AB-001', 'Arroz grano largo 1 kg', 'Abarrotes', '', 0, EstadoProducto::ACTIVO, [
        new EscalaDePrecio(Presentacion::DOCENA, 12, 820),
        new EscalaDePrecio(Presentacion::FARDO, 24, 790),
    ], Abastecimiento::BAJO_PEDIDO, 24, 735, 'Mercado Los Pozos');
}

beforeEach(function () {
    $this->productos = new ProductosEnMemoria;
    $this->relaciones = new RelacionesEnMemoria;
    $this->reservas = new ReservasEnMemoria;
    $this->eventos = new EventosGrabados;
    $this->organizaciones = new OrganizacionesEnMemoria;
    $this->organizaciones->guardar(new Organizacion('abasto', 'Abasto', 'mayorista', 'Santa Cruz', EstadoVerificacion::VERIFICADO, null, true));
    $this->organizaciones->guardar(new Organizacion('lp', 'Distribuidora Los Pozos', 'mayorista', 'Santa Cruz', EstadoVerificacion::VERIFICADO));
    $this->productos->guardar(arrozDeAbasto());
    $this->reservar = new ReservarStock($this->productos, $this->relaciones, $this->reservas, $this->eventos, $this->organizaciones);
    $this->liberar = new LiberarStock($this->productos, $this->reservas, $this->eventos);
});

it('el vendedor de la casa le muestra sus precios a cualquier tienda, sin pedir ser cliente', function () {
    $producto = arrozDeAbasto();

    expect(PoliticaDePrecios::escalasPara($producto, 'dr', null, deLaCasa: true))->toEqual($producto->escalas())
        ->and(PoliticaDePrecios::escalasPara($producto, 'dr', null))->toBeNull();
});

it('si Abasto le dio una lista a la tienda, se aplica su porcentaje', function () {
    $relacion = RelacionComercial::solicitar('dr', 'abasto');
    $relacion->aprobar(ListaDePrecios::VIP);

    $escalas = PoliticaDePrecios::escalasPara(arrozDeAbasto(), 'dr', $relacion, deLaCasa: true);

    expect($escalas[0]->precioUnitarioCentavos)->toBe(779); // 820 × 95 %
});

it('bajo pedido: reserva sin stock, con el precio de la casa, y liberar no inventa stock', function () {
    $this->reservar->ejecutar('p1', 'abasto', 'dr', [['productoId' => 'AB-001', 'presentacion' => 'FARDO', 'cantidad' => 2]]);

    expect($this->productos->todos['AB-001']->stock)->toBe(0)
        ->and($this->eventos->deTipo('stock.reservado')[0]['datos']['lineas'])->toBe([
            ['unidades' => 48, 'precioUnitarioCentavos' => 790],
        ]);

    $this->liberar->ejecutar('p1', 'abasto');

    expect($this->productos->todos['AB-001']->stock)->toBe(0)
        ->and($this->eventos->deTipo('stock.liberado'))->toHaveCount(1);
});

it('una tienda sin relación sigue sin poder comprarle a un mayorista que no es de la casa', function () {
    $this->productos->guardar(new Producto('HP-0400', 'lp', 'HP-0400', 'Shampoo', 'Higiene', '', 100, EstadoProducto::ACTIVO, [
        new EscalaDePrecio(Presentacion::DOCENA, 12, 2000),
    ]));

    $this->reservar->ejecutar('p2', 'lp', 'ec', [['productoId' => 'HP-0400', 'presentacion' => 'DOCENA', 'cantidad' => 1]]);

    expect($this->eventos->deTipo('stock.rechazado')[0]['datos']['motivo'])->toBe('La tienda no es cliente aprobado de este mayorista');
});

it('un producto bajo pedido nunca queda SIN_STOCK', function () {
    $producto = arrozDeAbasto();
    $producto->ajustarStock(0);
    expect($producto->estado)->toBe(EstadoProducto::ACTIVO);

    $conStock = new Producto('x', 'lp', 'X', 'X', 'R', '', 0, EstadoProducto::SIN_STOCK, [new EscalaDePrecio(Presentacion::DOCENA, 12, 100)]);
    $conStock->cambiarAbastecimiento(Abastecimiento::BAJO_PEDIDO, 24, 80, 'Mercado Mutualista');
    expect($conStock->estado)->toBe(EstadoProducto::ACTIVO);
});

it('el costo no puede ser negativo', function () {
    arrozDeAbasto()->cambiarAbastecimiento(Abastecimiento::BAJO_PEDIDO, 24, -1, null);
})->throws(ErrorDeDominio::class, 'El costo no puede ser negativo');

it('el costo y el proveedor solo los ve el dueño', function () {
    $consultar = new ConsultarCatalogo($this->productos, $this->relaciones, $this->organizaciones);

    $paraAbasto = Vistas::producto($consultar->uno('AB-001', 'abasto'));
    $paraTienda = Vistas::producto($consultar->uno('AB-001', 'dr'));

    expect($paraAbasto['costoUnitario']['texto'])->toBe('Bs 7,35')
        ->and($paraAbasto['proveedor'])->toBe('Mercado Los Pozos')
        ->and($paraTienda['costoUnitario'])->toBeNull()
        ->and($paraTienda['proveedor'])->toBeNull()
        ->and($paraTienda['precioVisible'])->toBeTrue()
        ->and($paraTienda['abastecimiento'])->toBe('BAJO_PEDIDO')
        ->and($paraTienda['mayorista']['deLaCasa'])->toBeTrue();
});

it('la semilla de Abasto: códigos únicos, escalas válidas y siempre con margen', function () {
    $catalogo = SembrarAbasto::catalogo();
    $codigos = array_column($catalogo, 'codigo');

    expect($catalogo)->toHaveCount(36)
        ->and(array_unique($codigos))->toHaveCount(36);
    foreach ($catalogo as $p) {
        // Construirlo valida las escalas (más volumen, más unidades y precio que no sube)
        new Producto($p['codigo'], 'abasto', $p['codigo'], $p['nombre'], $p['rubro'], '', 0, EstadoProducto::ACTIVO, $p['escalas']);
        $masBarato = min(array_map(static fn (EscalaDePrecio $e) => $e->precioUnitarioCentavos, $p['escalas']));
        expect($p['costo'])->toBeLessThan($masBarato, "{$p['nombre']} se vendería a pérdida");
    }
});
