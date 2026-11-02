<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\NegocioDelCliente;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Closure;

/**
 * El cliente de la app elige (o cambia) para qué compra: hogar, tienda o productor (docs/plan-mi-negocio.md).
 * Queda en su organización: al entrar con el mismo número en otro celular, la app lo lee de aquí y no lo vuelve a preguntar.
 */
final readonly class ElegirTipoDeNegocio
{
    /** @param Closure(): string $ahora la fecha y hora actual en ISO 8601 */
    public function __construct(private OrganizacionRepositorio $organizaciones, private Closure $ahora)
    {
    }

    public static function conReloj(OrganizacionRepositorio $organizaciones): self
    {
        return new self(
            $organizaciones,
            static fn (): string => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM),
        );
    }

    public function elegir(string $orgId, string $tipo, ?string $subtipo): Organizacion
    {
        $negocio = NegocioDelCliente::elegir($tipo, $subtipo, ($this->ahora)());
        $cliente = $this->cliente($orgId)->conNegocio($negocio);
        $this->organizaciones->guardar($cliente);

        return $cliente;
    }

    /** Lo que eligió; null si todavía no eligió nada. */
    public function actual(string $orgId): ?NegocioDelCliente
    {
        return $this->cliente($orgId)->negocio;
    }

    private function cliente(string $orgId): Organizacion
    {
        return $this->organizaciones->porId($orgId)
            ?? throw new ErrorDeDominio('CLIENTE_NO_EXISTE', 'Tu cuenta no tiene empresa');
    }
}
