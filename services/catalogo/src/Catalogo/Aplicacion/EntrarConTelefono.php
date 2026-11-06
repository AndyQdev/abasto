<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\CodigoDeAcceso;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Puertos\CodigosDeAcceso;
use Catalogo\Dominio\Puertos\CuentasDeAcceso;
use Catalogo\Dominio\Puertos\EnviadorDeCodigos;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Catalogo\Dominio\SesionEmitida;

/**
 * Entrar a la app de clientes con el celular, como en PedidosYa: sin correo ni contraseña.
 * 1. pedirCodigo: llega un código de 6 dígitos (por WhatsApp más adelante).
 * 2. entrar: con el código correcto entra; la primera vez también pide el nombre y crea su cuenta.
 * El cliente compra como «tienda»: ve los precios de Abasto y puede pedir ser cliente de otros mayoristas.
 */
final readonly class EntrarConTelefono
{
    /**
     * @param \Closure(): int    $ahora  segundos desde 1970 (en las pruebas, fijo)
     * @param \Closure(): string $codigo 6 dígitos al azar
     * @param \Closure(): string $sufijo para el id de la empresa del cliente
     */
    public function __construct(
        private CodigosDeAcceso $codigos,
        private EnviadorDeCodigos $enviador,
        private OrganizacionRepositorio $organizaciones,
        private CuentasDeAcceso $cuentas,
        private \Closure $ahora,
        private \Closure $codigo,
        private \Closure $sufijo,
    ) {
    }

    public static function conReloj(
        CodigosDeAcceso $codigos,
        EnviadorDeCodigos $enviador,
        OrganizacionRepositorio $organizaciones,
        CuentasDeAcceso $cuentas,
    ): self {
        return new self(
            $codigos,
            $enviador,
            $organizaciones,
            $cuentas,
            static fn (): int => time(),
            static fn (): string => str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT),
            static fn (): string => bin2hex(random_bytes(3)),
        );
    }

    /** Celular de Bolivia (8 dígitos que empiezan con 6 o 7), con o sin el 591 adelante. */
    public static function normalizar(string $telefono): string
    {
        $digitos = preg_replace('/\D/', '', $telefono) ?? '';
        if (strlen($digitos) === 11 && str_starts_with($digitos, '591')) {
            $digitos = substr($digitos, 3);
        }
        if (!preg_match('/^[67]\d{7}$/', $digitos)) {
            throw new ErrorDeDominio('TELEFONO_INVALIDO', 'Escribe tu número de celular de 8 dígitos');
        }

        return '591'.$digitos;
    }

    /** @return array{telefono: string, esNuevo: bool, venceEnSegundos: int, codigoDePrueba: ?string} */
    public function pedirCodigo(string $telefono): array
    {
        $telefono = self::normalizar($telefono);
        $ahora = ($this->ahora)();
        $anterior = $this->codigos->de($telefono);
        if ($anterior !== null && !$anterior->puedeReenviarse($ahora)) {
            $falta = CodigoDeAcceso::ESPERA_PARA_REENVIAR - ($ahora - $anterior->creadoEn);
            throw new ErrorDeDominio('ESPERA', "Espera {$falta} segundos para pedir otro código");
        }

        $codigo = ($this->codigo)();
        $this->codigos->guardar(new CodigoDeAcceso($telefono, CodigoDeAcceso::huellaDe($telefono, $codigo), $ahora));
        $this->enviador->enviar($telefono, $codigo);

        return [
            'telefono' => $telefono,
            'esNuevo' => $this->organizaciones->porTelefono($telefono) === null,
            'venceEnSegundos' => CodigoDeAcceso::DURA_SEGUNDOS,
            'codigoDePrueba' => $this->enviador->esDePrueba() ? $codigo : null,
        ];
    }

    /** @return array{sesion: SesionEmitida, cliente: Organizacion, nuevo: bool} */
    public function entrar(string $telefono, string $codigo, ?string $nombre = null): array
    {
        $telefono = self::normalizar($telefono);
        $guardado = $this->codigos->de($telefono);
        if ($guardado === null || $guardado->vencido(($this->ahora)())) {
            throw new ErrorDeDominio('CODIGO_VENCIDO', 'El código venció. Pide otro.');
        }
        if ($guardado->agotado()) {
            throw new ErrorDeDominio('CODIGO_BLOQUEADO', 'Probaste muchas veces. Pide un código nuevo.');
        }
        if (!$guardado->coincide(trim($codigo))) {
            $this->codigos->guardar($guardado->conOtroIntento());
            throw new ErrorDeDominio('CODIGO_INCORRECTO', 'El código no es correcto');
        }

        $cliente = $this->organizaciones->porTelefono($telefono);
        $nuevo = $cliente === null;
        if ($cliente === null) {
            // El código sigue vigente: la app pide el nombre y vuelve a llamar con el mismo código
            $nombre = trim(preg_replace('/\s+/', ' ', (string) $nombre) ?? '');
            if (mb_strlen($nombre) < 2) {
                throw new ErrorDeDominio('NECESITA_NOMBRE', '¿Cómo te llamas?');
            }
            $cliente = $this->crearCliente($telefono, $nombre);
        }

        if ($cliente->suspendida) {
            throw new ErrorDeDominio('CUENTA_SUSPENDIDA', 'Tu cuenta está suspendida. Escríbenos para revisarla.');
        }

        $this->codigos->borrar($telefono);

        return ['sesion' => $this->cuentas->sesionPara($telefono), 'cliente' => $cliente, 'nuevo' => $nuevo];
    }

    private function crearCliente(string $telefono, string $nombre): Organizacion
    {
        $cliente = new Organizacion(
            id: 'cliente-'.substr($telefono, -4).'-'.($this->sufijo)(),
            nombre: $nombre,
            tipo: 'tienda',
            ciudad: '',
            verificacion: EstadoVerificacion::VERIFICADO,
            representante: $nombre,
            telefono: $telefono,
            registradaEn: gmdate(DATE_ATOM, ($this->ahora)()),
        );
        $partes = explode(' ', $nombre, 2);
        $this->cuentas->crear(
            usuario: $telefono,
            correo: $telefono.'@clientes.abasto.bo',
            clave: bin2hex(random_bytes(24)),
            nombre: $partes[0],
            apellido: $partes[1] ?? '',
            orgId: $cliente->id,
            orgNombre: $nombre,
            rol: 'tienda',
        );
        $this->organizaciones->guardar($cliente);

        return $cliente;
    }
}
