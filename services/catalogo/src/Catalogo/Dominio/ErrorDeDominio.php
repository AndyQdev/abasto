<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

use DomainException;

/** Una regla del negocio que no se cumple. El código viaja a GraphQL para que la app muestre el motivo. */
final class ErrorDeDominio extends DomainException
{
    public function __construct(public readonly string $codigo, string $mensaje)
    {
        parent::__construct($mensaje);
    }
}
