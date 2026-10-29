<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\EstadoRelacion;
use Catalogo\Dominio\PoliticaDePrecios;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Dominio\RelacionComercial;

/** Caso de uso: buscar en el catálogo. Aplica la red privada a cada producto. */
final readonly class ConsultarCatalogo
{
    public function __construct(
        private ProductoRepositorio $productos,
        private RelacionRepositorio $relaciones,
        private OrganizacionRepositorio $organizaciones,
    ) {
    }

    /** @return list<VistaDeProducto> */
    public function paraTienda(string $orgId, ?string $busqueda = null, ?string $mayoristaId = null): array
    {
        $relaciones = $this->relaciones->deTienda($orgId);
        // Un distribuidor que también compra no se ve a sí mismo como proveedor
        $ajenos = array_values(array_filter(
            $this->productos->publicados($busqueda, $mayoristaId),
            static fn (Producto $p) => $p->mayoristaId !== $orgId,
        ));

        return array_map(fn (Producto $p) => $this->vista($p, $orgId, $relaciones[$p->mayoristaId] ?? null), $ajenos);
    }

    /** @return list<VistaDeProducto> */
    public function delMayorista(string $mayoristaId, ?string $busqueda = null): array
    {
        return array_map(
            fn (Producto $p) => $this->vista($p, $mayoristaId, null),
            $this->productos->deMayorista($mayoristaId, $busqueda),
        );
    }

    public function uno(string $productoId, string $orgId): ?VistaDeProducto
    {
        $producto = $this->productos->porId($productoId);
        if ($producto === null) {
            return null;
        }

        return $this->vista($producto, $orgId, $this->relaciones->de($orgId, $producto->mayoristaId));
    }

    private function vista(Producto $producto, string $orgId, ?RelacionComercial $relacion): VistaDeProducto
    {
        $mayorista = $this->organizaciones->porId($producto->mayoristaId);

        return new VistaDeProducto(
            $producto,
            $mayorista,
            PoliticaDePrecios::escalasPara($producto, $orgId, $relacion, $mayorista->deLaCasa ?? false),
            $relacion?->estado() ?? EstadoRelacion::NINGUNA,
            $producto->mayoristaId === $orgId,
        );
    }
}
