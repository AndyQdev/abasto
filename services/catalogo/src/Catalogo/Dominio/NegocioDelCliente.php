<?php

declare(strict_types=1);

namespace Catalogo\Dominio;

/**
 * Para qué compra el cliente de la app (docs/plan-mi-negocio.md): hogar, tienda o productor. El productor dice además
 * qué hace (salteñería, panadería o pensión), porque eso decide lo que ve primero. Lo elige al registrarse y lo puede
 * cambiar en Cuenta; queda en la organización del cliente, así lo ve en cualquier celular y Abasto en el Superadmin.
 */
final readonly class NegocioDelCliente
{
    public const TIPOS = ['hogar', 'tienda', 'productor'];

    public const SUBTIPOS = ['salteneria', 'panaderia', 'pension'];

    private function __construct(
        public string $tipo,
        public ?string $subtipo,
        /** Cuándo lo eligió o lo cambió por última vez (ISO 8601) */
        public string $elegidoEn,
    ) {
    }

    /** Valida las reglas: un tipo conocido, y subtipo solo (y siempre) para el productor. */
    public static function elegir(string $tipo, ?string $subtipo, string $elegidoEn): self
    {
        $tipo = strtolower(trim($tipo));
        $subtipo = $subtipo === null || trim($subtipo) === '' ? null : strtolower(trim($subtipo));

        if (!in_array($tipo, self::TIPOS, true)) {
            throw new ErrorDeDominio('TIPO_DE_NEGOCIO_INVALIDO', 'El tipo de negocio tiene que ser hogar, tienda o productor');
        }
        if ($tipo === 'productor' && $subtipo === null) {
            throw new ErrorDeDominio('FALTA_SUBTIPO', 'Dinos qué haces: salteñería, panadería o pensión');
        }
        if ($tipo !== 'productor' && $subtipo !== null) {
            throw new ErrorDeDominio('SUBTIPO_NO_CORRESPONDE', 'Solo el productor elige qué hace');
        }
        if ($subtipo !== null && !in_array($subtipo, self::SUBTIPOS, true)) {
            throw new ErrorDeDominio('SUBTIPO_INVALIDO', 'Lo que haces tiene que ser salteñería, panadería o pensión');
        }

        return new self($tipo, $subtipo, $elegidoEn);
    }
}
