<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Keycloak;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\Puertos\CuentasDeAcceso;
use Catalogo\Dominio\SesionEmitida;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Las cuentas en Keycloak, con la cuenta de servicio `catalogo-cuentas` (solo puede administrar usuarios).
 * - crear: usuario con su org_id, org_nombre y su grupo (clientes o mayoristas), que trae el rol y offline_access
 *   para que la app no pida entrar de nuevo.
 * - sesionPara: a quien ya probó con el código que el celular es suyo, se le pone una clave nueva al azar
 *   que nadie conoce y se piden sus tokens con ella. Así la app recibe una sesión larga sin contraseñas.
 */
final readonly class KeycloakCuentas implements CuentasDeAcceso
{
    public function __construct(
        private string $base,
        private string $realm,
        private string $cliente,
        private string $secreto,
        private string $clienteApp,
    ) {
    }

    public function crear(string $usuario, string $correo, string $clave, string $nombre, string $apellido, string $orgId, string $orgNombre, string $rol): void
    {
        $r = $this->admin()->post('/users', array_filter([
            'username' => $usuario,
            'email' => $correo,
            'emailVerified' => true,
            'enabled' => true,
            'firstName' => $nombre,
            'lastName' => $apellido === '' ? null : $apellido,
            'attributes' => ['org_id' => [$orgId], 'org_nombre' => [$orgNombre]],
            'credentials' => [['type' => 'password', 'value' => $clave, 'temporary' => false]],
            // El grupo trae el rol y offline_access (infra/keycloak/al-dia.mjs): la cuenta nace completa en un solo pedido
            'groups' => [$rol === 'mayorista' ? '/mayoristas' : '/clientes'],
        ], static fn ($v) => $v !== null));
        if ($r->status() === 409) {
            throw new ErrorDeDominio('CORREO_EN_USO', 'Ya hay una cuenta con ese correo');
        }
        $r->throw();
    }

    public function sesionPara(string $usuario): SesionEmitida
    {
        $id = $this->idDe($usuario);
        $clave = bin2hex(random_bytes(24));
        $this->admin()->put("/users/{$id}/reset-password", ['type' => 'password', 'value' => $clave, 'temporary' => false])->throw();

        $r = Http::asForm()->timeout(10)->post("{$this->base}/realms/{$this->realm}/protocol/openid-connect/token", [
            'grant_type' => 'password',
            'client_id' => $this->clienteApp,
            'username' => $usuario,
            'password' => $clave,
            'scope' => 'openid profile email offline_access',
        ])->throw()->json();

        return new SesionEmitida((string) $r['access_token'], (string) $r['refresh_token'], (int) $r['expires_in']);
    }

    private function idDe(string $usuario): string
    {
        $encontrados = $this->admin()->get('/users', ['username' => $usuario, 'exact' => 'true'])->throw()->json();
        if (!is_array($encontrados) || !isset($encontrados[0]['id'])) {
            throw new ErrorDeDominio('SIN_CUENTA', 'No encontramos tu cuenta. Vuelve a pedir el código.');
        }

        return (string) $encontrados[0]['id'];
    }

    private function admin(): PendingRequest
    {
        $token = Cache::remember('keycloak.cuentas.token', 50, fn () => (string) Http::asForm()->timeout(10)
            ->post("{$this->base}/realms/{$this->realm}/protocol/openid-connect/token", [
                'grant_type' => 'client_credentials',
                'client_id' => $this->cliente,
                'client_secret' => $this->secreto,
            ])->throw()->json('access_token'));

        return Http::withToken($token)->acceptJson()->timeout(10)->baseUrl("{$this->base}/admin/realms/{$this->realm}");
    }
}
