<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Catalogo\Dominio\Abastecimiento;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\AlmacenDeFotos;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use MongoDB\Laravel\Connection as MongoConexion;

/**
 * Abasto vendiendo por su cuenta (modelo de lanzamiento, 28/10/2026): mientras no hay mayoristas afiliados,
 * Abasto es el vendedor de la casa. Todo es BAJO_PEDIDO: cuando entra un pedido se compra en el mercado.
 *
 * Los productos son marcas reales de Bolivia y sus precios salen de los de supermercado (31/10/2026), rebajados
 * como precio de mayorista; los costos y proveedores son de DEMOSTRACIÓN. Las fotos están en
 * `database/fotos-abasto/<código>.webp` y se copian al almacén de fotos al sembrar.
 * Se puede correr las veces que haga falta: `docker compose exec catalogo php artisan catalogo:semilla-abasto`.
 */
final class SembrarAbasto extends Command
{
    protected $signature = 'catalogo:semilla-abasto';

    protected $description = 'Carga a Abasto como vendedor de la casa con un catálogo bajo pedido de demostración';

    private const LOS_POZOS = 'Mercado Los Pozos';

    private const LA_RAMADA = 'Mercado La Ramada';

    private const MUTUALISTA = 'Mercado Mutualista';

    private const SIETE_CALLES = 'Mercado 7 Calles';

    private const DISTRIBUIDORA = 'Distribuidora (pedido por WhatsApp)';

    public function handle(ProductoRepositorio $productos, AlmacenDeFotos $fotos): int
    {
        /** @var MongoConexion $conexion */
        $conexion = DB::connection('mongodb');
        $conexion->getCollection('organizaciones')->replaceOne(['_id' => 'abasto'], [
            '_id' => 'abasto',
            'nombre' => 'Abasto',
            'tipo' => 'mayorista',
            'ciudad' => 'Santa Cruz',
            'verificacion' => EstadoVerificacion::VERIFICADO->value,
            'verificado' => true,
            'de_la_casa' => true,
        ], ['upsert' => true]);

        $catalogo = self::catalogo();
        $conFoto = 0;
        foreach ($catalogo as $p) {
            $archivo = database_path("fotos-abasto/{$p['codigo']}.webp");
            $foto = is_file($archivo) ? $fotos->guardar($p['codigo'], (string) file_get_contents($archivo), 'webp') : null;
            $conFoto += $foto === null ? 0 : 1;
            $productos->guardar(new Producto(
                id: $p['codigo'],
                mayoristaId: 'abasto',
                codigo: $p['codigo'],
                nombre: $p['nombre'],
                rubro: $p['rubro'],
                descripcion: '',
                stock: 0,
                estado: EstadoProducto::ACTIVO,
                escalas: $p['escalas'],
                abastecimiento: Abastecimiento::BAJO_PEDIDO,
                entregaHoras: $p['entregaHoras'],
                costoUnitarioCentavos: $p['costo'],
                proveedor: $p['proveedor'],
                foto: $foto,
            ));
        }

        // Lo que ya no está en el catálogo (los genéricos de antes) se pausa: deja de verse en la app, pero los
        // pedidos viejos que lo tienen siguen encontrando su nombre (borrarlo deja misVentas en null)
        $conexion->getCollection('productos')->updateMany(
            ['mayorista_id' => 'abasto', '_id' => ['$nin' => array_column($catalogo, 'codigo')]],
            ['$set' => ['estado' => EstadoProducto::PAUSADO->value]],
        );

        $this->info('Abasto: vendedor de la casa con '.count($catalogo)." productos bajo pedido ({$conFoto} con foto)");

        return self::SUCCESS;
    }

