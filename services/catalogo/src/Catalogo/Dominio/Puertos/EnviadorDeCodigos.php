<?php

declare(strict_types=1);

namespace Catalogo\Dominio\Puertos;

/** Manda el código al celular. Después será por WhatsApp; mientras tanto, el de prueba no manda nada. */
interface EnviadorDeCodigos
{
    public function enviar(string $telefono, string $codigo): void;

    /** En modo prueba el código vuelve en la respuesta, para que la app lo muestre sin WhatsApp. */
    public function esDePrueba(): bool;
}
