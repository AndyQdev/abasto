<?php

declare(strict_types=1);

namespace App\Providers;

use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Catalogo\Dominio\Puertos\PublicadorDeEventos;
use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Dominio\Puertos\ReservaRepositorio;
use Catalogo\Infraestructura\Mensajeria\RabbitPublicador;
use Catalogo\Infraestructura\Mongo\MongoOrganizacionRepositorio;
use Catalogo\Infraestructura\Mongo\MongoProductoRepositorio;
use Catalogo\Infraestructura\Mongo\MongoRelacionRepositorio;
use Catalogo\Infraestructura\Mongo\MongoReservaRepositorio;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use MongoDB\Collection;
use MongoDB\Laravel\Connection as MongoConexion;
use PhpAmqpLib\Connection\AMQPStreamConnection;

/**
 * Aquí se enchufan los adaptadores a los puertos. Es el único lugar de Laravel que conoce
 * las dos partes; el dominio y los casos de uso no saben que existe Laravel.
 */
final class CatalogoServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $coleccion = static function (string $nombre): Collection {
            /** @var MongoConexion $conexion */
            $conexion = DB::connection('mongodb');

            return $conexion->getCollection($nombre);
        };

        $this->app->singleton(OrganizacionRepositorio::class, fn () => new MongoOrganizacionRepositorio($coleccion('organizaciones')));
        $this->app->singleton(RelacionRepositorio::class, fn () => new MongoRelacionRepositorio($coleccion('relaciones')));
        $this->app->singleton(ProductoRepositorio::class, fn () => new MongoProductoRepositorio(
            $coleccion('productos'),
            $coleccion('organizaciones'),
        ));
        $this->app->singleton(ReservaRepositorio::class, fn () => new MongoReservaRepositorio($coleccion('reservas')));
        $this->app->singleton(PublicadorDeEventos::class, fn () => new RabbitPublicador(
            static fn () => (new AMQPStreamConnection(
                (string) config('rabbitmq.host'),
                (int) config('rabbitmq.puerto'),
                (string) config('rabbitmq.usuario'),
                (string) config('rabbitmq.clave'),
            ))->channel(),
        ));
    }
}
