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
use Catalogo\Dominio\PrecioDeReferencia;
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

    expect($catalogo)->toHaveCount(138)
        ->and(array_unique($codigos))->toHaveCount(138);
    foreach ($catalogo as $p) {
        // Construirlo valida las escalas (más volumen, más unidades y precio que no sube) y los usos
        new Producto($p['codigo'], 'abasto', $p['codigo'], $p['nombre'], $p['rubro'], '', 0, EstadoProducto::ACTIVO, $p['escalas'], usos: $p['usos']);
        $masBarato = min(array_map(static fn (EscalaDePrecio $e) => $e->precioUnitarioCentavos, $p['escalas']));
        expect($p['costo'])->toBeLessThan($masBarato, "{$p['nombre']} se vendería a pérdida")
            ->and($p['usos'])->not->toBeEmpty("{$p['nombre']} no se mostraría en ningún Inicio")
            // Ningún producto sin imagen: foto real o ilustración 3D (02/11)
            ->and(is_file(__DIR__."/../../database/fotos-abasto/{$p['codigo']}.webp"))->toBeTrue("{$p['nombre']} no tiene foto");
        if ($p['super'] === null) {
            // Nicho de cocina (01/11) y catálogo real (02/11): precio de demostración, sin comparación con el súper
            continue;
        }
        // «Más barato que en el súper» tiene que ser verdad para todo lo que vende Abasto
        $masCaro = max(array_map(static fn (EscalaDePrecio $e) => $e->precioUnitarioCentavos, $p['escalas']));
        expect($masCaro)->toBeLessThan($p['super'][0], "{$p['nombre']} sale más caro que en el súper");
    }
});

it('el precio del súper siempre dice dónde y cuándo se tomó', function () {
    $referencia = new PrecioDeReferencia(1900, 'Fidalga', '2026-10-30');

    expect($referencia->centavos)->toBe(1900)
        ->and(fn () => new PrecioDeReferencia(1900, ' ', '2026-10-30'))->toThrow(ErrorDeDominio::class, 'Falta dónde')
        ->and(fn () => new PrecioDeReferencia(1900, 'Fidalga', '30/10/2026'))->toThrow(ErrorDeDominio::class, 'aaaa-mm-dd')
        ->and(fn () => new PrecioDeReferencia(0, 'Fidalga', '2026-10-30'))->toThrow(ErrorDeDominio::class, 'mayor a cero');
});

it('la vista del producto trae la marca y el precio del súper', function () {
    $con = new Producto('AB-005', 'abasto', 'AB-005', 'Aceite Fino 900 ml', 'Abarrotes', '', 0, EstadoProducto::ACTIVO, [
        new EscalaDePrecio(Presentacion::UNIDAD, 1, 1750),
    ], Abastecimiento::BAJO_PEDIDO, 24, 1480, null, null, 'Fino', true, new PrecioDeReferencia(1900, 'Fidalga', '2026-10-30'));
    $this->productos->guardar($con);
    $vista = Vistas::producto((new ConsultarCatalogo($this->productos, $this->relaciones, $this->organizaciones))->uno('AB-005', 'dr'));

    expect($vista['marca'])->toBe('Fino')
        ->and($vista['marcaBoliviana'])->toBeTrue()
        ->and($vista['precioEnSuper'])->toMatchArray(['donde' => 'Fidalga', 'fecha' => '2026-10-30'])
        ->and($vista['precioEnSuper']['precio']['texto'])->toBe('Bs 19,00');
});

it('cada cliente ve lo suyo: el panadero no ve yogurt y la tienda no ve el balde de manteca', function () {
    $usosDe = array_column(SembrarAbasto::catalogo(), 'usos', 'codigo');

    expect($usosDe['AB-018'])->toBe(['hogar', 'tienda'])
        ->and($usosDe['AB-104'])->toBe(['panaderia'])
        ->and($usosDe['AB-106'])->not->toContain('tienda')
        ->and($usosDe['AB-115'])->toBe(Producto::USOS)
        // Las 6 áreas, la tienda y el hogar tienen productos
        ->and(array_values(array_unique(array_merge(...array_values($usosDe)))))->toEqualCanonicalizing(Producto::USOS);
});

it('los usos se validan y quedan sin repetidos, en el orden de siempre', function () {
    $producto = arrozDeAbasto();
    $producto->cambiarUsos(['Tienda', 'hogar', 'tienda']);

    expect($producto->usos())->toBe(['hogar', 'tienda'])
        ->and(fn () => $producto->cambiarUsos(['carniceria']))->toThrow(ErrorDeDominio::class);
});
