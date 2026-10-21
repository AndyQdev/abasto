<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * Entidad: un producto de un mayorista con su escala de precios por volumen.
 * Las reglas de la escala viven aquí y no en el controlador ni en la base.
 */
final class Producto
{
    /** @param list<EscalaDePrecio> $escalas */
    public function __construct(
        public readonly string $id,
        public readonly string $mayoristaId,
        public readonly string $codigo,
        public string $nombre,
        public string $rubro,
        public string $descripcion,
        public int $stock,
        public EstadoProducto $estado,
        private array $escalas,
    ) {
        self::validarEscalas($escalas);
    }

    /** @return list<EscalaDePrecio> ordenadas de menor a mayor volumen */
    public function escalas(): array
    {
        return $this->escalas;
    }

    /** @param list<EscalaDePrecio> $escalas */
    public function cambiarEscalas(array $escalas): void
    {
        self::validarEscalas($escalas);
        $this->escalas = $escalas;
    }

    public function escalaDe(Presentacion $presentacion): ?EscalaDePrecio
    {
        foreach ($this->escalas as $escala) {
            if ($escala->presentacion === $presentacion) {
                return $escala;
            }
        }

        return null;
    }

    /**
     * Reglas: al menos una escala, sin presentaciones repetidas, más volumen = más unidades
     * y el precio por unidad nunca sube al comprar más.
     *
     * @param list<EscalaDePrecio> $escalas
     */
    private static function validarEscalas(array $escalas): void
    {
        if ($escalas === []) {
            throw new ErrorDeDominio('SIN_ESCALAS', 'El producto necesita al menos un precio');
        }
        $vistas = [];
        $anterior = null;
        foreach ($escalas as $escala) {
            if (isset($vistas[$escala->presentacion->value])) {
                throw new ErrorDeDominio('ESCALA_REPETIDA', "La presentación {$escala->presentacion->value} está dos veces");
            }
            $vistas[$escala->presentacion->value] = true;
            if ($anterior !== null) {
                if ($escala->unidades <= $anterior->unidades) {
                    throw new ErrorDeDominio('ESCALAS_DESORDENADAS', 'Cada presentación tiene que traer más unidades que la anterior');
                }
                if ($escala->precioUnitarioCentavos > $anterior->precioUnitarioCentavos) {
                    throw new ErrorDeDominio('PRECIO_SUBE_CON_VOLUMEN', 'El precio por unidad no puede subir al comprar más');
                }
            }
            $anterior = $escala;
        }
    }
}
