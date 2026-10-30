<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\CodigoDeAcceso;

/** Los códigos vigentes, uno por celular. */
interface CodigosDeAcceso
{
    public function guardar(CodigoDeAcceso $codigo): void;

    public function de(string $telefono): ?CodigoDeAcceso;

    public function borrar(string $telefono): void;
}
