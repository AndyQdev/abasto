<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\GraphQL;

use Catalogo\Aplicacion\AjustarStock;
use Catalogo\Aplicacion\CambiarFotoDeProducto;
use Catalogo\Aplicacion\CargarProducto;
use Catalogo\Aplicacion\ConsultarCatalogo;
use Catalogo\Aplicacion\CrearProducto;
use Catalogo\Aplicacion\EditarProducto;
use Catalogo\Aplicacion\ElegirTipoDeNegocio;
use Catalogo\Aplicacion\EntrarConTelefono;
use Catalogo\Aplicacion\GestionarClientes;
use Catalogo\Aplicacion\GestionarTiendas;
use Catalogo\Aplicacion\RegistrarOrganizacion;
use Catalogo\Aplicacion\VerificarMayorista;
use Catalogo\Aplicacion\VistaDeProducto;
use Catalogo\Dominio\Abastecimiento;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\ListaDePrecios;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Puertos\CuentasDeAcceso;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Infraestructura\Http\Usuario;
use GraphQL\Error\Error;

/**
 * Adaptador de entrada: los campos del subgrafo llaman a los casos de uso.
 * La empresa siempre sale del token (Usuario::actual()), nunca de un argumento.
 */
final readonly class Resolutores
{
    public function __construct(
        private ConsultarCatalogo $catalogo,
        private GestionarClientes $clientes,
        private GestionarTiendas $tiendas,
        private CuentasDeAcceso $cuentas,
        private CargarProducto $cargar,
        private CrearProducto $crear,
        private EditarProducto $editar,
        private AjustarStock $ajustar,
        private CambiarFotoDeProducto $cambiarFoto,
        private OrganizacionRepositorio $organizaciones,
        private RelacionRepositorio $relaciones,
        private EntrarConTelefono $entrada,
        private RegistrarOrganizacion $registro,
        private VerificarMayorista $verificacion,
        private ElegirTipoDeNegocio $tipoDeNegocio,
    ) {
    }

    // ------------------------------------------------------------------ app de clientes: entrar con el celular

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function pedirCodigo(mixed $_, array $args): array
    {
        return $this->conErrores(fn () => $this->entrada->pedirCodigo((string) $args['telefono']));
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function entrarConCodigo(mixed $_, array $args): array
    {
        $r = $this->conErrores(fn () => $this->entrada->entrar(
            (string) $args['telefono'],
            (string) $args['codigo'],
            isset($args['nombre']) ? (string) $args['nombre'] : null,
        ));

        return [
            'tokenDeAcceso' => $r['sesion']->acceso,
            'tokenDeRenovacion' => $r['sesion']->renovacion,
            'venceEnSegundos' => $r['sesion']->venceEnSegundos,
            'cuentaNueva' => $r['nuevo'],
            'nombre' => $r['cliente']->nombre,
        ];
    }

    // ------------------------------------------------------------------ mayoristas: registro y verificación (CU-01)

    /** @return array<string, mixed> */
    public function miOrganizacion(): array
    {
        $usuario = Usuario::actual();
        $o = $this->organizaciones->porId($usuario->orgId);
        if ($o === null) {
            throw new Error('Tu cuenta no tiene empresa', extensions: ['code' => 'SIN_EMPRESA']);
        }

        return [
            'id' => $o->id,
            'nombre' => $o->nombre,
            'tipo' => $o->tipo,
            'estadoVerificacion' => $o->verificacion->value,
            'motivoRechazo' => $o->motivoRechazo,
            'negocio' => Vistas::negocio($o->negocio),
        ];
    }

    // ------------------------------------------------------------------ app de clientes: para qué compra (docs/plan-mi-negocio.md)

    /** @return array<string, mixed>|null */
    public function miTipoDeNegocio(): ?array
    {
        $orgId = Usuario::actual()->orgId;

        return Vistas::negocio($this->conErrores(fn () => $this->tipoDeNegocio->actual($orgId)));
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function elegirTipoDeNegocio(mixed $_, array $args): array
    {
        $orgId = Usuario::actual()->orgId;
        $cliente = $this->conErrores(fn () => $this->tipoDeNegocio->elegir(
            $orgId,
            (string) $args['tipo'],
            isset($args['subtipo']) ? (string) $args['subtipo'] : null,
        ));

        return Vistas::negocio($cliente->negocio) ?? throw new Error('No se pudo guardar el tipo de negocio');
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return list<array<string, mixed>>
     */
    public function mayoristasPorVerificar(mixed $_, array $args): array
    {
        Usuario::actual()->exigirRol('admin');
        $estado = EstadoVerificacion::tryFrom((string) ($args['estado'] ?? 'PENDIENTE')) ?? EstadoVerificacion::PENDIENTE;

        return array_map(Vistas::solicitud(...), $this->verificacion->porEstado($estado));
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function registrarMayorista(mixed $_, array $args): array
    {
        /** @var array<string, string> $e */
        $e = $args['entrada'];

        return Vistas::solicitud($this->conErrores(fn () => $this->registro->mayorista(
            $e['empresa'], $e['nit'], $e['ciudad'], $e['representante'], $e['telefono'], $e['correo'], $e['clave'],
        )));
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return list<array<string, mixed>>
     */
    public function tiendas(mixed $_, array $args): array
    {
        Usuario::actual()->exigirRol('admin');
        $busqueda = isset($args['busqueda']) ? (string) $args['busqueda'] : null;

        return array_map(Vistas::tiendaDeAbasto(...), $this->tiendas->listar($busqueda));
    }

    /**
     * @return list<array{usuario: string, nombre: string, correo: ?string, activo: bool}>
     */
    public function equipoDeAbasto(): array
    {
        Usuario::actual()->exigirRol('admin');

        return $this->cuentas->conRol('admin');
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function suspenderTienda(mixed $_, array $args): array
    {
        Usuario::actual()->exigirRol('admin');

        return Vistas::tiendaDeAbasto($this->conErrores(fn () => $this->tiendas->suspender((string) $args['id'], (string) $args['motivo'])));
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function reactivarTienda(mixed $_, array $args): array
    {
        Usuario::actual()->exigirRol('admin');

        return Vistas::tiendaDeAbasto($this->conErrores(fn () => $this->tiendas->reactivar((string) $args['id'])));
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function verificarMayorista(mixed $_, array $args): array
    {
        Usuario::actual()->exigirRol('admin');

        return Vistas::solicitud($this->conErrores(fn () => $this->verificacion->aprobar((string) $args['id'])));
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function rechazarMayorista(mixed $_, array $args): array
    {
        Usuario::actual()->exigirRol('admin');

        return Vistas::solicitud($this->conErrores(fn () => $this->verificacion->rechazar((string) $args['id'], (string) $args['motivo'])));
    }

    /**

     * @param array<string, mixed> $args

     * @return list<array<string, mixed>>

     */
    public function productos(mixed $_, array $args): array
    {
        $vistas = $this->catalogo->paraTienda(Usuario::actual()->orgId, $args['busqueda'] ?? null, $args['mayoristaId'] ?? null);

        return array_map(static fn (VistaDeProducto $v) => Vistas::producto($v), $vistas);
    }

    /**

     * @param array<string, mixed> $args

     * @return array<string, mixed>|null

     */
    public function producto(mixed $_, array $args): ?array
    {
        $vista = $this->catalogo->uno((string) $args['id'], Usuario::actual()->orgId);

        return $vista === null ? null : Vistas::producto($vista);
    }

    /**

     * @param array<string, mixed> $args

     * @return list<array<string, mixed>>

     */
    public function misProductos(mixed $_, array $args): array
    {
        // El equipo de Abasto (admin) también ve los productos de Abasto: Superadmin › Promociones elige de ahí (10/11)
        $usuario = Usuario::actual();
        if (!in_array('admin', $usuario->roles, true)) {
            $usuario->exigirRol('mayorista');
        }
        $vistas = $this->catalogo->delMayorista($usuario->orgId, $args['busqueda'] ?? null);

        return array_map(static fn (VistaDeProducto $v) => Vistas::producto($v), $vistas);
    }

    /**

     * @param array<string, mixed> $args

     * @return list<array<string, mixed>>

     */
    public function mayoristas(mixed $_, array $args): array
    {
        $relaciones = $this->relaciones->deTienda(Usuario::actual()->orgId);

        return array_map(
            static fn (Organizacion $o) => Vistas::mayorista($o, $o->id, ($relaciones[$o->id] ?? null)?->estado()->value ?? 'NINGUNA'),
            $this->organizaciones->mayoristas($args['busqueda'] ?? null),
        );
    }

    /** @return list<array<string, mixed>> */
    public function misSolicitudes(): array
    {
        $usuario = Usuario::actual()->exigirRol('mayorista');

        return array_map(
            fn ($r) => Vistas::relacion($r, $this->organizaciones->porId($r->tiendaId), $this->organizaciones->porId($r->mayoristaId)),
            $this->relaciones->solicitudesDe($usuario->orgId),
        );
    }

    /** @return list<array<string, mixed>> */
    public function misClientes(): array
    {
        $usuario = Usuario::actual()->exigirRol('mayorista');

        return array_map(
            fn ($r) => Vistas::relacion($r, $this->organizaciones->porId($r->tiendaId), $this->organizaciones->porId($r->mayoristaId)),
            $this->relaciones->aprobadasDe($usuario->orgId),
        );
    }

    /**

     * @param array<string, mixed> $args

     * @return array<string, mixed>

     */
    public function pedirSerCliente(mixed $_, array $args): array
    {
        $tiendaId = Usuario::actual()->orgId;

        return $this->conErrores(fn () => Vistas::relacion(
            $this->clientes->pedirSerCliente($tiendaId, (string) $args['mayoristaId']),
            $this->organizaciones->porId($tiendaId),
            $this->organizaciones->porId((string) $args['mayoristaId']),
        ));
    }

    /**

     * @param array<string, mixed> $args

     * @return array<string, mixed>

     */
    public function aprobarCliente(mixed $_, array $args): array
    {
        $mayoristaId = Usuario::actual()->exigirRol('mayorista')->orgId;

        return $this->conErrores(fn () => Vistas::relacion(
            $this->clientes->aprobar($mayoristaId, (string) $args['tiendaId'], ListaDePrecios::from((string) $args['lista'])),
            $this->organizaciones->porId((string) $args['tiendaId']),
            $this->organizaciones->porId($mayoristaId),
        ));
    }

    /**

     * @param array<string, mixed> $args

     * @return array<string, mixed>

     */
    public function rechazarCliente(mixed $_, array $args): array
    {
        $mayoristaId = Usuario::actual()->exigirRol('mayorista')->orgId;

        return $this->conErrores(fn () => Vistas::relacion(
            $this->clientes->rechazar($mayoristaId, (string) $args['tiendaId']),
            $this->organizaciones->porId((string) $args['tiendaId']),
            $this->organizaciones->porId($mayoristaId),
        ));
    }

    /**

     * @param array<string, mixed> $args

     * @return array<string, mixed>

     */
    public function cargarProducto(mixed $_, array $args): array
    {
        $usuario = Usuario::actual()->exigirRol('mayorista');
        $e = $args['entrada'];

        return $this->conErrores(function () use ($usuario, $e) {
            $producto = $this->cargar->ejecutar(
                $usuario->orgId,
                (string) $e['nombre'],
                (string) $e['rubro'],
                Presentacion::from((string) $e['presentacion']),
                (int) $e['unidades'],
                (int) $e['precioUnitarioCentavos'],
            );

            $vista = $this->catalogo->uno($producto->id, $usuario->orgId)
                ?? throw new ErrorDeDominio('PRODUCTO_NO_GUARDADO', 'No se pudo leer el producto recién cargado');

            return Vistas::producto($vista);
        });
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function crearProducto(mixed $_, array $args): array
    {
        $usuario = Usuario::actual()->exigirRol('mayorista');
        $e = $args['entrada'];

        return $this->conErrores(function () use ($usuario, $e) {
            $producto = $this->crear->ejecutar(
                $usuario->orgId,
                (string) $e['codigo'],
                (string) $e['nombre'],
                (string) $e['rubro'],
                (string) ($e['descripcion'] ?? ''),
                (int) $e['stock'],
                self::escalas($e['escalas']),
                ...self::abastecimiento($e),
                usos: self::usos($e),
            );

            return $this->vistaDe($producto->id, $usuario->orgId);
        });
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function editarProducto(mixed $_, array $args): array
    {
        $usuario = Usuario::actual()->exigirRol('mayorista');
        $e = $args['entrada'] ?? [];

        return $this->conErrores(function () use ($usuario, $args, $e) {
            $producto = $this->editar->ejecutar(
                (string) $args['id'],
                $usuario->orgId,
                isset($e['nombre']) ? (string) $e['nombre'] : null,
                isset($e['rubro']) ? (string) $e['rubro'] : null,
                isset($e['descripcion']) ? (string) $e['descripcion'] : null,
                isset($e['escalas']) ? self::escalas($e['escalas']) : null,
                isset($e['estado']) ? EstadoProducto::from((string) $e['estado']) : null,
                ...self::abastecimiento($e),
                usos: self::usos($e),
            );

            return $this->vistaDe($producto->id, $usuario->orgId);
        });
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function ajustarStock(mixed $_, array $args): array
    {
        $usuario = Usuario::actual()->exigirRol('mayorista');

        return $this->conErrores(function () use ($usuario, $args) {
            $producto = $this->ajustar->ejecutar((string) $args['id'], $usuario->orgId, (int) $args['stock']);

            return $this->vistaDe($producto->id, $usuario->orgId);
        });
    }

    /**
     * @param array<string, mixed> $args
     *
     * @return array<string, mixed>
     */
    public function cambiarFotoDeProducto(mixed $_, array $args): array
    {
        $usuario = Usuario::actual()->exigirRol('mayorista');

        return $this->conErrores(function () use ($usuario, $args) {
            $producto = $this->cambiarFoto->ejecutar((string) $args['id'], $usuario->orgId, (string) $args['imagen']);

            return $this->vistaDe($producto->id, $usuario->orgId);
        });
    }

    /** @return array<string, mixed> */
    private function vistaDe(string $productoId, string $orgId): array
    {
        $vista = $this->catalogo->uno($productoId, $orgId)
            ?? throw new ErrorDeDominio('PRODUCTO_NO_GUARDADO', 'No se pudo leer el producto recién guardado');

        return Vistas::producto($vista);
    }

    /**
     * @param list<array<string, mixed>> $entradas
     *
     * @return list<EscalaDePrecio>
     */
    private static function escalas(array $entradas): array
    {
        return array_map(static fn (array $e) => new EscalaDePrecio(
            Presentacion::from((string) $e['presentacion']),
            (int) $e['unidades'],
            (int) $e['precioUnitarioCentavos'],
        ), $entradas);
    }

    /**
     * A quién se muestra el producto; null si no vino (al editar, no se toca).
     *
     * @param array<string, mixed> $e
     *
     * @return list<string>|null
     */
    private static function usos(array $e): ?array
    {
        return isset($e['usos']) ? array_values(array_map('strval', (array) $e['usos'])) : null;
    }

    /**
     * Los campos opcionales de abastecimiento, con el nombre de los parámetros de crear y editar.
     *
     * @param array<string, mixed> $e
     *
     * @return array{abastecimiento: ?Abastecimiento, entregaHoras: ?int, costoUnitarioCentavos: ?int, proveedor: ?string}
     */
    private static function abastecimiento(array $e): array
    {
        return [
            'abastecimiento' => isset($e['abastecimiento']) ? Abastecimiento::from((string) $e['abastecimiento']) : null,
            'entregaHoras' => isset($e['entregaHoras']) ? (int) $e['entregaHoras'] : null,
            'costoUnitarioCentavos' => isset($e['costoUnitarioCentavos']) ? (int) $e['costoUnitarioCentavos'] : null,
            'proveedor' => isset($e['proveedor']) ? (string) $e['proveedor'] : null,
        ];
    }

    /**
     * @template T
     *
     * @param  callable(): T  $accion
     * @return T
     */
    private function conErrores(callable $accion): mixed
    {
        try {
            return $accion();
        } catch (ErrorDeDominio $e) {
            throw new Error($e->getMessage(), extensions: ['code' => $e->codigo]);
        }
    }
}
