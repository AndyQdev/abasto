<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

/** Guarda la foto de un producto y devuelve el nombre del archivo; la URL pública la arma la infraestructura. */
interface AlmacenDeFotos
{
    /** @param string $extension jpg, png o webp */
    public function guardar(string $productoId, string $bytes, string $extension): string;
}
