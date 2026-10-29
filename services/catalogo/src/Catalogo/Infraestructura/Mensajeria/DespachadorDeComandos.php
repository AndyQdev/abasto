<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mensajeria;

use Catalogo\Aplicacion\LiberarStock;
use Catalogo\Aplicacion\ReservarStock;
use InvalidArgumentException;
use JsonException;

/**
 * Traduce un comando de catalogo.comandos (sobre JSON) a la llamada del caso de uso.
 * No sabe de RabbitMQ: recibe el cuerpo del mensaje, así se prueba sin broker.
 */
final readonly class DespachadorDeComandos
{
    public function __construct(private ReservarStock $reservar, private LiberarStock $liberar) {}

    /**
     * @throws InvalidArgumentException si el mensaje está mal formado (no sirve reintentarlo)
     */
    public function despachar(string $cuerpo): void
    {
        try {
            $sobre = json_decode($cuerpo, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new InvalidArgumentException('El mensaje no es JSON: '.$e->getMessage(), 0, $e);
        }
        if (! is_array($sobre) || ! isset($sobre['tipo']) || ! is_array($sobre['datos'] ?? null)) {
            throw new InvalidArgumentException('El mensaje no trae el sobre del contrato (tipo y datos)');
        }
        $datos = $sobre['datos'];
        $pedidoId = (string) ($datos['pedidoId'] ?? '');
        $mayoristaId = (string) ($datos['mayoristaId'] ?? $sobre['orgId'] ?? '');
        if ($pedidoId === '' || $mayoristaId === '') {
            throw new InvalidArgumentException('Falta pedidoId o mayoristaId');
        }

        match ((string) $sobre['tipo']) {
            'catalogo.reservar_stock' => $this->reservar->ejecutar(
                $pedidoId,
                $mayoristaId,
                (string) ($datos['tiendaId'] ?? ''),
                self::lineas($datos['lineas'] ?? null),
            ),
            'catalogo.liberar_stock' => $this->liberar->ejecutar($pedidoId, $mayoristaId),
            default => throw new InvalidArgumentException("Comando desconocido: {$sobre['tipo']}"),
        };
    }

    /** @return list<array{productoId: string, presentacion: string, cantidad: int}> */
    private static function lineas(mixed $crudas): array
    {
        if (! is_array($crudas)) {
            throw new InvalidArgumentException('El comando no trae líneas');
        }
        $lineas = [];
        foreach ($crudas as $l) {
            if (! is_array($l)) {
                throw new InvalidArgumentException('Línea mal formada');
            }
            $lineas[] = [
                'productoId' => (string) ($l['productoId'] ?? ''),
                'presentacion' => (string) ($l['presentacion'] ?? ''),
                'cantidad' => (int) ($l['cantidad'] ?? 0),
            ];
        }

        return $lineas;
    }
}
