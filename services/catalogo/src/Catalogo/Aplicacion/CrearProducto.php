<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\Abastecimiento;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;

/**
 * El mayorista crea un producto a mano en el Panel. El código lo pone él y es único
 * dentro de su empresa; si empieza sin mercadería queda publicado como SIN_STOCK.
 */
final readonly class CrearProducto
{
    public function __construct(private ProductoRepositorio $productos)
    {
    }

    /**
     * @param list<EscalaDePrecio> $escalas
     * @param list<string>|null    $usos
     */
    public function ejecutar(
        string $mayoristaId,
        string $codigo,
        string $nombre,
        string $rubro,
        string $descripcion,
        int $stock,
        array $escalas,
        ?Abastecimiento $abastecimiento = null,
        ?int $entregaHoras = null,
        ?int $costoUnitarioCentavos = null,
        ?string $proveedor = null,
        ?array $usos = null,
    ): Producto {
        $codigo = strtoupper(trim($codigo));
        if ($codigo === '') {
            throw new ErrorDeDominio('CODIGO_INVALIDO', 'El producto necesita un código');
        }
        if ($stock < 0) {
            throw new ErrorDeDominio('STOCK_INVALIDO', 'El stock no puede quedar negativo');
        }
        if ($this->productos->porCodigo($mayoristaId, $codigo) !== null) {
            throw new ErrorDeDominio('CODIGO_REPETIDO', "Ya tienes un producto con el código {$codigo}");
        }

        $producto = new Producto(
            id: $this->productos->siguienteId(),
            mayoristaId: $mayoristaId,
            codigo: $codigo,
            nombre: $nombre,
            rubro: $rubro,
            descripcion: $descripcion,
            stock: $stock,
            estado: $stock > 0 ? EstadoProducto::ACTIVO : EstadoProducto::SIN_STOCK,
            escalas: $escalas,
            usos: $usos ?? [],
        );
        // Bajo pedido queda a la venta aunque empiece en 0 (cambiarAbastecimiento lo pasa a ACTIVO)
        $producto->cambiarAbastecimiento($abastecimiento ?? Abastecimiento::STOCK, $entregaHoras, $costoUnitarioCentavos, $proveedor);
        $this->productos->guardar($producto);

        return $producto;
    }
}
