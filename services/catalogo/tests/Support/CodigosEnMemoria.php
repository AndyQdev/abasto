<?php

declare(strict_types=1);

namespace Tests\Support;

use Catalogo\Dominio\CodigoDeAcceso;
use Catalogo\Dominio\Puertos\CodigosDeAcceso;
use Catalogo\Dominio\Puertos\EnviadorDeCodigos;

final class CodigosEnMemoria implements CodigosDeAcceso, EnviadorDeCodigos
{
    /** @var array<string, CodigoDeAcceso> */
    public array $vigentes = [];

    /** @var array<string, string> lo que se «mandó» a cada celular */
    public array $enviados = [];

    public function __construct(private bool $dePrueba = true)
    {
    }

    public function guardar(CodigoDeAcceso $codigo): void
    {
        $this->vigentes[$codigo->telefono] = $codigo;
    }

    public function de(string $telefono): ?CodigoDeAcceso
    {
        return $this->vigentes[$telefono] ?? null;
    }

    public function borrar(string $telefono): void
    {
        unset($this->vigentes[$telefono]);
    }

    public function enviar(string $telefono, string $codigo): void
    {
        $this->enviados[$telefono] = $codigo;
    }

    public function esDePrueba(): bool
    {
        return $this->dePrueba;
    }
}
