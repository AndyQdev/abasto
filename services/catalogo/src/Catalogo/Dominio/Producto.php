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
        public Abastecimiento $abastecimiento = Abastecimiento::STOCK,
        /** Horas desde el pedido hasta la entrega, para mostrarle a la tienda cuándo llega */
        public ?int $entregaHoras = null,
        /** Lo que le cuesta al mayorista cada unidad. Solo lo ve él: sirve para su margen */
        public ?int $costoUnitarioCentavos = null,
        /** Dónde lo compra (puesto, mercado o distribuidora). Solo lo ve él */
        public ?string $proveedor = null,
        /** Archivo de la foto en el almacén de fotos (no la URL: la arma la infraestructura). Null si no tiene */
        public ?string $foto = null,
        /** La marca (PIL, Fino…), para agrupar y buscar. Null si no se cargó */
        public ?string $marca = null,
        /** La marca es boliviana: va en «Marcas de aquí». Solo se marca lo que está verificado */
        public bool $marcaBoliviana = false,
        /** Lo que cuesta al público en un supermercado, para comparar. Null si no se tomó */
        public ?PrecioDeReferencia $precioEnSuper = null,
        /** El precio es de demostración: todavía no se cotizó en el mercado. La app lo avisa en la tarjeta */
        public bool $precioPorConfirmar = false,
        /**
         * A quién se le muestra en el Inicio de la app (USOS): hogar, tienda o un área del productor. Buscar encuentra todo;
         * esto solo decide qué ve primero cada uno (un panadero no ve yogurt). Lo edita Abasto en el Panel.
         *
         * @var list<string>
         */
        private array $usos = [],
    ) {
        self::validarEscalas($escalas);
        self::validarCosto($costoUnitarioCentavos);
        $this->usos = self::validarUsos($usos);
    }

    /** Hogar, tienda y las 6 áreas del productor (las mismas claves que NegocioDelCliente::SUBTIPOS). */
    public const USOS = ['hogar', 'tienda', 'salteneria', 'panaderia', 'horneados', 'pension', 'polleria', 'puesto'];

    /** @return list<string> en el orden de USOS */
    public function usos(): array
    {
        return $this->usos;
    }

    /** @param list<string> $usos */
    public function cambiarUsos(array $usos): void
    {
        $this->usos = self::validarUsos($usos);
    }

    /**
     * @param list<string> $usos
     *
     * @return list<string> sin repetidos y en el orden de USOS
     */
    private static function validarUsos(array $usos): array
    {
        $limpios = array_map(static fn (string $u) => strtolower(trim($u)), $usos);
        foreach ($limpios as $u) {
            if (! in_array($u, self::USOS, true)) {
                throw new ErrorDeDominio('USO_INVALIDO', "«{$u}» no es un uso: tiene que ser ".implode(', ', self::USOS));
            }
        }

        return array_values(array_filter(self::USOS, static fn (string $u) => in_array($u, $limpios, true)));
    }

    public function bajoPedido(): bool
    {
        return $this->abastecimiento === Abastecimiento::BAJO_PEDIDO;
    }

    /** Fija cómo se abastece, cuánto le cuesta y dónde lo compra. Un producto bajo pedido nunca queda SIN_STOCK. */
    public function cambiarAbastecimiento(Abastecimiento $abastecimiento, ?int $entregaHoras, ?int $costoUnitarioCentavos, ?string $proveedor): void
    {
        self::validarCosto($costoUnitarioCentavos);
        if ($entregaHoras !== null && $entregaHoras < 1) {
            throw new ErrorDeDominio('ENTREGA_INVALIDA', 'La entrega tiene que ser de al menos una hora');
        }
        $this->abastecimiento = $abastecimiento;
        $this->entregaHoras = $entregaHoras;
        $this->costoUnitarioCentavos = $costoUnitarioCentavos;
        $this->proveedor = $proveedor === null || trim($proveedor) === '' ? null : trim($proveedor);
        if ($this->bajoPedido() && $this->estado === EstadoProducto::SIN_STOCK) {
            $this->estado = EstadoProducto::ACTIVO;
        }
    }

    public function cambiarFoto(string $archivo): void
    {
        if (trim($archivo) === '') {
            throw new ErrorDeDominio('FOTO_INVALIDA', 'La foto no tiene archivo');
        }
        $this->foto = $archivo;
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
     * Corrige el stock a mano y deriva el estado: sin mercadería => SIN_STOCK,
     * vuelve a haber => ACTIVO. PAUSADO y PENDIENTE_DE_REVISION los cambia el mayorista,
     * no el stock.
     */
    public function ajustarStock(int $nuevoStock): void
    {
        if ($nuevoStock < 0) {
            throw new ErrorDeDominio('STOCK_INVALIDO', 'El stock no puede quedar negativo');
        }
        $this->stock = $nuevoStock;
        if ($this->bajoPedido()) {
            return; // se compra cuando entra el pedido: el stock no decide si está a la venta
        }
        if ($nuevoStock === 0 && $this->estado === EstadoProducto::ACTIVO) {
            $this->estado = EstadoProducto::SIN_STOCK;
        } elseif ($nuevoStock > 0 && $this->estado === EstadoProducto::SIN_STOCK) {
            $this->estado = EstadoProducto::ACTIVO;
        }
    }

    private static function validarCosto(?int $costo): void
    {
        if ($costo !== null && $costo < 0) {
            throw new ErrorDeDominio('COSTO_INVALIDO', 'El costo no puede ser negativo');
        }
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