    /**
     * Precios por unidad en centavos. El costo es lo que se paga en el mercado; la diferencia es el margen.
     *
     * @return list<array{codigo: string, nombre: string, rubro: string, escalas: list<EscalaDePrecio>, costo: int, proveedor: string, entregaHoras: int}>
     */
    public static function catalogo(): array
    {
        $e = static fn (Presentacion $p, int $unidades, int $precio) => new EscalaDePrecio($p, $unidades, $precio);
        $filas = [
            // código, nombre, rubro, escalas (la chica a ~92 % del precio al público y la grande a ~85 %), costo por unidad, proveedor, horas de entrega
            ['AB-001', 'Arroz Caisy Grano de Oro 1 kg', 'Abarrotes', [$e(Presentacion::DOCENA, 12, 1540), $e(Presentacion::FARDO, 24, 1400)], 1300, self::LOS_POZOS, 24], // al público Bs 16,70
            ['AB-002', 'Azúcar Guabirá 1 kg', 'Abarrotes', [$e(Presentacion::DOCENA, 12, 700), $e(Presentacion::FARDO, 24, 650)], 590, self::LOS_POZOS, 24], // al público Bs 7,60
            ['AB-003', 'Fideo spaghetti Don Victorio 500 g', 'Abarrotes', [$e(Presentacion::DOCENA, 12, 860), $e(Presentacion::CAJA, 24, 770)], 730, self::DISTRIBUIDORA, 24], // al público Bs 9,40
            ['AB-004', 'Harina Famosa 1 kg', 'Abarrotes', [$e(Presentacion::DOCENA, 12, 980), $e(Presentacion::FARDO, 24, 910)], 830, self::LOS_POZOS, 24], // al público Bs 10,70
            ['AB-005', 'Aceite Fino 900 ml', 'Abarrotes', [$e(Presentacion::UNIDAD, 1, 1750), $e(Presentacion::CAJA, 12, 1670)], 1480, self::LOS_POZOS, 24], // al público Bs 19,00
            ['AB-007', 'Sal fina Lobos 1 kg', 'Abarrotes', [$e(Presentacion::DOCENA, 12, 640), $e(Presentacion::FARDO, 24, 580)], 550, self::MUTUALISTA, 24], // al público Bs 7,00
            ['AB-014', 'Coca-Cola 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1260), $e(Presentacion::CAJA, 6, 1190)], 1070, self::DISTRIBUIDORA, 24], // al público Bs 13,70
            ['AB-015', 'Agua Vital sin gas 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 710), $e(Presentacion::CAJA, 6, 650)], 600, self::DISTRIBUIDORA, 24], // al público Bs 7,70
            ['AB-016', 'Simba piña 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1010), $e(Presentacion::CAJA, 6, 950)], 860, self::DISTRIBUIDORA, 24], // al público Bs 11,00
            ['AB-037', 'Mendocina papaya 3 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1290), $e(Presentacion::CAJA, 6, 1150)], 1090, self::DISTRIBUIDORA, 24], // al público Bs 14,00
            ['AB-038', 'Cerveza Paceña lata 269 ml', 'Bebidas', [$e(Presentacion::DOCENA, 12, 720), $e(Presentacion::CAJA, 24, 660)], 610, self::DISTRIBUIDORA, 24], // al público Bs 7,80
            ['AB-017', 'Leche PIL fresca 900 ml', 'Lácteos', [$e(Presentacion::DOCENA, 12, 980), $e(Presentacion::CAJA, 24, 940)], 830, self::DISTRIBUIDORA, 24], // al público Bs 10,70
            ['AB-019', 'Leche PIL enriquecida 800 ml', 'Lácteos', [$e(Presentacion::DOCENA, 12, 880), $e(Presentacion::CAJA, 24, 800)], 750, self::DISTRIBUIDORA, 24], // al público Bs 9,60
            ['AB-018', 'Yogurt bebible PIL durazno 1 L', 'Lácteos', [$e(Presentacion::UNIDAD, 1, 2120), $e(Presentacion::DOCENA, 12, 2000)], 1790, self::DISTRIBUIDORA, 24], // al público Bs 23,00
            ['AB-039', 'Biogurt PIL frutilla 1 L', 'Lácteos', [$e(Presentacion::UNIDAD, 1, 1800), $e(Presentacion::DOCENA, 12, 1650)], 1530, self::DISTRIBUIDORA, 24], // al público Bs 19,60
            ['AB-040', 'Mantequilla PIL con sal 200 g', 'Lácteos', [$e(Presentacion::UNIDAD, 1, 2390), $e(Presentacion::DOCENA, 12, 2240)], 2030, self::DISTRIBUIDORA, 24], // al público Bs 26,00
            ['AB-027', 'Lavandina Mr. Cloro 1 L', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 1100), $e(Presentacion::DOCENA, 12, 980)], 940, self::LOS_POZOS, 24], // al público Bs 12,00
            ['AB-025', 'Detergente Skip 700 g', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 2390), $e(Presentacion::DOCENA, 12, 2210)], 2030, self::LA_RAMADA, 24], // al público Bs 26,00
            ['AB-026', 'Limpia baños Ola Maximus 890 ml', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 2350), $e(Presentacion::DOCENA, 12, 2240)], 1990, self::LA_RAMADA, 24], // al público Bs 25,50
            ['AB-029', 'Papel higiénico Elite Plus · 24 rollos', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 7800), $e(Presentacion::CAJA, 4, 7030)], 6610, self::LOS_POZOS, 24], // al público Bs 84,74
            ['AB-041', 'Papel higiénico Nacional · 12 rollos', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 2820), $e(Presentacion::CAJA, 6, 2660)], 2390, self::LOS_POZOS, 24], // al público Bs 30,60
            ['AB-031', 'Pasta dental Colgate Triple Acción 180 g', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 1660), $e(Presentacion::DOCENA, 12, 1510)], 1400, self::LA_RAMADA, 24], // al público Bs 18,00
            ['AB-030', 'Jabón Protex Avena · 3 de 110 g', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 3190), $e(Presentacion::DOCENA, 12, 2980)], 2710, self::LA_RAMADA, 24], // al público Bs 34,70
            ['AB-032', 'Shampoo Sedal Zero Caspa 340 ml', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 2830), $e(Presentacion::DOCENA, 12, 2530)], 2400, self::LA_RAMADA, 24], // al público Bs 30,80
            ['AB-020', 'Galleta wafer Mabel\'s chocolate 100 g', 'Galletas y dulces', [$e(Presentacion::DOCENA, 12, 600), $e(Presentacion::CAJA, 36, 550)], 510, self::SIETE_CALLES, 24], // al público Bs 6,50
            ['AB-021', 'Galletas Mabel\'s Cremositas Max 216 g', 'Galletas y dulces', [$e(Presentacion::DOCENA, 12, 1220), $e(Presentacion::CAJA, 24, 1170)], 1040, self::SIETE_CALLES, 24], // al público Bs 13,30
            ['AB-023', 'Chocolate Para Ti blanco 100 g', 'Galletas y dulces', [$e(Presentacion::UNIDAD, 1, 3560), $e(Presentacion::DOCENA, 12, 3210)], 3020, self::SIETE_CALLES, 24], // al público Bs 38,70
        ];

        return array_values(array_map(static fn (array $f) => [
            'codigo' => $f[0],
            'nombre' => $f[1],
            'rubro' => $f[2],
            'escalas' => $f[3],
            'costo' => $f[4],
            'proveedor' => $f[5],
            'entregaHoras' => $f[6],
        ], $filas));
    }
}
