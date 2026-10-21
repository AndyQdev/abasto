<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mongo;

use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use MongoDB\BSON\Regex;
use MongoDB\Collection;

/** Colección `organizaciones`: mayoristas y tiendas. El _id es el org_id del token de Keycloak. */
final readonly class MongoOrganizacionRepositorio implements OrganizacionRepositorio
{
    public function __construct(private Collection $coleccion)
    {
    }

    public function porId(string $id): ?Organizacion
    {
        $doc = $this->coleccion->findOne(['_id' => $id]);

        return $doc === null ? null : self::aDominio((array) $doc);
    }

    public function mayoristas(?string $busqueda = null): array
    {
        $filtro = ['tipo' => 'mayorista', 'verificado' => true];
        if ($busqueda !== null && trim($busqueda) !== '') {
            $filtro['nombre'] = new Regex(preg_quote(trim($busqueda), '/'), 'i');
        }
        $docs = $this->coleccion->find($filtro, ['sort' => ['nombre' => 1]])->toArray();

        return array_values(array_map(static fn ($doc) => self::aDominio((array) $doc), $docs));
    }

    /** @param array<string, mixed> $doc */
    private static function aDominio(array $doc): Organizacion
    {
        return new Organizacion(
            id: (string) $doc['_id'],
            nombre: (string) $doc['nombre'],
            tipo: (string) $doc['tipo'],
            ciudad: (string) ($doc['ciudad'] ?? ''),
            verificado: (bool) ($doc['verificado'] ?? false),
            nit: isset($doc['nit']) ? (string) $doc['nit'] : null,
        );
    }
}
