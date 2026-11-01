<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mongo;

use Catalogo\Dominio\Abastecimiento;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\PrecioDeReferencia;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Illuminate\Support\Str;
use MongoDB\BSON\Regex;
use MongoDB\Collection;

/**
 * Adaptador de salida sobre la colección `productos`. Las escalas viven dentro del documento:
 * { _id, mayorista_id, codigo, nombre, rubro, descripcion, stock, estado,
 *   escalas: [{ presentacion, unidades, precio_unitario_centavos }] }
 */
final readonly class MongoProductoRepositorio implements ProductoRepositorio
{
    public function __construct(private Collection $coleccion, private Collection $organizaciones)
    {
    }

    public function porId(string $id): ?Producto
    {
        $doc = $this->coleccion->findOne(['_id' => $id]);

        return $doc === null ? null : self::aDominio((array) $doc);
    }

    public function porCodigo(string $mayoristaId, string $codigo): ?Producto
    {
        $doc = $this->coleccion->findOne(['mayorista_id' => $mayoristaId, 'codigo' => $codigo]);

        return $doc === null ? null : self::aDominio((array) $doc);
    }

    public function deMayorista(string $mayoristaId, ?string $busqueda = null): array
    {
        return $this->buscar(['mayorista_id' => $mayoristaId] + self::filtroDeTexto($busqueda));
    }

    public function publicados(?string $busqueda = null, ?string $mayoristaId = null): array
    {
        $verificados = array_map(
            static fn ($o) => (string) $o['_id'],
            $this->organizaciones->find(['tipo' => 'mayorista', 'verificacion' => EstadoVerificacion::VERIFICADO->value], ['projection' => ['_id' => 1]])->toArray(),
        );
        $mayoristas = $mayoristaId === null ? $verificados : array_values(array_intersect($verificados, [$mayoristaId]));

        return $this->buscar(
            ['mayorista_id' => ['$in' => $mayoristas], 'estado' => ['$in' => ['ACTIVO', 'SIN_STOCK']]] + self::filtroDeTexto($busqueda),
        );
    }

    public function guardar(Producto $producto): void
    {
        // El stock va en $setOnInsert: solo se escribe al crear (ver el puerto)
        $this->coleccion->updateOne(['_id' => $producto->id], [
            '$set' => [
                'mayorista_id' => $producto->mayoristaId,
                'codigo' => $producto->codigo,
                'nombre' => $producto->nombre,
                'rubro' => $producto->rubro,
                'descripcion' => $producto->descripcion,
                'estado' => $producto->estado->value,
                'escalas' => array_map(static fn (EscalaDePrecio $e) => [
                    'presentacion' => $e->presentacion->value,
                    'unidades' => $e->unidades,
                    'precio_unitario_centavos' => $e->precioUnitarioCentavos,
                ], $producto->escalas()),
                'abastecimiento' => $producto->abastecimiento->value,
                'entrega_horas' => $producto->entregaHoras,
                'costo_unitario_centavos' => $producto->costoUnitarioCentavos,
                'proveedor' => $producto->proveedor,
                'foto' => $producto->foto,
                'marca' => $producto->marca,
                'marca_boliviana' => $producto->marcaBoliviana,
                'precio_en_super' => $producto->precioEnSuper === null ? null : [
                    'centavos' => $producto->precioEnSuper->centavos,
                    'donde' => $producto->precioEnSuper->donde,
                    'fecha' => $producto->precioEnSuper->fecha,
                ],
                'precio_por_confirmar' => $producto->precioPorConfirmar,
            ],
            '$setOnInsert' => ['stock' => $producto->stock],
        ], ['upsert' => true]);
    }

    public function fijarStock(Producto $producto): void
    {
        $this->coleccion->updateOne(
            ['_id' => $producto->id],
            ['$set' => ['stock' => $producto->stock, 'estado' => $producto->estado->value]],
        );
    }

    public function siguienteId(): string
    {
        return (string) Str::ulid();
    }

    public function descontarStock(string $id, int $unidades): bool
    {
        // Una sola actualización condicional: nadie más puede colarse entre la lectura y la escritura
        $resultado = $this->coleccion->updateOne(
            ['_id' => $id, 'stock' => ['$gte' => $unidades]],
            ['$inc' => ['stock' => -$unidades]],
        );

        return $resultado->getModifiedCount() === 1;
    }

    public function devolverStock(string $id, int $unidades): void
    {
        $this->coleccion->updateOne(['_id' => $id], ['$inc' => ['stock' => $unidades]]);
    }

    /**

     * @param array<string, mixed> $filtro

     * @return list<Producto>

     */
    private function buscar(array $filtro): array
    {
        $docs = $this->coleccion->find($filtro, ['sort' => ['nombre' => 1], 'limit' => 200])->toArray();

        return array_values(array_map(static fn ($doc) => self::aDominio((array) $doc), $docs));
    }

    /** @return array<string, mixed> */
    private static function filtroDeTexto(?string $busqueda): array
    {
        if ($busqueda === null || trim($busqueda) === '') {
            return [];
        }

        return ['nombre' => new Regex(preg_quote(trim($busqueda), '/'), 'i')];
    }

    /** @param array<string, mixed> $doc */
    private static function aDominio(array $doc): Producto
    {
        $escalas = [];
        foreach ((array) $doc['escalas'] as $e) {
            $e = (array) $e;
            $escalas[] = new EscalaDePrecio(
                Presentacion::from((string) $e['presentacion']),
                (int) $e['unidades'],
                (int) $e['precio_unitario_centavos'],
            );
        }

        return new Producto(
            id: (string) $doc['_id'],
            mayoristaId: (string) $doc['mayorista_id'],
            codigo: (string) $doc['codigo'],
            nombre: (string) $doc['nombre'],
            rubro: (string) ($doc['rubro'] ?? ''),
            descripcion: (string) ($doc['descripcion'] ?? ''),
            stock: (int) ($doc['stock'] ?? 0),
            estado: EstadoProducto::from((string) $doc['estado']),
            escalas: $escalas,
            // Un documento viejo no tiene estos campos: es un producto con stock, sin costo cargado
            abastecimiento: Abastecimiento::tryFrom((string) ($doc['abastecimiento'] ?? '')) ?? Abastecimiento::STOCK,
            entregaHoras: isset($doc['entrega_horas']) ? (int) $doc['entrega_horas'] : null,
            costoUnitarioCentavos: isset($doc['costo_unitario_centavos']) ? (int) $doc['costo_unitario_centavos'] : null,
            proveedor: isset($doc['proveedor']) ? (string) $doc['proveedor'] : null,
            foto: isset($doc['foto']) ? (string) $doc['foto'] : null,
            marca: isset($doc['marca']) ? (string) $doc['marca'] : null,
            marcaBoliviana: (bool) ($doc['marca_boliviana'] ?? false),
            precioEnSuper: self::referencia($doc['precio_en_super'] ?? null),
            precioPorConfirmar: (bool) ($doc['precio_por_confirmar'] ?? false),
        );
    }

    private static function referencia(mixed $guardada): ?PrecioDeReferencia
    {
        if ($guardada === null) {
            return null;
        }
        $r = (array) $guardada;

        return new PrecioDeReferencia((int) $r['centavos'], (string) $r['donde'], (string) $r['fecha']);
    }
}
