<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * El código de 6 dígitos que se manda al celular. Se guarda solo su huella (hash), dura 5 minutos
 * y admite 5 intentos; después hay que pedir otro.
 */
final readonly class CodigoDeAcceso
{
    public const DURA_SEGUNDOS = 300;
    public const INTENTOS = 5;
    public const ESPERA_PARA_REENVIAR = 30;

    public function __construct(
        public string $telefono,
        public string $huella,
        public int $creadoEn,
        public int $intentos = 0,
    ) {
    }

    public static function huellaDe(string $telefono, string $codigo): string
    {
        return hash('sha256', $telefono.':'.$codigo);
    }

    public function vencido(int $ahora): bool
    {
        return $ahora - $this->creadoEn > self::DURA_SEGUNDOS;
    }

    public function agotado(): bool
    {
        return $this->intentos >= self::INTENTOS;
    }

    public function puedeReenviarse(int $ahora): bool
    {
        return $ahora - $this->creadoEn >= self::ESPERA_PARA_REENVIAR;
    }

    public function coincide(string $codigo): bool
    {
        return hash_equals($this->huella, self::huellaDe($this->telefono, $codigo));
    }

    public function conOtroIntento(): self
    {
        return new self($this->telefono, $this->huella, $this->creadoEn, $this->intentos + 1);
    }
}
