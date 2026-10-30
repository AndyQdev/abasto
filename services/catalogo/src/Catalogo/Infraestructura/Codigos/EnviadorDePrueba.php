<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Codigos;

use Catalogo\Dominio\Puertos\EnviadorDeCodigos;
use Illuminate\Support\Facades\Log;

/**
 * Mientras no está conectado WhatsApp: no manda nada y el código vuelve en la respuesta
 * para que la app lo muestre. Con CODIGOS_DE_PRUEBA=false no se devuelve (y no se envía: falta WhatsApp).
 */
final readonly class EnviadorDePrueba implements EnviadorDeCodigos
{
    public function __construct(private bool $devolverCodigo)
    {
    }

    public function enviar(string $telefono, string $codigo): void
    {
        Log::info('Código de acceso pedido (modo prueba, sin WhatsApp)', ['telefono' => '…'.substr($telefono, -4)]);
    }

    public function esDePrueba(): bool
    {
        return $this->devolverCodigo;
    }
}
