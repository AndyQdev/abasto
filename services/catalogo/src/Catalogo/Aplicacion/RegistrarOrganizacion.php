<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Puertos\CuentasDeAcceso;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;

/**
 * Alguien se registra solo (CU-01 y CU-15). Se crea su empresa y su usuario para entrar.
 * - Mayorista: queda PENDIENTE; sus productos no salen en la app hasta que Abasto lo verifica.
 * - Tienda: entra al momento; ve los precios de Abasto y puede pedir ser cliente de los demás.
 */
final readonly class RegistrarOrganizacion
{
    /**
     * @param \Closure(): string $ahora  fecha y hora ISO 8601 (en las pruebas, fija)
     * @param \Closure(): string $sufijo para que dos empresas con el mismo nombre no choquen
     */
    public function __construct(
        private OrganizacionRepositorio $organizaciones,
        private CuentasDeAcceso $cuentas,
        private \Closure $ahora,
        private \Closure $sufijo,
    ) {
    }

    public static function conReloj(OrganizacionRepositorio $organizaciones, CuentasDeAcceso $cuentas): self
    {
        return new self(
            $organizaciones,
            $cuentas,
            static fn (): string => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM),
            static fn (): string => bin2hex(random_bytes(2)),
        );
    }

    public function mayorista(
        string $empresa,
        string $nit,
        string $ciudad,
        string $representante,
        string $telefono,
        string $correo,
        string $clave,
    ): Organizacion {
        $nit = preg_replace('/\D/', '', $nit) ?? '';
        if (strlen($nit) < 6 || strlen($nit) > 12) {
            throw new ErrorDeDominio('DATOS_INVALIDOS', 'El NIT tiene que tener entre 6 y 12 dígitos');
        }
        if ($this->organizaciones->porNit($nit) !== null) {
            throw new ErrorDeDominio('NIT_EN_USO', 'Ya hay una empresa registrada con ese NIT');
        }

        return $this->registrar('mayorista', EstadoVerificacion::PENDIENTE, $empresa, $nit, $ciudad, $representante, $telefono, $correo, $clave);
    }

    public function tienda(
        string $nombre,
        string $ciudad,
        string $representante,
        string $telefono,
        string $correo,
        string $clave,
    ): Organizacion {
        return $this->registrar('tienda', EstadoVerificacion::VERIFICADO, $nombre, null, $ciudad, $representante, $telefono, $correo, $clave);
    }

    /** @param 'mayorista'|'tienda' $tipo */
    private function registrar(
        string $tipo,
        EstadoVerificacion $estado,
        string $empresa,
        ?string $nit,
        string $ciudad,
        string $representante,
        string $telefono,
        string $correo,
        string $clave,
    ): Organizacion {
        $empresa = trim($empresa);
        $ciudad = trim($ciudad);
        $representante = trim(preg_replace('/\s+/', ' ', $representante) ?? '');
        $telefono = preg_replace('/[^\d+]/', '', $telefono) ?? '';
        $correo = mb_strtolower(trim($correo));

        if (mb_strlen($empresa) < 3) {
            throw new ErrorDeDominio('DATOS_INVALIDOS', 'Escribe el nombre de la empresa');
        }
        if ($ciudad === '') {
            throw new ErrorDeDominio('DATOS_INVALIDOS', 'Elige la ciudad');
        }
        if (!str_contains($representante, ' ')) {
            throw new ErrorDeDominio('DATOS_INVALIDOS', 'Escribe el nombre y el apellido de quien representa a la empresa');
        }
        if (strlen(ltrim($telefono, '+')) < 7) {
            throw new ErrorDeDominio('DATOS_INVALIDOS', 'El teléfono no es válido');
        }
        if (filter_var($correo, FILTER_VALIDATE_EMAIL) === false) {
            throw new ErrorDeDominio('DATOS_INVALIDOS', 'El correo no es válido');
        }
        if (mb_strlen($clave) < 8) {
            throw new ErrorDeDominio('DATOS_INVALIDOS', 'La contraseña tiene que tener al menos 8 caracteres');
        }

        $organizacion = new Organizacion(
            id: self::slug($empresa).'-'.($this->sufijo)(),
            nombre: $empresa,
            tipo: $tipo,
            ciudad: $ciudad,
            verificacion: $estado,
            nit: $nit,
            representante: $representante,
            telefono: $telefono,
            correo: $correo,
            registradaEn: ($this->ahora)(),
        );

        // Primero la cuenta: si el correo ya existe, no queda una empresa huérfana
        [$nombre, $apellido] = explode(' ', $representante, 2);
        $this->cuentas->crear($correo, $clave, $nombre, $apellido, $organizacion->id, $empresa, $tipo);
        $this->organizaciones->guardar($organizacion);

        return $organizacion;
    }

    private static function slug(string $texto): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT', $texto);
        $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($ascii === false ? $texto : $ascii)) ?? '', '-');

        return substr($slug === '' ? 'empresa' : $slug, 0, 24);
    }
}
