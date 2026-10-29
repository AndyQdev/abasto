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
 * El mayorista edita un producto suyo en el Panel. Solo cambian los campos que envía;
 * el código no se toca y el estado se limita a lo que él fija con la mano.
 */
final readonly class EditarProducto
{
    public function __construct(private ProductoRepositorio $productos)
    {
    }

    /**
     * @param list<EscalaDePrecio>|null $escalas
     */
    public function ejecutar(
        string $productoId,
        string $mayoristaId,
        ?string $nombre = null,
        ?string $rubro = null,
        ?string $descripcion = null,
        ?array $escalas = null,
        ?EstadoProducto $estado = null,
        ?Abastecimiento $abastecimiento = null,
        ?int $entregaHoras = null,
        ?int $costoUnitarioCentavos = null,
        ?string $proveedor = null,
    ): Producto {
        $producto = $this->productos->porId($productoId)
            ?? throw new ErrorDeDominio('PRODUCTO_INEXISTENTE', 'El producto no existe o fue dado de baja');
        if ($producto->mayoristaId !== $mayoristaId) {
            throw new ErrorDeDominio('PRODUCTO_AJENO', 'El producto no es de tu empresa');
        }
        if ($estado !== null && ! in_array($estado, [EstadoProducto::ACTIVO, EstadoProducto::PAUSADO], true)) {
            throw new ErrorDeDominio('ESTADO_INVALIDO', 'Aquí el estado solo puede ser ACTIVO o PAUSADO');
        }

        if ($nombre !== null) {
            $producto->nombre = $nombre;
        }
        if ($rubro !== null) {
            $producto->rubro = $rubro;
        }
        if ($descripcion !== null) {
            $producto->descripcion = $descripcion;
        }
        if ($escalas !== null) {
            $producto->cambiarEscalas($escalas);
        }
        if ($abastecimiento !== null || $entregaHoras !== null || $costoUnitarioCentavos !== null || $proveedor !== null) {
            $producto->cambiarAbastecimiento(
                $abastecimiento ?? $producto->abastecimiento,
                $entregaHoras ?? $producto->entregaHoras,
                $costoUnitarioCentavos ?? $producto->costoUnitarioCentavos,
                $proveedor ?? $producto->proveedor,
            );
        }
        if ($estado !== null) {
            // Activar un producto sin mercadería lo deja visible pero sin stock, nunca "activo con 0".
            // Bajo pedido no tiene stock: activarlo lo deja a la venta.
            $producto->estado = $estado === EstadoProducto::ACTIVO && $producto->stock === 0 && ! $producto->bajoPedido()
                ? EstadoProducto::SIN_STOCK
                : $estado;
        }
        $this->productos->guardar($producto);

        return $producto;
    }
}
