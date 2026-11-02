<?php

use Catalogo\Aplicacion\ElegirTipoDeNegocio;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\NegocioDelCliente;
use Catalogo\Dominio\Organizacion;
use Tests\Support\OrganizacionesEnMemoria;

// Para qué compra el cliente de la app (docs/plan-mi-negocio.md): hogar, tienda o productor con lo que hace.

const ELEGIDO = '2026-11-01T12:00:00+00:00';

function codigoDeError(callable $accion): ?string
{
    try {
        $accion();
    } catch (ErrorDeDominio $e) {
        return $e->codigo;
    }

    return null;
}

/** Un cliente de la app recién creado (como lo deja entrarConCodigo) y un mayorista, en memoria. */
function organizacionesConCliente(): OrganizacionesEnMemoria
{
    $repo = new OrganizacionesEnMemoria();
    $repo->guardar(new Organizacion('cliente-3210-ab12', 'Rosa Mamani', 'tienda', '', EstadoVerificacion::VERIFICADO, telefono: '59176543210'));
    $repo->guardar(new Organizacion('lp', 'Distribuidora Los Pozos', 'mayorista', 'Santa Cruz', EstadoVerificacion::VERIFICADO, '1023456027'));

    return $repo;
}

describe('NegocioDelCliente: las reglas', function () {
    it('acepta hogar y tienda sin subtipo, y productor con lo que hace', function () {
        expect(NegocioDelCliente::elegir('hogar', null, ELEGIDO)->tipo)->toBe('hogar')
            ->and(NegocioDelCliente::elegir('tienda', '', ELEGIDO)->subtipo)->toBeNull()
            ->and(NegocioDelCliente::elegir('productor', 'salteneria', ELEGIDO)->subtipo)->toBe('salteneria');
    });

    it('normaliza mayúsculas y espacios', function () {
        $n = NegocioDelCliente::elegir(' Productor ', ' PANADERIA', ELEGIDO);

        expect($n->tipo)->toBe('productor')->and($n->subtipo)->toBe('panaderia')->and($n->elegidoEn)->toBe(ELEGIDO);
    });

    it('rechaza un tipo que no existe', function () {
        expect(codigoDeError(fn () => NegocioDelCliente::elegir('familia', null, ELEGIDO)))->toBe('TIPO_DE_NEGOCIO_INVALIDO');
    });

    it('el productor tiene que decir qué hace', function () {
        expect(codigoDeError(fn () => NegocioDelCliente::elegir('productor', null, ELEGIDO)))->toBe('FALTA_SUBTIPO');
    });

    it('hogar y tienda no llevan subtipo', function () {
        expect(codigoDeError(fn () => NegocioDelCliente::elegir('hogar', 'pension', ELEGIDO)))->toBe('SUBTIPO_NO_CORRESPONDE')
            ->and(codigoDeError(fn () => NegocioDelCliente::elegir('tienda', 'salteneria', ELEGIDO)))->toBe('SUBTIPO_NO_CORRESPONDE');
    });

    it('rechaza un subtipo que no existe', function () {
        expect(codigoDeError(fn () => NegocioDelCliente::elegir('productor', 'carniceria', ELEGIDO)))->toBe('SUBTIPO_INVALIDO');
    });

    it('un mayorista no tiene tipo de negocio', function () {
        $mayorista = new Organizacion('lp', 'Distribuidora Los Pozos', 'mayorista', 'Santa Cruz');

        expect(codigoDeError(fn () => $mayorista->conNegocio(NegocioDelCliente::elegir('tienda', null, ELEGIDO))))->toBe('NEGOCIO_SOLO_CLIENTES');
    });

    it('verificar o rechazar no le borra el tipo de negocio', function () {
        $cliente = (new Organizacion('c1', 'Rosa', 'tienda', '', EstadoVerificacion::PENDIENTE))
            ->conNegocio(NegocioDelCliente::elegir('hogar', null, ELEGIDO));

        expect($cliente->verificar()->negocio?->tipo)->toBe('hogar')
            ->and($cliente->rechazar('No corresponde')->negocio?->tipo)->toBe('hogar');
    });
});

describe('ElegirTipoDeNegocio', function () {
    it('el cliente elige, queda guardado con la fecha y se lee igual en otro celular', function () {
        $repo = organizacionesConCliente();
        $caso = new ElegirTipoDeNegocio($repo, fn () => ELEGIDO);

        expect($caso->actual('cliente-3210-ab12'))->toBeNull();
        $caso->elegir('cliente-3210-ab12', 'productor', 'salteneria');

        $guardado = $repo->porId('cliente-3210-ab12')?->negocio;
        expect($guardado?->tipo)->toBe('productor')
            ->and($guardado?->subtipo)->toBe('salteneria')
            ->and($guardado?->elegidoEn)->toBe(ELEGIDO)
            ->and($caso->actual('cliente-3210-ab12')?->subtipo)->toBe('salteneria');
    });

    it('lo puede cambiar después (en Cuenta)', function () {
        $repo = organizacionesConCliente();
        $caso = new ElegirTipoDeNegocio($repo, fn () => ELEGIDO);
        $caso->elegir('cliente-3210-ab12', 'productor', 'pension');
        $caso->elegir('cliente-3210-ab12', 'tienda', null);

        expect($repo->porId('cliente-3210-ab12')?->negocio?->tipo)->toBe('tienda')
            ->and($repo->porId('cliente-3210-ab12')?->negocio?->subtipo)->toBeNull();
    });

    it('si la regla no se cumple, no guarda nada', function () {
        $repo = organizacionesConCliente();
        $caso = new ElegirTipoDeNegocio($repo, fn () => ELEGIDO);

        expect(codigoDeError(fn () => $caso->elegir('cliente-3210-ab12', 'productor', null)))->toBe('FALTA_SUBTIPO')
            ->and($repo->porId('cliente-3210-ab12')?->negocio)->toBeNull();
    });

    it('un mayorista no puede elegir tipo de negocio', function () {
        $caso = new ElegirTipoDeNegocio(organizacionesConCliente(), fn () => ELEGIDO);

        expect(codigoDeError(fn () => $caso->elegir('lp', 'tienda', null)))->toBe('NEGOCIO_SOLO_CLIENTES');
    });

    it('una cuenta sin empresa avisa', function () {
        $caso = new ElegirTipoDeNegocio(organizacionesConCliente(), fn () => ELEGIDO);

        expect(codigoDeError(fn () => $caso->actual('no-existe')))->toBe('CLIENTE_NO_EXISTE');
    });
});
