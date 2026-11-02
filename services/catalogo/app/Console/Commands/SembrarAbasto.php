<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Catalogo\Dominio\Abastecimiento;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\PrecioDeReferencia;
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

    /** El día en que se tomaron los precios al público de Fidalga y Amarket */
    public const FECHA_SUPER = '2026-10-30';

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
                marca: $p['marca'],
                marcaBoliviana: $p['marcaBoliviana'],
                precioEnSuper: $p['super'] === null ? null : new PrecioDeReferencia($p['super'][0], $p['super'][1], self::FECHA_SUPER),
                precioPorConfirmar: $p['super'] === null,
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
     * La marca boliviana está verificada (31/10): PIL, Paceña, Fino, Guabirá, Para Ti, Mabel's, Caisy y Famosa.
     * Don Vittorio (Alicorp), Ola (Unilever) y Vital (Embol) se fabrican aquí pero no son marcas bolivianas;
     * Simba y Mendocina no se pudieron confirmar.
     *
     * Los de `super` null son del nicho de cocina (01/11): su precio es de demostración y sale «por confirmar».
     *
     * @return list<array{codigo: string, nombre: string, rubro: string, escalas: list<EscalaDePrecio>, costo: int, proveedor: string, entregaHoras: int, marca: ?string, marcaBoliviana: bool, super: array{int, string}|null}>
     */
    public static function catalogo(): array
    {
        $e = static fn (Presentacion $p, int $unidades, int $precio) => new EscalaDePrecio($p, $unidades, $precio);
        $filas = [
            // código, nombre, rubro, escalas (la chica a ~92 % del precio al público y la grande a ~85 %), costo por unidad, proveedor,
            // horas de entrega, marca, marca boliviana y [precio al público en centavos, supermercado]
            ['AB-001', 'Arroz Caisy Grano de Oro 1 kg', 'Granos y cereales', [$e(Presentacion::DOCENA, 12, 1540), $e(Presentacion::FARDO, 24, 1400)], 1300, self::LOS_POZOS, 24, 'Caisy', true, [1670, 'Fidalga']],
            ['AB-002', 'Azúcar Guabirá 1 kg', 'Harinas y panificación', [$e(Presentacion::DOCENA, 12, 700), $e(Presentacion::FARDO, 24, 650)], 590, self::LOS_POZOS, 24, 'Guabirá', true, [760, 'Fidalga']],
            ['AB-003', 'Fideo spaghetti Don Vittorio 500 g', 'Granos y cereales', [$e(Presentacion::DOCENA, 12, 860), $e(Presentacion::CAJA, 24, 770)], 730, self::DISTRIBUIDORA, 24, 'Don Vittorio', false, [940, 'Fidalga']],
            ['AB-004', 'Harina Famosa 1 kg', 'Harinas y panificación', [$e(Presentacion::DOCENA, 12, 980), $e(Presentacion::FARDO, 24, 910)], 830, self::LOS_POZOS, 24, 'Famosa', true, [1070, 'Fidalga']],
            ['AB-005', 'Aceite Fino 900 ml', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 1750), $e(Presentacion::CAJA, 12, 1670)], 1480, self::LOS_POZOS, 24, 'Fino', true, [1900, 'Fidalga']],
            ['AB-007', 'Sal fina Lobos 1 kg', 'Condimentos', [$e(Presentacion::DOCENA, 12, 640), $e(Presentacion::FARDO, 24, 580)], 550, self::MUTUALISTA, 24, 'Lobos', false, [700, 'Fidalga']],
            ['AB-014', 'Coca-Cola 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1260), $e(Presentacion::CAJA, 6, 1190)], 1070, self::DISTRIBUIDORA, 24, 'Coca-Cola', false, [1370, 'Fidalga']],
            ['AB-015', 'Agua Vital sin gas 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 710), $e(Presentacion::CAJA, 6, 650)], 600, self::DISTRIBUIDORA, 24, 'Vital', false, [770, 'Fidalga']],
            ['AB-016', 'Simba piña 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1010), $e(Presentacion::CAJA, 6, 950)], 860, self::DISTRIBUIDORA, 24, 'Simba', false, [1100, 'Fidalga']],
            ['AB-037', 'Mendocina papaya 3 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1290), $e(Presentacion::CAJA, 6, 1150)], 1090, self::DISTRIBUIDORA, 24, 'Mendocina', false, [1400, 'Fidalga']],
            ['AB-038', 'Cerveza Paceña lata 269 ml', 'Bebidas', [$e(Presentacion::DOCENA, 12, 720), $e(Presentacion::CAJA, 24, 660)], 610, self::DISTRIBUIDORA, 24, 'Paceña', true, [780, 'Fidalga']],
            ['AB-017', 'Leche PIL fresca 900 ml', 'Huevos y lácteos', [$e(Presentacion::DOCENA, 12, 980), $e(Presentacion::CAJA, 24, 940)], 830, self::DISTRIBUIDORA, 24, 'PIL', true, [1070, 'Fidalga']],
            ['AB-019', 'Leche PIL enriquecida 800 ml', 'Huevos y lácteos', [$e(Presentacion::DOCENA, 12, 880), $e(Presentacion::CAJA, 24, 800)], 750, self::DISTRIBUIDORA, 24, 'PIL', true, [960, 'Amarket']],
            ['AB-018', 'Yogurt bebible PIL durazno 1 L', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 2120), $e(Presentacion::DOCENA, 12, 2000)], 1790, self::DISTRIBUIDORA, 24, 'PIL', true, [2300, 'Fidalga']],
            ['AB-039', 'Biogurt PIL frutilla 1 L', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 1800), $e(Presentacion::DOCENA, 12, 1650)], 1530, self::DISTRIBUIDORA, 24, 'PIL', true, [1960, 'Fidalga']],
            ['AB-040', 'Mantequilla PIL con sal 200 g', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 2390), $e(Presentacion::DOCENA, 12, 2240)], 2030, self::DISTRIBUIDORA, 24, 'PIL', true, [2600, 'Fidalga']],
            ['AB-027', 'Lavandina Mr. Cloro 1 L', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 1100), $e(Presentacion::DOCENA, 12, 980)], 940, self::LOS_POZOS, 24, 'Mr. Cloro', false, [1200, 'Fidalga']],
            ['AB-025', 'Detergente Skip 700 g', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 2390), $e(Presentacion::DOCENA, 12, 2210)], 2030, self::LA_RAMADA, 24, 'Skip', false, [2600, 'Fidalga']],
            ['AB-026', 'Limpia baños Ola Maximus 890 ml', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 2350), $e(Presentacion::DOCENA, 12, 2240)], 1990, self::LA_RAMADA, 24, 'Ola', false, [2550, 'Fidalga']],
            ['AB-029', 'Papel higiénico Elite Plus · 24 rollos', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 7800), $e(Presentacion::CAJA, 4, 7030)], 6610, self::LOS_POZOS, 24, 'Elite', false, [8474, 'Amarket']],
            ['AB-041', 'Papel higiénico Nacional · 12 rollos', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 2820), $e(Presentacion::CAJA, 6, 2660)], 2390, self::LOS_POZOS, 24, 'Nacional', false, [3060, 'Fidalga']],
            ['AB-031', 'Pasta dental Colgate Triple Acción 180 g', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 1660), $e(Presentacion::DOCENA, 12, 1510)], 1400, self::LA_RAMADA, 24, 'Colgate', false, [1800, 'Fidalga']],
            ['AB-030', 'Jabón Protex Avena · 3 de 110 g', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 3190), $e(Presentacion::DOCENA, 12, 2980)], 2710, self::LA_RAMADA, 24, 'Protex', false, [3470, 'Amarket']],
            ['AB-032', 'Shampoo Sedal Zero Caspa 340 ml', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 2830), $e(Presentacion::DOCENA, 12, 2530)], 2400, self::LA_RAMADA, 24, 'Sedal', false, [3080, 'Amarket']],
            ['AB-020', 'Galleta wafer Mabel\'s chocolate 100 g', 'Galletas y dulces', [$e(Presentacion::DOCENA, 12, 600), $e(Presentacion::CAJA, 36, 550)], 510, self::SIETE_CALLES, 24, 'Mabel\'s', true, [650, 'Fidalga']],
            ['AB-021', 'Galletas Mabel\'s Cremositas Max 216 g', 'Galletas y dulces', [$e(Presentacion::DOCENA, 12, 1220), $e(Presentacion::CAJA, 24, 1170)], 1040, self::SIETE_CALLES, 24, 'Mabel\'s', true, [1330, 'Fidalga']],
            ['AB-023', 'Chocolate Para Ti blanco 100 g', 'Galletas y dulces', [$e(Presentacion::UNIDAD, 1, 3560), $e(Presentacion::DOCENA, 12, 3210)], 3020, self::SIETE_CALLES, 24, 'Para Ti', true, [3870, 'Amarket']],

            // Para el que cocina (01/11): salteñerías, panaderías, pensiones y pollerías. Se venden en la presentación
            // del mercado (quintal, arroba, balde, maple), que es la unidad del producto. PRECIOS DE DEMOSTRACIÓN:
            // todavía no se cotizaron; la app los muestra «por confirmar» hasta que Andrés los cotice en el mercado.
            ['AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 28500)], 27000, self::LOS_POZOS, 24, null, false, null],
            ['AB-102', 'Harina de trigo · arroba 11,5 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 7600)], 7100, self::LOS_POZOS, 24, null, false, null],
            ['AB-103', 'Azúcar · quintal 46 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 28000)], 26600, self::LOS_POZOS, 24, null, false, null],
            ['AB-104', 'Levadura seca instantánea 500 g', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 2800), $e(Presentacion::DOCENA, 12, 2600)], 2350, self::LA_RAMADA, 24, null, false, null],
            ['AB-105', 'Polvo de hornear 1 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 1800)], 1500, self::LA_RAMADA, 24, null, false, null],
            ['AB-106', 'Manteca vegetal · balde 15 kg', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 26000)], 24500, self::LOS_POZOS, 24, null, false, null],
            ['AB-107', 'Aceite vegetal · bidón 5 L', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 7800), $e(Presentacion::CAJA, 4, 7500)], 7100, self::LOS_POZOS, 24, null, false, null],
            ['AB-108', 'Arroz · quintal 46 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 33000)], 31500, self::LOS_POZOS, 24, null, false, null],
            ['AB-109', 'Arroz · arroba 11,5 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 8600)], 8100, self::LOS_POZOS, 24, null, false, null],
            ['AB-110', 'Fideo tallarín · bolsa 5 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 4200), $e(Presentacion::CAJA, 4, 4000)], 3750, self::DISTRIBUIDORA, 24, null, false, null],
            ['AB-111', 'Ají colorado molido 1 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 4500)], 4000, self::LA_RAMADA, 24, null, false, null],
            ['AB-112', 'Comino molido 500 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 2600)], 2250, self::LA_RAMADA, 24, null, false, null],
            ['AB-113', 'Pimienta negra molida 500 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 3800)], 3300, self::LA_RAMADA, 24, null, false, null],
            ['AB-114', 'Orégano seco 500 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 2200)], 1900, self::LA_RAMADA, 24, null, false, null],
            ['AB-115', 'Huevo · maple de 30', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 3200), $e(Presentacion::CAJA, 12, 3050)], 2900, self::LOS_POZOS, 24, null, false, null],
            ['AB-116', 'Papa · arroba 11,5 kg', 'Verduras secas', [$e(Presentacion::UNIDAD, 1, 5500)], 5000, self::LOS_POZOS, 24, null, false, null],
            ['AB-117', 'Cebolla · arroba 11,5 kg', 'Verduras secas', [$e(Presentacion::UNIDAD, 1, 4800)], 4300, self::LOS_POZOS, 24, null, false, null],
            ['AB-118', 'Ajo · 1 kg', 'Verduras secas', [$e(Presentacion::UNIDAD, 1, 3000)], 2600, self::LOS_POZOS, 24, null, false, null],
            ['AB-119', 'Bolsas plásticas medianas · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 1200), $e(Presentacion::DOCENA, 12, 1100)], 950, self::SIETE_CALLES, 24, null, false, null],
            ['AB-120', 'Envase de plastoformo con tapa · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 6500), $e(Presentacion::CAJA, 5, 6200)], 5800, self::SIETE_CALLES, 24, null, false, null],
            ['AB-121', 'Servilletas · paquete de 500', 'Descartables', [$e(Presentacion::UNIDAD, 1, 1500)], 1250, self::SIETE_CALLES, 24, null, false, null],
            ['AB-122', 'Vasos descartables 250 ml · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 1100)], 900, self::SIETE_CALLES, 24, null, false, null],
        ];

        return array_values(array_map(static fn (array $f) => [
            'codigo' => $f[0],
            'nombre' => $f[1],
            'rubro' => $f[2],
            'escalas' => $f[3],
            'costo' => $f[4],
            'proveedor' => $f[5],
            'entregaHoras' => $f[6],
            'marca' => $f[7],
            'marcaBoliviana' => $f[8],
            'super' => $f[9],
        ], $filas));
    }
}
