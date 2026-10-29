<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Catalogo\Infraestructura\Mensajeria\DespachadorDeComandos;
use Illuminate\Console\Command;
use InvalidArgumentException;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;
use Throwable;

/**
 * Consumidor de la cola catalogo.comandos (reservar y liberar stock de la saga).
 * Un mensaje mal formado va directo a la cola de errores; si falla por otra causa se reintenta
 * y, pasados 5 intentos, RabbitMQ lo manda a catalogo.comandos.dlq.
 */
final class EscucharComandos extends Command
{
    protected $signature = 'catalogo:escuchar';

    protected $description = 'Escucha los comandos de la saga en RabbitMQ (cola catalogo.comandos)';

    public function handle(DespachadorDeComandos $despachador): int
    {
        $conexion = $this->conectar();
        $canal = $conexion->channel();
        $canal->basic_qos(0, 1, false);
        $canal->basic_consume('catalogo.comandos', '', false, false, false, false, function (AMQPMessage $mensaje) use ($despachador): void {
            try {
                $despachador->despachar($mensaje->getBody());
                $mensaje->ack();
            } catch (InvalidArgumentException $e) {
                $this->error('Mensaje descartado: '.$e->getMessage());
                $mensaje->reject(false);
            } catch (Throwable $e) {
                $this->error('Falló, se reintenta: '.$e->getMessage());
                $mensaje->nack(true);
            }
        });
        $this->info('Catálogo escuchando catalogo.comandos');
        $canal->consume();

        return self::SUCCESS;
    }

    /** RabbitMQ puede tardar en estar listo: reintenta hasta 30 veces. */
    private function conectar(): AMQPStreamConnection
    {
        $ultimo = null;
        for ($i = 0; $i < 30; $i++) {
            try {
                return new AMQPStreamConnection(
                    (string) config('rabbitmq.host'),
                    (int) config('rabbitmq.puerto'),
                    (string) config('rabbitmq.usuario'),
                    (string) config('rabbitmq.clave'),
                );
            } catch (Throwable $e) {
                $ultimo = $e;
                sleep(2);
            }
        }

        throw $ultimo;
    }
}
