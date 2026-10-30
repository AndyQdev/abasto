<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mongo;

use Catalogo\Dominio\CodigoDeAcceso;
use Catalogo\Dominio\Puertos\CodigosDeAcceso;
use MongoDB\Collection;

/** Colección `codigos_de_acceso`: uno por celular (_id), solo la huella del código. */
final readonly class MongoCodigosDeAcceso implements CodigosDeAcceso
{
    public function __construct(private Collection $coleccion)
    {
    }

    public function guardar(CodigoDeAcceso $codigo): void
    {
        $this->coleccion->replaceOne(['_id' => $codigo->telefono], [
            'huella' => $codigo->huella,
            'creado_en' => $codigo->creadoEn,
            'intentos' => $codigo->intentos,
        ], ['upsert' => true]);
    }

    public function de(string $telefono): ?CodigoDeAcceso
    {
        $doc = $this->coleccion->findOne(['_id' => $telefono]);
        if ($doc === null) {
            return null;
        }
        $d = (array) $doc;

        return new CodigoDeAcceso($telefono, (string) $d['huella'], (int) $d['creado_en'], (int) ($d['intentos'] ?? 0));
    }

    public function borrar(string $telefono): void
    {
        $this->coleccion->deleteOne(['_id' => $telefono]);
    }
}
