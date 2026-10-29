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

        $demo = self::productosDemo();
        foreach ($demo as $p) {
            $productos->guardar(new Producto($p['codigo'], $p['mayorista'], $p['codigo'], $p['nombre'], $p['rubro'], '', $p['stock'], $p['estado'], $p['escalas']));
        }

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

        $this->info('Catálogo: '.count($lista).' organizaciones, '.count($demo).' productos y 7 relaciones listos');

        return self::SUCCESS;
    }

    /**
     * Lista de productos de la demo, sin tocar la base: la prueba la revisa sin Mongo.
     *
     * @return list<array{codigo: string, mayorista: string, nombre: string, rubro: string, stock: int, estado: EstadoProducto, escalas: list<EscalaDePrecio>}>
     */
    public static function productosDemo(): array
    {
        $escala = self::escala(...);

        return [
            ['codigo' => 'HP-0400', 'mayorista' => 'lp', 'nombre' => 'Shampoo 400 ml', 'rubro' => 'Higiene y cuidado personal', 'stock' => 312, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(2200, 2000, 1800, 48)],
            ['codigo' => 'HP-0410', 'mayorista' => 'lp', 'nombre' => 'Acondicionador 400 ml', 'rubro' => 'Higiene y cuidado personal', 'stock' => 1056, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(2300, 2100, 1900, 48)],
            ['codigo' => 'HJ-0110', 'mayorista' => 'lp', 'nombre' => 'Jabón de tocador 110 g', 'rubro' => 'Higiene y cuidado personal', 'stock' => 288, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(350, 325, 300, 72)],
            ['codigo' => 'HB-0090', 'mayorista' => 'lp', 'nombre' => 'Pasta dental 90 g', 'rubro' => 'Higiene y cuidado personal', 'stock' => 2880, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(700, 650, 600, 72)],
            ['codigo' => 'HD-0050', 'mayorista' => 'lp', 'nombre' => 'Desodorante roll-on 50 ml', 'rubro' => 'Higiene y cuidado personal', 'stock' => 0, 'estado' => EstadoProducto::SIN_STOCK, 'escalas' => $escala(1500, 1400, 1300, 36)],
            ['codigo' => 'LP-0004', 'mayorista' => 'lp', 'nombre' => 'Papel higiénico 4 rollos', 'rubro' => 'Limpieza del hogar', 'stock' => 1320, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1100, 1050, 1000, 24)],
            ['codigo' => 'HP-0420', 'mayorista' => 'lp', 'nombre' => 'Shampoo infantil 400 ml', 'rubro' => 'Higiene y cuidado personal', 'stock' => 480, 'estado' => EstadoProducto::PENDIENTE_DE_REVISION, 'escalas' => $escala(1800, 1700, 1600, 48)],
            ['codigo' => 'LD-2000', 'mayorista' => 'lp', 'nombre' => 'Detergente líquido 2 L', 'rubro' => 'Limpieza del hogar', 'stock' => 240, 'estado' => EstadoProducto::PAUSADO, 'escalas' => $escala(2600, 2400, 2200, 24)],
            ['codigo' => 'HC-0250', 'mayorista' => 'lp', 'nombre' => 'Crema corporal 250 ml', 'rubro' => 'Cosméticos', 'stock' => 288, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1700, 1600, 1500, 24)],

            ['codigo' => 'AR-0100', 'mayorista' => 'lp', 'nombre' => 'Arroz grano largo 1 kg', 'rubro' => 'Abarrotes', 'stock' => 1200, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(700, 650, 600, 24)],
            ['codigo' => 'AZ-1000', 'mayorista' => 'lp', 'nombre' => 'Azúcar refinada 1 kg', 'rubro' => 'Abarrotes', 'stock' => 960, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(650, 600, 550, 24)],
            ['codigo' => 'AC-0500', 'mayorista' => 'lp', 'nombre' => 'Aceite comestible 500 ml', 'rubro' => 'Abarrotes', 'stock' => 720, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(900, 850, 800, 24)],
            ['codigo' => 'FA-0900', 'mayorista' => 'lp', 'nombre' => 'Fideo tallarín 900 g', 'rubro' => 'Abarrotes', 'stock' => 600, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(800, 750, 700, 24)],
            ['codigo' => 'SA-1000', 'mayorista' => 'lp', 'nombre' => 'Sal yodada 1 kg', 'rubro' => 'Abarrotes', 'stock' => 480, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(350, 320, 300, 24)],
            ['codigo' => 'CA-0250', 'mayorista' => 'lp', 'nombre' => 'Café molido 250 g', 'rubro' => 'Abarrotes', 'stock' => 360, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(2300, 2200, 2100, 24)],
            ['codigo' => 'AT-0100', 'mayorista' => 'lp', 'nombre' => 'Atún en lata 100 g', 'rubro' => 'Abarrotes', 'stock' => 0, 'estado' => EstadoProducto::SIN_STOCK, 'escalas' => $escala(800, 750, 700, 48)],
            ['codigo' => 'LE-1000', 'mayorista' => 'lp', 'nombre' => 'Leche en polvo 1 kg', 'rubro' => 'Abarrotes', 'stock' => 240, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(5400, 5200, 5000, 24)],
            ['codigo' => 'GA-0200', 'mayorista' => 'lp', 'nombre' => 'Galleta surtida 200 g', 'rubro' => 'Abarrotes', 'stock' => 480, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(500, 475, 450, 24)],
            ['codigo' => 'RF-2000', 'mayorista' => 'lp', 'nombre' => 'Refresco cola 2 L', 'rubro' => 'Bebidas', 'stock' => 360, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1100, 1050, 1000, 24)],
            ['codigo' => 'AG-0600', 'mayorista' => 'lp', 'nombre' => 'Agua mineral 600 ml', 'rubro' => 'Bebidas', 'stock' => 720, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(350, 330, 310, 24)],
            ['codigo' => 'JU-1000', 'mayorista' => 'lp', 'nombre' => 'Jugo de naranja 1 L', 'rubro' => 'Bebidas', 'stock' => 180, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1200, 1150, 1100, 24)],
            ['codigo' => 'EN-0473', 'mayorista' => 'lp', 'nombre' => 'Energizante 473 ml', 'rubro' => 'Bebidas', 'stock' => 96, 'estado' => EstadoProducto::PAUSADO, 'escalas' => $escala(1500, 1400, 1300, 24)],
            ['codigo' => 'DE-1000', 'mayorista' => 'lp', 'nombre' => 'Detergente en polvo 1 kg', 'rubro' => 'Limpieza del hogar', 'stock' => 300, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1800, 1700, 1600, 24)],
            ['codigo' => 'LV-0900', 'mayorista' => 'lp', 'nombre' => 'Lavavajillas líquido 900 ml', 'rubro' => 'Limpieza del hogar', 'stock' => 240, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1300, 1250, 1200, 24)],
            ['codigo' => 'LV-0500', 'mayorista' => 'lp', 'nombre' => 'Limpiavidrios 500 ml', 'rubro' => 'Limpieza del hogar', 'stock' => 180, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(900, 850, 800, 24)],
            ['codigo' => 'JR-0300', 'mayorista' => 'lp', 'nombre' => 'Jabón para ropa 300 g', 'rubro' => 'Limpieza del hogar', 'stock' => 360, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(600, 580, 550, 24)],
            ['codigo' => 'CL-1000', 'mayorista' => 'lp', 'nombre' => 'Cloro 1 L', 'rubro' => 'Limpieza del hogar', 'stock' => 0, 'estado' => EstadoProducto::SIN_STOCK, 'escalas' => $escala(700, 650, 600, 24)],
            ['codigo' => 'CN-0075', 'mayorista' => 'lp', 'nombre' => 'Cepillo dental', 'rubro' => 'Higiene y cuidado personal', 'stock' => 288, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(900, 850, 800, 36)],
            ['codigo' => 'HS-0050', 'mayorista' => 'lp', 'nombre' => 'Hilo dental 50 m', 'rubro' => 'Higiene y cuidado personal', 'stock' => 144, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1200, 1100, 1000, 24)],
            ['codigo' => 'JE-0300', 'mayorista' => 'lp', 'nombre' => 'Jabón líquido 300 ml', 'rubro' => 'Higiene y cuidado personal', 'stock' => 180, 'estado' => EstadoProducto::PENDIENTE_DE_REVISION, 'escalas' => $escala(1400, 1300, 1200, 24)],
            ['codigo' => 'PA-0030', 'mayorista' => 'lp', 'nombre' => 'Pañal desechable talla M', 'rubro' => 'Higiene y cuidado personal', 'stock' => 120, 'estado' => EstadoProducto::PENDIENTE_DE_REVISION, 'escalas' => $escala(4500, 4300, 4100, 24)],
            ['codigo' => 'TO-0100', 'mayorista' => 'lp', 'nombre' => 'Toallitas húmedas x100', 'rubro' => 'Higiene y cuidado personal', 'stock' => 240, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1200, 1150, 1100, 24)],
            ['codigo' => 'CR-0100', 'mayorista' => 'lp', 'nombre' => 'Crema facial 100 ml', 'rubro' => 'Cosméticos', 'stock' => 144, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(2500, 2400, 2300, 24)],

            ['codigo' => 'LR-SH400', 'mayorista' => 'lr', 'nombre' => 'Shampoo 400 ml · Hidratante', 'rubro' => 'Higiene y cuidado personal', 'stock' => 4800, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(2100, 1950, 1825, 48)],
            ['codigo' => 'LR-AR100', 'mayorista' => 'lr', 'nombre' => 'Arroz grano largo 1 kg · Premium', 'rubro' => 'Abarrotes', 'stock' => 600, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(720, 670, 620, 24)],
            ['codigo' => 'LR-AZ100', 'mayorista' => 'lr', 'nombre' => 'Azúcar refinada 1 kg · Premium', 'rubro' => 'Abarrotes', 'stock' => 480, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(670, 620, 570, 24)],
            ['codigo' => 'LR-AC500', 'mayorista' => 'lr', 'nombre' => 'Aceite comestible 500 ml · Premium', 'rubro' => 'Abarrotes', 'stock' => 360, 'estado' => EstadoProducto::PAUSADO, 'escalas' => $escala(920, 870, 820, 24)],
            ['codigo' => 'LR-RF200', 'mayorista' => 'lr', 'nombre' => 'Refresco cola 2 L · Retornable', 'rubro' => 'Bebidas', 'stock' => 180, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1050, 1000, 950, 24)],
            ['codigo' => 'LR-DE100', 'mayorista' => 'lr', 'nombre' => 'Detergente en polvo 1 kg · Premium', 'rubro' => 'Limpieza del hogar', 'stock' => 0, 'estado' => EstadoProducto::SIN_STOCK, 'escalas' => $escala(1850, 1750, 1650, 24)],
            ['codigo' => 'LR-HS050', 'mayorista' => 'lr', 'nombre' => 'Hilo dental 50 m · Premium', 'rubro' => 'Higiene y cuidado personal', 'stock' => 60, 'estado' => EstadoProducto::ACTIVO, 'escalas' => $escala(1250, 1150, 1050, 24)],
        ];
    }

    /** @return list<EscalaDePrecio> */
    private static function escala(int $cuarta, int $docena, int $caja, int $unidadesCaja): array
    {
        return [
            new EscalaDePrecio(Presentacion::CUARTA, 3, $cuarta),
            new EscalaDePrecio(Presentacion::DOCENA, 12, $docena),
            new EscalaDePrecio(Presentacion::CAJA, $unidadesCaja, $caja),
        ];
    }
}
