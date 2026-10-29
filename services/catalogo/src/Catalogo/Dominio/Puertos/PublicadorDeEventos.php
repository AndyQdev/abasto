<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

/**
 * Puerto de salida hacia el bus de eventos (abasto.eventos). El mensaje lleva un id que depende solo
 * del tipo y del pedido: repetir una respuesta no cuenta dos veces en quien la recibe.
 */
interface PublicadorDeEventos
{
    /** @param array<string, mixed> $datos */
    public function publicar(string $tipo, string $pedidoId, string $orgId, array $datos): void;
}
