<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\ListaDePrecios;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Dominio\RelacionComercial;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use MongoDB\Laravel\Connection as MongoConexion;

/**
 * Datos de demostración: los mismos mayoristas, tiendas y productos que las maquetas y Keycloak.
 * Se puede correr las veces que haga falta: `docker compose run --rm catalogo php artisan catalogo:semilla`.
 */
final class SembrarCatalogo extends Command
{
    protected $signature = 'catalogo:semilla';

    protected $description = 'Carga mayoristas, tiendas, productos y relaciones de demostración';

    public function handle(ProductoRepositorio $productos, RelacionRepositorio $relaciones): int
    {
        /** @var MongoConexion $conexion */
        $conexion = DB::connection('mongodb');
        $organizaciones = $conexion->getCollection('organizaciones');
        $lista = [
            ['_id' => 'lp', 'nombre' => 'Distribuidora Los Pozos', 'tipo' => 'mayorista', 'ciudad' => 'Santa Cruz', 'verificado' => true, 'nit' => '1023456027'],
            ['_id' => 'lr', 'nombre' => 'Importadora La Ramada', 'tipo' => 'mayorista', 'ciudad' => 'Santa Cruz', 'verificado' => true, 'nit' => '2034567018'],
            ['_id' => 'mc', 'nombre' => 'Mayorista Central', 'tipo' => 'mayorista', 'ciudad' => 'Santa Cruz', 'verificado' => false],
            ['_id' => 'dr', 'nombre' => 'Tienda Doña Rosa', 'tipo' => 'tienda', 'ciudad' => 'Santa Cruz', 'verificado' => true],
            ['_id' => 'ec', 'nombre' => 'Minimarket El Cruce', 'tipo' => 'tienda', 'ciudad' => 'Santa Cruz', 'verificado' => true],
            ['_id' => 'am', 'nombre' => 'Almacén Mery', 'tipo' => 'tienda', 'ciudad' => 'Santa Cruz', 'verificado' => true],
            ['_id' => 'dl', 'nombre' => 'Despensa Lupita', 'tipo' => 'tienda', 'ciudad' => 'Santa Cruz', 'verificado' => true],
            ['_id' => 'es', 'nombre' => 'Tienda La Esquina', 'tipo' => 'tienda', 'ciudad' => 'Santa Cruz', 'verificado' => true],
            ['_id' => 'sj', 'nombre' => 'Tienda San Juan', 'tipo' => 'tienda', 'ciudad' => 'Santa Cruz', 'verificado' => true],
        ];
        foreach ($lista as $o) {
            $organizaciones->replaceOne(['_id' => $o['_id']], $o, ['upsert' => true]);
        }

        $escala = static fn (int $cuarta, int $docena, int $caja, int $unidadesCaja) => [
            new EscalaDePrecio(Presentacion::CUARTA, 3, $cuarta),
            new EscalaDePrecio(Presentacion::DOCENA, 12, $docena),
            new EscalaDePrecio(Presentacion::CAJA, $unidadesCaja, $caja),
        ];
        $demo = [
            ['HP-0400', 'Shampoo 400 ml', 'Higiene y cuidado personal', 312, EstadoProducto::ACTIVO, $escala(2200, 2000, 1800, 48)],
            ['HP-0410', 'Acondicionador 400 ml', 'Higiene y cuidado personal', 1056, EstadoProducto::ACTIVO, $escala(2300, 2100, 1900, 48)],
            ['HJ-0110', 'Jabón de tocador 110 g', 'Higiene y cuidado personal', 288, EstadoProducto::ACTIVO, $escala(350, 325, 300, 72)],
            ['HB-0090', 'Pasta dental 90 g', 'Higiene y cuidado personal', 2880, EstadoProducto::ACTIVO, $escala(700, 650, 600, 72)],
            ['HD-0050', 'Desodorante roll-on 50 ml', 'Higiene y cuidado personal', 0, EstadoProducto::SIN_STOCK, $escala(1500, 1400, 1300, 36)],
            ['LP-0004', 'Papel higiénico 4 rollos', 'Limpieza del hogar', 1320, EstadoProducto::ACTIVO, $escala(1100, 1050, 1000, 24)],
            ['HP-0420', 'Shampoo infantil 400 ml', 'Higiene y cuidado personal', 480, EstadoProducto::PENDIENTE_DE_REVISION, $escala(1800, 1700, 1600, 48)],
            ['LD-2000', 'Detergente líquido 2 L', 'Limpieza del hogar', 240, EstadoProducto::PAUSADO, $escala(2600, 2400, 2200, 6 * 4)],
            ['HC-0250', 'Crema corporal 250 ml', 'Cosméticos', 288, EstadoProducto::ACTIVO, $escala(1700, 1600, 1500, 24)],
        ];
        foreach ($demo as [$codigo, $nombre, $rubro, $stock, $estado, $escalas]) {
            $productos->guardar(new Producto($codigo, 'lp', $codigo, $nombre, $rubro, '', $stock, $estado, $escalas));
        }
        $productos->guardar(new Producto('LR-SH400', 'lr', 'LR-SH400', 'Shampoo 400 ml · Hidratante', 'Higiene y cuidado personal', '', 4800, EstadoProducto::ACTIVO, $escala(2100, 1950, 1825, 48)));

        // Red privada: Doña Rosa es cliente frecuente de Los Pozos; Los Pozos compra a La Ramada como VIP
        $aprobada = static function (string $tienda, string $mayorista, ListaDePrecios $lista): RelacionComercial {
            $r = RelacionComercial::solicitar($tienda, $mayorista);
            $r->aprobar($lista);

            return $r;
        };
        $relaciones->guardar($aprobada('dr', 'lp', ListaDePrecios::FRECUENTES));
        $relaciones->guardar($aprobada('lp', 'lr', ListaDePrecios::VIP));
        foreach (['ec', 'am', 'dl'] as $tienda) {
            $relaciones->guardar($aprobada($tienda, 'lp', ListaDePrecios::NUEVOS));
        }
        $relaciones->guardar(RelacionComercial::solicitar('sj', 'lp'));
        $relaciones->guardar(RelacionComercial::solicitar('es', 'lr'));

        $this->info('Catálogo: '.count($lista).' organizaciones, '.(count($demo) + 1).' productos y 7 relaciones listos');

        return self::SUCCESS;
    }
}
