<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\GraphQL;

use Catalogo\Aplicacion\AjustarStock;
use Catalogo\Aplicacion\CargarProducto;
use Catalogo\Aplicacion\ConsultarCatalogo;
use Catalogo\Aplicacion\CrearProducto;
use Catalogo\Aplicacion\EditarProducto;
use Catalogo\Aplicacion\GestionarClientes;
use Catalogo\Aplicacion\VistaDeProducto;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\ListaDePrecios;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Presentacion;
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
        private CargarProducto $cargar,
        private CrearProducto $crear,
        private EditarProducto $editar,
        private AjustarStock $ajustar,
        private OrganizacionRepositorio $organizaciones,
        private RelacionRepositorio $relaciones,
    ) {
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
        $usuario = Usuario::actual()->exigirRol('mayorista');
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
