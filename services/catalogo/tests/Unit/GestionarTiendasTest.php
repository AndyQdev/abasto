<?php

declare(strict_types=1);

use Catalogo\Aplicacion\EntrarConTelefono;
use Catalogo\Aplicacion\GestionarTiendas;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Organizacion;
use Tests\Support\CodigosEnMemoria;
use Tests\Support\CuentasEnMemoria;
use Tests\Support\OrganizacionesEnMemoria;

/** Superadmin › Tiendas: ver quién compra y suspender una cuenta. */
beforeEach(function () {
    $this->organizaciones = new OrganizacionesEnMemoria;
    $this->cuentas = new CuentasEnMemoria;
    $this->tiendas = new GestionarTiendas($this->organizaciones, $this->cuentas);
    $this->organizaciones->guardar(new Organizacion('t1', 'Tienda Rosa', 'tienda', 'Santa Cruz', EstadoVerificacion::VERIFICADO, telefono: '59171234567', registradaEn: '2026-11-01T10:00:00+00:00'));
    $this->organizaciones->guardar(new Organizacion('t2', 'Minimarket Luz', 'tienda', 'La Paz', EstadoVerificacion::VERIFICADO, registradaEn: '2026-11-05T10:00:00+00:00'));
    $this->organizaciones->guardar(new Organizacion('m1', 'Mayorista', 'mayorista', 'Santa Cruz', EstadoVerificacion::VERIFICADO));
    $this->cuentas->crear('59171234567', 'c@abasto.bo', 'x', 'Rosa', '', 't1', 'Tienda Rosa', 'tienda');
});

it('lista solo las tiendas, las más nuevas primero', function () {
    expect(array_map(static fn ($o) => $o->id, $this->tiendas->listar()))->toBe(['t2', 't1']);
});

it('busca por nombre sin importar mayúsculas', function () {
    expect(array_map(static fn ($o) => $o->id, $this->tiendas->listar('rosa')))->toBe(['t1']);
});

it('suspender guarda el motivo y apaga su cuenta', function () {
    $tienda = $this->tiendas->suspender('t1', ' No paga sus pedidos ');

    expect($tienda->suspendida)->toBeTrue()
        ->and($tienda->motivoSuspension)->toBe('No paga sus pedidos')
        ->and($this->organizaciones->porId('t1')?->suspendida)->toBeTrue()
        ->and($this->cuentas->apagadas)->toBe(['59171234567']);
});

it('reactivar vuelve a dejarla comprar y prende su cuenta', function () {
    $this->tiendas->suspender('t1', 'No paga sus pedidos');
    $tienda = $this->tiendas->reactivar('t1');

    expect($tienda->suspendida)->toBeFalse()
        ->and($tienda->motivoSuspension)->toBeNull()
        ->and($this->cuentas->apagadas)->toBe([]);
});

it('una tienda sin celular ni correo igual se suspende', function () {
    expect($this->tiendas->suspender('t2', 'Datos falsos')->suspendida)->toBeTrue();
});

it('pide el motivo para suspender', function () {
    $this->tiendas->suspender('t1', ' ');
})->throws(ErrorDeDominio::class, 'Escribe por qué se suspende');

it('no suspende a un mayorista ni a una tienda que no existe', function (string $id) {
    $this->tiendas->suspender($id, 'Motivo');
})->with(['m1', 'nadie'])->throws(ErrorDeDominio::class, 'Esa tienda no existe');

it('una tienda suspendida no puede volver a entrar con su celular, y conserva sus datos', function () {
    $codigos = new CodigosEnMemoria;
    $entrada = new EntrarConTelefono($codigos, $codigos, $this->organizaciones, $this->cuentas, static fn () => 1000, static fn () => '482913', static fn () => 'ab12cd');
    $this->tiendas->suspender('t1', 'No paga sus pedidos');

    $entrada->pedirCodigo('71234567');
    expect(fn () => $entrada->entrar('71234567', '482913'))->toThrow(ErrorDeDominio::class, 'Tu cuenta está suspendida');
    expect($this->cuentas->sesiones)->toBe([]);

    // Al reactivarla, entra de nuevo con la misma cuenta
    $this->tiendas->reactivar('t1');
    expect($entrada->entrar('71234567', '482913')['cliente']->id)->toBe('t1');
});
