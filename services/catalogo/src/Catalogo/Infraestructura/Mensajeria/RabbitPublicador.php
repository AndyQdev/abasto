<?php

declare(strict_types=1);

namespace Catalogo\Infraestructura\Mensajeria;

use Catalogo\Dominio\Puertos\PublicadorDeEventos;
use Closure;
use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Message\AMQPMessage;

/** Adaptador de salida: publica en el exchange abasto.eventos con el tipo como routing key. */
final class RabbitPublicador implements PublicadorDeEventos
{
    private ?AMQPChannel $canal = null;

    /** @param Closure(): AMQPChannel $abrirCanal se llama la primera vez que hay algo que publicar */
    public function __construct(private readonly Closure $abrirCanal) {}

    public function publicar(string $tipo, string $pedidoId, string $orgId, array $datos): void
    {
        $sobre = SobreDeEvento::armar($tipo, $pedidoId, $orgId, $datos);
        $mensaje = new AMQPMessage(json_encode($sobre, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), [
            'content_type' => 'application/json',
            'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT,
            'message_id' => $sobre['id'],
            'correlation_id' => $pedidoId,
        ]);
        $this->canal ??= ($this->abrirCanal)();
        $this->canal->basic_publish($mensaje, 'abasto.eventos', $tipo);
    }
}
