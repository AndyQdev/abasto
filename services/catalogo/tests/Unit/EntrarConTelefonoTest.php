<?php

declare(strict_types=1);

use Catalogo\Aplicacion\EntrarConTelefono;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EstadoVerificacion;
use Tests\Support\CodigosEnMemoria;
use Tests\Support\CuentasEnMemoria;
use Tests\Support\OrganizacionesEnMemoria;

/** La app de clientes: entrar con el celular y un código, como en PedidosYa (sin correo ni contraseña). */
beforeEach(function () {
    $this->codigos = new CodigosEnMemoria;
    $this->organizaciones = new OrganizacionesEnMemoria;
    $this->cuentas = new CuentasEnMemoria;
    $this->ahora = 1_000_000;
    $this->entrada = new EntrarConTelefono(
        $this->codigos,
        $this->codigos,
        $this->organizaciones,
        $this->cuentas,
        fn () => $this->ahora,
        static fn () => '482913',
        static fn () => 'ab12cd',
    );
});

it('acepta el celular con o sin 591, con espacios o guiones', function (string $escrito) {
    expect(EntrarConTelefono::normalizar($escrito))->toBe('59171234567');
})->with(['71234567', '712 34 567', '+591 71234567', '591-7123-4567']);

it('rechaza lo que no es un celular de Bolivia', function (string $escrito) {
    EntrarConTelefono::normalizar($escrito);
})->with(['1234567', '41234567', '7123456789'])->throws(ErrorDeDominio::class, 'Escribe tu número de celular de 8 dígitos');

it('la primera vez manda el código, avisa que es nuevo y en modo prueba lo devuelve', function () {
    $envio = $this->entrada->pedirCodigo('71234567');

    expect($envio)->toBe(['telefono' => '59171234567', 'esNuevo' => true, 'venceEnSegundos' => 300, 'codigoDePrueba' => '482913'])
        ->and($this->codigos->enviados['59171234567'])->toBe('482913')
        ->and($this->codigos->vigentes['59171234567']->huella)->not->toContain('482913');
});

it('fuera del modo prueba el código no vuelve en la respuesta', function () {
    $codigos = new CodigosEnMemoria(dePrueba: false);
    $entrada = new EntrarConTelefono($codigos, $codigos, $this->organizaciones, $this->cuentas, fn () => 1, static fn () => '111111', static fn () => 'x');

    expect($entrada->pedirCodigo('71234567')['codigoDePrueba'])->toBeNull();
});

it('no deja pedir otro código antes de 30 segundos', function () {
    $this->entrada->pedirCodigo('71234567');
    $this->ahora += 10;
    $this->entrada->pedirCodigo('71234567');
})->throws(ErrorDeDominio::class, 'Espera 20 segundos para pedir otro código');

it('un cliente nuevo: el código correcto pide el nombre y, con el nombre, crea su cuenta y entra', function () {
    $this->entrada->pedirCodigo('71234567');

    expect(fn () => $this->entrada->entrar('71234567', '482913'))->toThrow(ErrorDeDominio::class, '¿Cómo te llamas?');

    $r = $this->entrada->entrar('71234567', '482913', '  Rosa   Mamani ');

    expect($r['nuevo'])->toBeTrue()
        ->and($r['sesion']->acceso)->toBe('acceso-59171234567')
        ->and($r['cliente']->nombre)->toBe('Rosa Mamani')
        ->and($r['cliente']->tipo)->toBe('tienda')
        ->and($r['cliente']->verificacion)->toBe(EstadoVerificacion::VERIFICADO)
        ->and($r['cliente']->id)->toBe('cliente-4567-ab12cd')
        ->and($this->cuentas->cuentas['59171234567'])->toMatchArray([
            'correo' => '59171234567@clientes.abasto.bo',
            'nombre' => 'Rosa',
            'apellido' => 'Mamani',
            'orgId' => 'cliente-4567-ab12cd',
            'rol' => 'tienda',
        ])
        ->and($this->codigos->vigentes)->toBeEmpty();
});

it('un cliente que vuelve entra solo con el código, sin volver a dar su nombre', function () {
    $this->entrada->pedirCodigo('71234567');
    $this->entrada->entrar('71234567', '482913', 'Rosa');
    $this->ahora += 3600;

    expect($this->entrada->pedirCodigo('71234567')['esNuevo'])->toBeFalse();
    $r = $this->entrada->entrar('71234567', '482913');

    expect($r['nuevo'])->toBeFalse()
        ->and($r['cliente']->nombre)->toBe('Rosa')
        ->and($this->cuentas->cuentas)->toHaveCount(1)
        ->and($this->cuentas->sesiones)->toBe(['59171234567', '59171234567']);
});

it('un código incorrecto no deja entrar y a los 5 intentos se bloquea', function () {
    $this->entrada->pedirCodigo('71234567');
    foreach (range(1, 5) as $_) {
        expect(fn () => $this->entrada->entrar('71234567', '000000', 'Rosa'))->toThrow(ErrorDeDominio::class, 'El código no es correcto');
    }

    expect(fn () => $this->entrada->entrar('71234567', '482913', 'Rosa'))
        ->toThrow(ErrorDeDominio::class, 'Probaste muchas veces. Pide un código nuevo.');
});

it('el código vence a los 5 minutos', function () {
    $this->entrada->pedirCodigo('71234567');
    $this->ahora += 301;
    $this->entrada->entrar('71234567', '482913', 'Rosa');
})->throws(ErrorDeDominio::class, 'El código venció. Pide otro.');

it('sin haber pedido código no se puede entrar', function () {
    $this->entrada->entrar('71234567', '482913', 'Rosa');
})->throws(ErrorDeDominio::class, 'El código venció. Pide otro.');
