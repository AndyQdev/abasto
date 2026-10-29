<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

/**
 * Puerto de salida hacia el bus de eventos (abasto.eventos). El id del mensaje depende solo del tipo y de
 * la clave (por defecto, el pedido): repetir una respuesta no cuenta dos veces en quien la recibe.
 * Cuando un mismo pedido produce varios mensajes del mismo tipo, cada uno lleva su propia clave.
 */
interface PublicadorDeEventos
{
    /** @param array<string, mixed> $datos */
    public function publicar(string $tipo, string $pedidoId, string $orgId, array $datos, ?string $clave = null): void;
}
