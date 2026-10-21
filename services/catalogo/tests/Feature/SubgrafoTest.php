<?php

// El subgrafo completo contra MongoDB real (base catalogo_pruebas). Necesita `pnpm infra`.
// Los tokens se firman con una llave de prueba y pasan por el middleware real de Keycloak.

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::fake([config('services.keycloak.jwks') => Http::response(llaveDePrueba()['jwks'])]);
    $this->token = null;
    foreach (['organizaciones', 'productos', 'relaciones'] as $c) {
        DB::connection('mongodb')->getCollection($c)->drop();
    }
    $this->artisan('catalogo:semilla')->assertSuccessful();
});

/** Un par de llaves RSA para firmar tokens como lo haría Keycloak. */
function llaveDePrueba(): array
{
    static $llave = null;
    if ($llave === null) {
        $privada = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $detalles = openssl_pkey_get_details($privada);
        $b64 = static fn (string $v) => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');
        $llave = [
            'privada' => $privada,
            'jwks' => ['keys' => [[
                'kty' => 'RSA', 'kid' => 'prueba', 'use' => 'sig', 'alg' => 'RS256',
                'n' => $b64($detalles['rsa']['n']), 'e' => $b64($detalles['rsa']['e']),
            ]]],
        ];
    }

    return $llave;
}

/** Las consultas siguientes van con el token de Keycloak de esa empresa. */
function comoEmpresa(string $orgId, array $roles = ['tienda']): void
{
    test()->token = JWT::encode([
        'iss' => config('services.keycloak.emisor'),
        'aud' => 'abasto-api',
        'sub' => 'u-'.$orgId,
        'org_id' => $orgId,
        'realm_access' => ['roles' => $roles],
        'exp' => time() + 300,
    ], llaveDePrueba()['privada'], 'RS256', 'prueba');
}

function graphql(string $query, array $variables = []): array
{
    $cabeceras = test()->token ? ['Authorization' => 'Bearer '.test()->token] : [];

    return test()->postJson('/graphql', ['query' => $query, 'variables' => $variables], $cabeceras)->json();
}

const PRODUCTOS = '{ productos { id precioVisible mayorista { id relacion } escalas { presentacion precioUnitario { texto } } } }';

it('Doña Rosa, cliente frecuente de Los Pozos, ve sus precios con descuento', function () {
    comoEmpresa('dr');
    $productos = collect(graphql(PRODUCTOS)['data']['productos'])->keyBy('id');

    expect($productos['HP-0400']['precioVisible'])->toBeTrue()
        ->and($productos['HP-0400']['mayorista']['relacion'])->toBe('APROBADA')
        ->and($productos['HP-0400']['escalas'][2]['precioUnitario']['texto'])->toBe('Bs 17,46');
});

it('una tienda sin relación ve el catálogo pero no los precios', function () {
    comoEmpresa('sj');
    $producto = collect(graphql(PRODUCTOS)['data']['productos'])->firstWhere('id', 'HP-0400');

    expect($producto['precioVisible'])->toBeFalse()
        ->and($producto['escalas'][0]['precioUnitario'])->toBeNull()
        ->and($producto['mayorista']['relacion'])->toBe('SOLICITADA');
});

it('no muestra productos de mayoristas sin verificar ni pausados', function () {
    comoEmpresa('dr');
    $ids = collect(graphql(PRODUCTOS)['data']['productos'])->pluck('id');

    expect($ids)->not->toContain('LD-2000')->not->toContain('HP-0420');
});

it('el mayorista aprueba una solicitud y la tienda pasa a ver precios', function () {
    comoEmpresa('lp', ['mayorista']);
    $r = graphql('mutation { aprobarCliente(tiendaId: "sj", lista: NUEVOS) { estado lista tienda { nombre } } }');
    expect($r['data']['aprobarCliente'])->toBe(['estado' => 'APROBADA', 'lista' => 'NUEVOS', 'tienda' => ['nombre' => 'Tienda San Juan']]);

    comoEmpresa('sj');
    $producto = collect(graphql(PRODUCTOS)['data']['productos'])->firstWhere('id', 'HP-0400');
    expect($producto['precioVisible'])->toBeTrue();
});

it('una tienda no puede ver los productos de un mayorista como si fuera el mayorista', function () {
    comoEmpresa('dr');
    $r = graphql('{ misProductos { id } }');

    expect($r['errors'][0]['message'])->toContain('rol mayorista');
});

it('sin sesión no responde datos', function () {
    $r = graphql(PRODUCTOS);

    expect($r['errors'][0]['message'])->toBe('Falta la sesión');
});

it('un token firmado por otra llave se rechaza', function () {
    test()->token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InBydWViYSJ9.eyJzdWIiOiJ4In0.firma-falsa';
    $respuesta = test()->postJson('/graphql', ['query' => PRODUCTOS], ['Authorization' => 'Bearer '.test()->token]);

    expect($respuesta->status())->toBe(401);
});

it('responde como subgrafo de Federation 2', function () {
    comoEmpresa('dr');
    $sdl = graphql('{ _service { sdl } }')['data']['_service']['sdl'];

    expect($sdl)->toContain('@key(fields: "id")')->toContain('specs.apollo.dev/federation/v2');
});

it('resuelve la entidad Tienda para Pedidos y Cobros', function () {
    comoEmpresa('lp', ['mayorista']);
    $r = graphql('query($r: [_Any!]!) { _entities(representations: $r) { ... on Tienda { nombre } } }', [
        'r' => [['__typename' => 'Tienda', 'id' => 'dr']],
    ]);

    expect($r['data']['_entities'][0]['nombre'])->toBe('Tienda Doña Rosa');
});

it('un distribuidor que también compra no ve sus propios productos en Mercado', function () {
    comoEmpresa('lp', ['mayorista', 'tienda']);
    $productos = graphql(PRODUCTOS)['data']['productos'];

    expect($productos)->not->toBeEmpty()
        ->and(array_unique(array_map(fn ($p) => $p['mayorista']['id'], $productos)))->not->toContain('lp');
});
