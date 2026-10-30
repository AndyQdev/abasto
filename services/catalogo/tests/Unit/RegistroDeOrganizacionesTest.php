<?php

declare(strict_types=1);

use Catalogo\Aplicacion\RegistrarOrganizacion;
use Catalogo\Aplicacion\VerificarMayorista;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EstadoVerificacion;
use Tests\Support\CuentasEnMemoria;
use Tests\Support\OrganizacionesEnMemoria;

/** CU-01 (registrarse como mayorista y ser verificado) y CU-15 (registrarse como tienda). */
beforeEach(function () {
    $this->organizaciones = new OrganizacionesEnMemoria;
    $this->cuentas = new CuentasEnMemoria;
    $this->hora = '2026-10-30T10:00:00+00:00';
    $this->registro = new RegistrarOrganizacion(
        $this->organizaciones,
        $this->cuentas,
        fn () => $this->hora,
        static fn () => 'a1b2',
    );
    $this->verificacion = new VerificarMayorista($this->organizaciones);
});

function registrarElCeibo(RegistrarOrganizacion $registro, string $nit = '1029384756', string $correo = 'ventas@elceibo.bo'): Catalogo\Dominio\Organizacion
{
    return $registro->mayorista('Distribuidora El Ceibo', $nit, 'Cochabamba', 'María Quispe Rojas', '+591 712 34567', $correo, 'secreto123');
}

it('un mayorista se registra y queda pendiente, con su cuenta de rol mayorista', function () {
    $ceibo = registrarElCeibo($this->registro);

    expect($ceibo->id)->toBe('distribuidora-el-ceibo-a1b2')
        ->and($ceibo->verificacion)->toBe(EstadoVerificacion::PENDIENTE)
        ->and($ceibo->nit)->toBe('1029384756')
        ->and($ceibo->telefono)->toBe('+59171234567')
        ->and($ceibo->registradaEn)->toBe('2026-10-30T10:00:00+00:00')
        ->and($this->organizaciones->porId($ceibo->id))->toEqual($ceibo)
        ->and($this->cuentas->cuentas['ventas@elceibo.bo'])->toMatchArray([
            'nombre' => 'María',
            'apellido' => 'Quispe Rojas',
            'orgId' => 'distribuidora-el-ceibo-a1b2',
            'orgNombre' => 'Distribuidora El Ceibo',
            'rol' => 'mayorista',
        ]);
});

it('un mayorista pendiente no sale en la lista de mayoristas que ven las tiendas', function () {
    registrarElCeibo($this->registro);

    expect($this->verificacion->porEstado(EstadoVerificacion::PENDIENTE))->toHaveCount(1)
        ->and($this->verificacion->porEstado(EstadoVerificacion::VERIFICADO))->toBeEmpty();
});

it('el NIT tiene que tener entre 6 y 12 dígitos', function () {
    registrarElCeibo($this->registro, nit: '12-34');
})->throws(ErrorDeDominio::class, 'El NIT tiene que tener entre 6 y 12 dígitos');

it('no se registran dos empresas con el mismo NIT', function () {
    registrarElCeibo($this->registro);
    registrarElCeibo($this->registro, correo: 'otra@elceibo.bo');
})->throws(ErrorDeDominio::class, 'Ya hay una empresa registrada con ese NIT');

it('si el correo ya tiene cuenta, no queda una empresa huérfana', function () {
    registrarElCeibo($this->registro);

    expect(fn () => registrarElCeibo($this->registro, nit: '5556667778'))
        ->toThrow(ErrorDeDominio::class, 'Ya hay una cuenta con ese correo')
        ->and($this->organizaciones->todas)->toHaveCount(1);
});

it('pide nombre y apellido del representante, un correo válido y una contraseña de 8 o más', function (string $representante, string $correo, string $clave, string $mensaje) {
    expect(fn () => $this->registro->mayorista('Distribuidora El Ceibo', '1029384756', 'Cochabamba', $representante, '71234567', $correo, $clave))
        ->toThrow(ErrorDeDominio::class, $mensaje);
})->with([
    'sin apellido' => ['María', 'a@b.bo', 'secreto123', 'Escribe el nombre y el apellido'],
    'correo inválido' => ['María Quispe', 'no-es-correo', 'secreto123', 'El correo no es válido'],
    'contraseña corta' => ['María Quispe', 'a@b.bo', 'corta', 'al menos 8 caracteres'],
]);

it('una tienda se registra y entra al momento, sin NIT', function () {
    $tienda = $this->registro->tienda('Tienda Don Lucho', 'Santa Cruz', 'Luis Mamani', '76543210', 'Lucho@Gmail.com', 'secreto123');

    expect($tienda->tipo)->toBe('tienda')
        ->and($tienda->verificacion)->toBe(EstadoVerificacion::VERIFICADO)
        ->and($tienda->nit)->toBeNull()
        ->and($this->cuentas->cuentas)->toHaveKey('lucho@gmail.com')
        ->and($this->cuentas->cuentas['lucho@gmail.com']['rol'])->toBe('tienda');
});

it('Abasto verifica a un mayorista pendiente', function () {
    $ceibo = registrarElCeibo($this->registro);

    $verificado = $this->verificacion->aprobar($ceibo->id);

    expect($verificado->estaVerificada())->toBeTrue()
        ->and($this->organizaciones->porId($ceibo->id)?->verificacion)->toBe(EstadoVerificacion::VERIFICADO)
        ->and($this->verificacion->porEstado(EstadoVerificacion::PENDIENTE))->toBeEmpty();
});

it('Abasto rechaza a un mayorista con un motivo que el mayorista ve', function () {
    $ceibo = registrarElCeibo($this->registro);

    $rechazado = $this->verificacion->rechazar($ceibo->id, 'El NIT no corresponde a la empresa');

    expect($rechazado->verificacion)->toBe(EstadoVerificacion::RECHAZADO)
        ->and($this->organizaciones->porId($ceibo->id)?->motivoRechazo)->toBe('El NIT no corresponde a la empresa')
        ->and($this->organizaciones->porId($ceibo->id)?->correo)->toBe('ventas@elceibo.bo');
});

it('para rechazar hay que escribir el motivo', function () {
    $ceibo = registrarElCeibo($this->registro);
    $this->verificacion->rechazar($ceibo->id, ' ');
})->throws(ErrorDeDominio::class, 'Escribe por qué lo rechazas');

it('no se puede verificar a una tienda ni a una empresa que no existe', function () {
    $tienda = $this->registro->tienda('Tienda Don Lucho', 'Santa Cruz', 'Luis Mamani', '76543210', 'lucho@gmail.com', 'secreto123');

    expect(fn () => $this->verificacion->aprobar($tienda->id))->toThrow(ErrorDeDominio::class, 'Ese mayorista no existe')
        ->and(fn () => $this->verificacion->aprobar('no-existe'))->toThrow(ErrorDeDominio::class, 'Ese mayorista no existe');
});
