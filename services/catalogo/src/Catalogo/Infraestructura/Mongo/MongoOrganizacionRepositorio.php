<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mongo;

use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\NegocioDelCliente;
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
        $filtro = ['tipo' => 'mayorista', 'verificacion' => EstadoVerificacion::VERIFICADO->value];
        if ($busqueda !== null && trim($busqueda) !== '') {
            $filtro['nombre'] = new Regex(preg_quote(trim($busqueda), '/'), 'i');
        }
        $docs = $this->coleccion->find($filtro, ['sort' => ['nombre' => 1]])->toArray();

        return array_values(array_map(static fn ($doc) => self::aDominio((array) $doc), $docs));
    }

    public function guardar(Organizacion $organizacion): void
    {
        // $set y no replace: la semilla guarda campos que este repositorio no conoce
        $this->coleccion->updateOne(['_id' => $organizacion->id], ['$set' => [
            'nombre' => $organizacion->nombre,
            'tipo' => $organizacion->tipo,
            'ciudad' => $organizacion->ciudad,
            'verificacion' => $organizacion->verificacion->value,
            'verificado' => $organizacion->estaVerificada(),
            'nit' => $organizacion->nit,
            'de_la_casa' => $organizacion->deLaCasa,
            'representante' => $organizacion->representante,
            'telefono' => $organizacion->telefono,
            'correo' => $organizacion->correo,
            'motivo_rechazo' => $organizacion->motivoRechazo,
            'registrada_en' => $organizacion->registradaEn,
            'negocio' => $organizacion->negocio === null ? null : [
                'tipo' => $organizacion->negocio->tipo,
                'subtipo' => $organizacion->negocio->subtipo,
                'elegido_en' => $organizacion->negocio->elegidoEn,
            ],
        ]], ['upsert' => true]);
    }

    public function porNit(string $nit): ?Organizacion
    {
        $doc = $this->coleccion->findOne(['nit' => $nit]);

        return $doc === null ? null : self::aDominio((array) $doc);
    }

    public function porTelefono(string $telefono): ?Organizacion
    {
        $doc = $this->coleccion->findOne(['telefono' => $telefono]);

        return $doc === null ? null : self::aDominio((array) $doc);
    }

    public function mayoristasPorVerificacion(EstadoVerificacion $estado): array
    {
        $docs = $this->coleccion->find(
            ['tipo' => 'mayorista', 'verificacion' => $estado->value],
            ['sort' => ['registrada_en' => -1, 'nombre' => 1]],
        )->toArray();

        return array_values(array_map(static fn ($doc) => self::aDominio((array) $doc), $docs));
    }

    /** @param array<string, mixed> $doc */
    private static function aDominio(array $doc): Organizacion
    {
        // Compatibilidad: un documento viejo solo guarda el booleano `verificado`.
        $verificacion = isset($doc['verificacion'])
            ? EstadoVerificacion::from((string) $doc['verificacion'])
            : ((bool) ($doc['verificado'] ?? false) ? EstadoVerificacion::VERIFICADO : EstadoVerificacion::PENDIENTE);

        return new Organizacion(
            id: (string) $doc['_id'],
            nombre: (string) $doc['nombre'],
            tipo: (string) $doc['tipo'],
            ciudad: (string) ($doc['ciudad'] ?? ''),
            verificacion: $verificacion,
            nit: isset($doc['nit']) ? (string) $doc['nit'] : null,
            deLaCasa: (bool) ($doc['de_la_casa'] ?? false),
            representante: self::texto($doc, 'representante'),
            telefono: self::texto($doc, 'telefono'),
            correo: self::texto($doc, 'correo'),
            motivoRechazo: self::texto($doc, 'motivo_rechazo'),
            registradaEn: self::texto($doc, 'registrada_en'),
            negocio: self::negocio($doc['negocio'] ?? null),
        );
    }

    /** El tipo de negocio guardado; un documento sin él (mayoristas, clientes que no eligieron) da null */
    private static function negocio(mixed $guardado): ?NegocioDelCliente
    {
        if ($guardado === null) {
            return null;
        }
        $n = (array) $guardado;
        if (!isset($n['tipo'])) {
            return null;
        }

        return NegocioDelCliente::elegir(
            (string) $n['tipo'],
            isset($n['subtipo']) ? (string) $n['subtipo'] : null,
            (string) ($n['elegido_en'] ?? ''),
        );
    }

    /** @param array<string, mixed> $doc */
    private static function texto(array $doc, string $campo): ?string
    {
        return isset($doc[$campo]) ? (string) $doc[$campo] : null;
    }
}
