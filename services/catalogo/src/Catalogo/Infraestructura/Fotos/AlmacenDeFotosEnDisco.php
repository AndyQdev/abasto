<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Fotos;

use Catalogo\Dominio\Puertos\AlmacenDeFotos;

/**
 * Las fotos quedan en storage/app/public/fotos (ignorado por git) y se sirven en GET /fotos/{archivo}.
 * El nombre lleva un hash del contenido: al cambiar la foto cambia la URL y nadie ve la vieja en caché.
 */
final readonly class AlmacenDeFotosEnDisco implements AlmacenDeFotos
{
    public function __construct(private string $carpeta)
    {
    }

    public function guardar(string $productoId, string $bytes, string $extension): string
    {
        if (! is_dir($this->carpeta)) {
            mkdir($this->carpeta, 0775, true);
        }
        $seguro = preg_replace('/[^A-Za-z0-9_-]/', '', $productoId);
        $archivo = "{$seguro}-".substr(hash('sha256', $bytes), 0, 12).".{$extension}";
        file_put_contents("{$this->carpeta}/{$archivo}", $bytes);

        return $archivo;
    }
}
