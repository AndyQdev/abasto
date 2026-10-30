<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/** Los tokens que recibe la app al entrar con su celular. */
final readonly class SesionEmitida
{
    public function __construct(
        public string $acceso,
        public string $renovacion,
        public int $venceEnSegundos,
    ) {
    }
}
