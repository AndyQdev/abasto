<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;

final class OrganizacionesEnMemoria implements OrganizacionRepositorio
{
    /** @var array<string, Organizacion> */
    public array $todas = [];

    public function guardar(Organizacion $o): void
    {
        $this->todas[$o->id] = $o;
    }

    public function porId(string $id): ?Organizacion
    {
        return $this->todas[$id] ?? null;
    }

    public function mayoristas(?string $busqueda = null): array
    {
        return array_values(array_filter($this->todas, static fn (Organizacion $o) => $o->esMayorista()));
    }
}
