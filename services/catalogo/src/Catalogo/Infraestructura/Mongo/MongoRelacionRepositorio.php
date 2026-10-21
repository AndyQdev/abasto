<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mongo;

use Catalogo\Dominio\EstadoRelacion;
use Catalogo\Dominio\ListaDePrecios;
use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Dominio\RelacionComercial;
use MongoDB\Collection;

/** Colección `relaciones`: { _id: "tienda|mayorista", tienda_id, mayorista_id, estado, lista } */
final readonly class MongoRelacionRepositorio implements RelacionRepositorio
{
    public function __construct(private Collection $coleccion)
    {
    }

    public function de(string $tiendaId, string $mayoristaId): ?RelacionComercial
    {
        $doc = $this->coleccion->findOne(['_id' => "{$tiendaId}|{$mayoristaId}"]);

        return $doc === null ? null : self::aDominio((array) $doc);
    }

    public function deTienda(string $tiendaId): array
    {
        $resultado = [];
        foreach ($this->coleccion->find(['tienda_id' => $tiendaId]) as $doc) {
            $relacion = self::aDominio((array) $doc);
            $resultado[$relacion->mayoristaId] = $relacion;
        }

        return $resultado;
    }

    public function solicitudesDe(string $mayoristaId): array
    {
        $docs = $this->coleccion->find(['mayorista_id' => $mayoristaId, 'estado' => EstadoRelacion::SOLICITADA->value])->toArray();

        return array_values(array_map(static fn ($doc) => self::aDominio((array) $doc), $docs));
    }

    public function guardar(RelacionComercial $relacion): void
    {
        $this->coleccion->replaceOne(
            ['_id' => "{$relacion->tiendaId}|{$relacion->mayoristaId}"],
            [
                'tienda_id' => $relacion->tiendaId,
                'mayorista_id' => $relacion->mayoristaId,
                'estado' => $relacion->estado()->value,
                'lista' => $relacion->lista()?->value,
            ],
            ['upsert' => true],
        );
    }

    /** @param array<string, mixed> $doc */
    private static function aDominio(array $doc): RelacionComercial
    {
        return new RelacionComercial(
            (string) $doc['tienda_id'],
            (string) $doc['mayorista_id'],
            EstadoRelacion::from((string) $doc['estado']),
            isset($doc['lista']) ? ListaDePrecios::from((string) $doc['lista']) : null,
        );
    }
}
