<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

use Catalogo\Dominio\Organizacion;

interface OrganizacionRepositorio
{
    public function porId(string $id): ?Organizacion;

    /** @return list<Organizacion> */
    public function mayoristas(?string $busqueda = null): array;
}
