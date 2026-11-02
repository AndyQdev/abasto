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
 * Los `usos` (a quién se muestra cada producto) los decide Abasto en el Panel: volver a sembrar no los pisa, salvo
 * con `--usos` o si el producto todavía no tiene.
 */
final class SembrarAbasto extends Command
{
    protected $signature = 'catalogo:semilla-abasto {--usos : Vuelve a poner los usos de la semilla aunque Abasto los haya cambiado en el Panel}';

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
            $antes = $productos->porId($p['codigo']);
            $usos = $this->option('usos') || $antes === null || $antes->usos() === [] ? $p['usos'] : $antes->usos();
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
                usos: $usos,
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
     * @return list<array{codigo: string, nombre: string, rubro: string, escalas: list<EscalaDePrecio>, costo: int, proveedor: string, entregaHoras: int, marca: ?string, marcaBoliviana: bool, super: array{int, string}|null, usos: list<string>}>
     */
    public static function catalogo(): array
    {
        $e = static fn (Presentacion $p, int $unidades, int $precio) => new EscalaDePrecio($p, $unidades, $precio);
        $filas = [
            // código, nombre, rubro, escalas (la chica a ~92 % del precio al público y la grande a ~85 %), costo por unidad, proveedor,
            // horas de entrega, marca, marca boliviana y [precio al público en centavos, supermercado]
            ['AB-001', 'Arroz Caisy Grano de Oro 1 kg', 'Granos y cereales', [$e(Presentacion::DOCENA, 12, 1540), $e(Presentacion::FARDO, 24, 1400)], 1300, self::LOS_POZOS, 24, 'Caisy', true, [1670, 'Fidalga'], 'T M'],
            ['AB-002', 'Azúcar Guabirá 1 kg', 'Harinas y panificación', [$e(Presentacion::DOCENA, 12, 700), $e(Presentacion::FARDO, 24, 650)], 590, self::LOS_POZOS, 24, 'Guabirá', true, [760, 'Fidalga'], 'T M'],
            ['AB-003', 'Fideo spaghetti Don Vittorio 500 g', 'Granos y cereales', [$e(Presentacion::DOCENA, 12, 860), $e(Presentacion::CAJA, 24, 770)], 730, self::DISTRIBUIDORA, 24, 'Don Vittorio', false, [940, 'Fidalga'], 'T M'],
            ['AB-004', 'Harina Famosa 1 kg', 'Harinas y panificación', [$e(Presentacion::DOCENA, 12, 980), $e(Presentacion::FARDO, 24, 910)], 830, self::LOS_POZOS, 24, 'Famosa', true, [1070, 'Fidalga'], 'T M'],
            ['AB-005', 'Aceite Fino 900 ml', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 1750), $e(Presentacion::CAJA, 12, 1670)], 1480, self::LOS_POZOS, 24, 'Fino', true, [1900, 'Fidalga'], 'T M'],
            ['AB-007', 'Sal fina Lobos 1 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 680), $e(Presentacion::DOCENA, 12, 640), $e(Presentacion::FARDO, 24, 580)], 550, self::MUTUALISTA, 24, 'Lobos', false, [700, 'Fidalga'], 'T M'],
            ['AB-014', 'Coca-Cola 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1260), $e(Presentacion::CAJA, 6, 1190)], 1070, self::DISTRIBUIDORA, 24, 'Coca-Cola', false, [1370, 'Fidalga'], 'T M'],
            ['AB-015', 'Agua Vital sin gas 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 710), $e(Presentacion::CAJA, 6, 650)], 600, self::DISTRIBUIDORA, 24, 'Vital', false, [770, 'Fidalga'], 'T M'],
            ['AB-016', 'Simba piña 2 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1010), $e(Presentacion::CAJA, 6, 950)], 860, self::DISTRIBUIDORA, 24, 'Simba', false, [1100, 'Fidalga'], 'T M'],
            ['AB-037', 'Mendocina papaya 3 L', 'Bebidas', [$e(Presentacion::UNIDAD, 1, 1290), $e(Presentacion::CAJA, 6, 1150)], 1090, self::DISTRIBUIDORA, 24, 'Mendocina', false, [1400, 'Fidalga'], 'T M'],
            ['AB-038', 'Cerveza Paceña lata 269 ml', 'Bebidas', [$e(Presentacion::DOCENA, 12, 720), $e(Presentacion::CAJA, 24, 660)], 610, self::DISTRIBUIDORA, 24, 'Paceña', true, [780, 'Fidalga'], 'T M'],
            ['AB-017', 'Leche PIL fresca 900 ml', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 1040), $e(Presentacion::DOCENA, 12, 980), $e(Presentacion::CAJA, 24, 940)], 830, self::DISTRIBUIDORA, 24, 'PIL', true, [1070, 'Fidalga'], 'P H R T M'],
            ['AB-019', 'Leche PIL enriquecida 800 ml', 'Huevos y lácteos', [$e(Presentacion::DOCENA, 12, 880), $e(Presentacion::CAJA, 24, 800)], 750, self::DISTRIBUIDORA, 24, 'PIL', true, [960, 'Amarket'], 'T M'],
            ['AB-018', 'Yogurt bebible PIL durazno 1 L', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 2120), $e(Presentacion::DOCENA, 12, 2000)], 1790, self::DISTRIBUIDORA, 24, 'PIL', true, [2300, 'Fidalga'], 'T M'],
            ['AB-039', 'Biogurt PIL frutilla 1 L', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 1800), $e(Presentacion::DOCENA, 12, 1650)], 1530, self::DISTRIBUIDORA, 24, 'PIL', true, [1960, 'Fidalga'], 'T M'],
            ['AB-040', 'Mantequilla PIL con sal 200 g', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 2390), $e(Presentacion::DOCENA, 12, 2240)], 2030, self::DISTRIBUIDORA, 24, 'PIL', true, [2600, 'Fidalga'], 'H T M'],
            ['AB-027', 'Lavandina Mr. Cloro 1 L', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 1100), $e(Presentacion::DOCENA, 12, 980)], 940, self::LOS_POZOS, 24, 'Mr. Cloro', false, [1200, 'Fidalga'], 'T M'],
            ['AB-025', 'Detergente Skip 700 g', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 2390), $e(Presentacion::DOCENA, 12, 2210)], 2030, self::LA_RAMADA, 24, 'Skip', false, [2600, 'Fidalga'], 'T M'],
            ['AB-026', 'Limpia baños Ola Maximus 890 ml', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 2350), $e(Presentacion::DOCENA, 12, 2240)], 1990, self::LA_RAMADA, 24, 'Ola', false, [2550, 'Fidalga'], 'T M'],
            ['AB-029', 'Papel higiénico Elite Plus · 24 rollos', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 7800), $e(Presentacion::CAJA, 4, 7030)], 6610, self::LOS_POZOS, 24, 'Elite', false, [8474, 'Amarket'], 'T M'],
            ['AB-041', 'Papel higiénico Nacional · 12 rollos', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 2820), $e(Presentacion::CAJA, 6, 2660)], 2390, self::LOS_POZOS, 24, 'Nacional', false, [3060, 'Fidalga'], 'T M'],
            ['AB-031', 'Pasta dental Colgate Triple Acción 180 g', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 1660), $e(Presentacion::DOCENA, 12, 1510)], 1400, self::LA_RAMADA, 24, 'Colgate', false, [1800, 'Fidalga'], 'T M'],
            ['AB-030', 'Jabón Protex Avena · 3 de 110 g', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 3190), $e(Presentacion::DOCENA, 12, 2980)], 2710, self::LA_RAMADA, 24, 'Protex', false, [3470, 'Amarket'], 'T M'],
            ['AB-032', 'Shampoo Sedal Zero Caspa 340 ml', 'Higiene y cuidado personal', [$e(Presentacion::UNIDAD, 1, 2830), $e(Presentacion::DOCENA, 12, 2530)], 2400, self::LA_RAMADA, 24, 'Sedal', false, [3080, 'Amarket'], 'T M'],
            ['AB-020', 'Galleta wafer Mabel\'s chocolate 100 g', 'Galletas y dulces', [$e(Presentacion::DOCENA, 12, 600), $e(Presentacion::CAJA, 36, 550)], 510, self::SIETE_CALLES, 24, 'Mabel\'s', true, [650, 'Fidalga'], 'T M'],
            ['AB-021', 'Galletas Mabel\'s Cremositas Max 216 g', 'Galletas y dulces', [$e(Presentacion::DOCENA, 12, 1220), $e(Presentacion::CAJA, 24, 1170)], 1040, self::SIETE_CALLES, 24, 'Mabel\'s', true, [1330, 'Fidalga'], 'T M'],
            ['AB-023', 'Chocolate Para Ti blanco 100 g', 'Galletas y dulces', [$e(Presentacion::UNIDAD, 1, 3560), $e(Presentacion::DOCENA, 12, 3210)], 3020, self::SIETE_CALLES, 24, 'Para Ti', true, [3870, 'Amarket'], 'T M'],

            // Para el que cocina (01/11): salteñerías, panaderías, pensiones y pollerías. Se venden en la presentación
            // del mercado (quintal, arroba, balde, maple), que es la unidad del producto. PRECIOS DE DEMOSTRACIÓN:
            // todavía no se cotizaron; la app los muestra «por confirmar» hasta que Andrés los cotice en el mercado.
            ['AB-101', 'Harina de trigo · quintal 46 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 28500)], 27000, self::LOS_POZOS, 24, null, false, null, 'S P'],
            ['AB-102', 'Harina de trigo · arroba 11,5 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 7600)], 7100, self::LOS_POZOS, 24, null, false, null, 'S P R T'],
            ['AB-103', 'Azúcar · quintal 46 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 28000)], 26600, self::LOS_POZOS, 24, null, false, null, 'S P H'],
            ['AB-104', 'Levadura seca instantánea 500 g', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 2800), $e(Presentacion::DOCENA, 12, 2600)], 2350, self::LA_RAMADA, 24, null, false, null, 'P'],
            ['AB-105', 'Polvo de hornear 1 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 1800)], 1500, self::LA_RAMADA, 24, null, false, null, 'S P H'],
            ['AB-106', 'Manteca vegetal · balde 15 kg', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 26000)], 24500, self::LOS_POZOS, 24, null, false, null, 'S P H'],
            ['AB-107', 'Aceite vegetal · bidón 5 L', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 7800), $e(Presentacion::CAJA, 4, 7500)], 7100, self::LOS_POZOS, 24, null, false, null, 'S C R A'],
            ['AB-108', 'Arroz · quintal 46 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 33000)], 31500, self::LOS_POZOS, 24, null, false, null, 'C R A T'],
            ['AB-109', 'Arroz · arroba 11,5 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 8600)], 8100, self::LOS_POZOS, 24, null, false, null, 'C R A T M'],
            ['AB-110', 'Fideo tallarín · bolsa 5 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 4200), $e(Presentacion::CAJA, 4, 4000)], 3750, self::DISTRIBUIDORA, 24, null, false, null, 'C T'],
            ['AB-111', 'Ají colorado molido 1 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 4500)], 4000, self::LA_RAMADA, 24, null, false, null, 'S C A'],
            ['AB-112', 'Comino molido 500 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 2600)], 2250, self::LA_RAMADA, 24, null, false, null, 'S C R A'],
            ['AB-113', 'Pimienta negra molida 500 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 3800)], 3300, self::LA_RAMADA, 24, null, false, null, 'S C R A'],
            ['AB-114', 'Orégano seco 500 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 2200)], 1900, self::LA_RAMADA, 24, null, false, null, 'S C'],
            ['AB-115', 'Huevo · maple de 30', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 3200), $e(Presentacion::CAJA, 12, 3050)], 2900, self::LOS_POZOS, 24, null, false, null, 'S P H C R A T M'],
            ['AB-116', 'Papa · arroba 11,5 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 5500)], 5000, self::LOS_POZOS, 24, null, false, null, 'S C R A M'],
            ['AB-117', 'Cebolla · arroba 11,5 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 4800)], 4300, self::LOS_POZOS, 24, null, false, null, 'S C R A M'],
            ['AB-118', 'Ajo · 1 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 3000)], 2600, self::LOS_POZOS, 24, null, false, null, 'S C A'],
            ['AB-119', 'Bolsas plásticas medianas · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 1200), $e(Presentacion::DOCENA, 12, 1100)], 950, self::SIETE_CALLES, 24, null, false, null, 'S P H C R A T'],
            ['AB-120', 'Envase de plastoformo con tapa · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 6500), $e(Presentacion::CAJA, 5, 6200)], 5800, self::SIETE_CALLES, 24, null, false, null, 'C R A'],
            ['AB-121', 'Servilletas · paquete de 500', 'Descartables', [$e(Presentacion::UNIDAD, 1, 1500)], 1250, self::SIETE_CALLES, 24, null, false, null, 'S C R A'],
            ['AB-122', 'Vasos descartables 250 ml · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 1100)], 900, self::SIETE_CALLES, 24, null, false, null, 'C R A'],

            // Catálogo real por área (02/11, docs/plan-catalogo-real-y-plantillas.md): lo que piden las recetas de las 6
            // áreas, la tienda y el hogar. Productos reales de Santa Cruz; la marca solo si está confirmada. PRECIOS DE
            // DEMOSTRACIÓN: salen «por confirmar» hasta cotizarlos. Carne, pollo y queso van como todo: bajo pedido.
            ['AB-123', 'Azúcar · arroba 11,5 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 7400)], 6660, self::LOS_POZOS, 24, null, false, null, 'S P H C T'],
            ['AB-124', 'Almidón de yuca · arroba 11,5 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 13800)], 12420, self::LOS_POZOS, 24, null, false, null, 'H'],
            ['AB-125', 'Almidón de yuca 1 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 1500), $e(Presentacion::DOCENA, 12, 1410)], 1350, self::LOS_POZOS, 24, null, false, null, 'H T M'],
            ['AB-126', 'Fécula de maíz (maicena) 1 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 2200)], 1980, self::LA_RAMADA, 24, null, false, null, 'P R'],
            ['AB-127', 'Pan molido 1 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 1600)], 1440, self::LA_RAMADA, 24, null, false, null, 'C R A'],
            ['AB-128', 'Esencia de vainilla 500 ml', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 1800)], 1620, self::LA_RAMADA, 24, null, false, null, 'P'],
            ['AB-129', 'Gelatina sin sabor 500 g', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 6500)], 5850, self::LA_RAMADA, 24, null, false, null, 'S'],
            ['AB-130', 'Manteca Karina 1 kg', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 2400), $e(Presentacion::DOCENA, 12, 2260)], 2160, self::LOS_POZOS, 24, 'Karina', true, null, 'S H T M'],
            ['AB-131', 'Margarina Regia 1 kg', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 2600)], 2340, self::LOS_POZOS, 24, 'Regia', true, null, 'P H'],
            ['AB-132', 'Aceite vegetal · bidón 20 L', 'Aceites y grasas', [$e(Presentacion::UNIDAD, 1, 30000)], 27000, self::LOS_POZOS, 24, null, false, null, 'C R A'],
            ['AB-133', 'Maní crudo pelado 1 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 2600)], 2340, self::MUTUALISTA, 24, null, false, null, 'C'],
            ['AB-134', 'Arveja seca 1 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 1400)], 1260, self::MUTUALISTA, 24, null, false, null, 'S C'],
            ['AB-135', 'Sal fina · bolsa 25 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 7500)], 6750, self::LOS_POZOS, 24, null, false, null, 'S P H C R A'],
            ['AB-136', 'Urucú (achiote) molido 500 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 2500)], 2250, self::LA_RAMADA, 24, null, false, null, 'S C'],
            ['AB-137', 'Ajo en polvo 500 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 3000)], 2700, self::LA_RAMADA, 24, null, false, null, 'R'],
            ['AB-138', 'Vinagre · bidón 5 L', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 3500)], 3150, self::LA_RAMADA, 24, null, false, null, 'C R A'],
            ['AB-139', 'Aceitunas verdes · balde 5 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 15000)], 13500, self::LA_RAMADA, 24, null, false, null, 'S'],
            ['AB-140', 'Pasas de uva 1 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 3200)], 2880, self::LA_RAMADA, 24, null, false, null, 'S'],
            ['AB-141', 'Mayonesa · balde 3 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 6500)], 5850, self::DISTRIBUIDORA, 24, null, false, null, 'R'],
            ['AB-142', 'Salsa de tomate (kétchup) · bidón 3 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 4500)], 4050, self::DISTRIBUIDORA, 24, null, false, null, 'R'],
            ['AB-143', 'Mostaza · bidón 3 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 4200)], 3780, self::DISTRIBUIDORA, 24, null, false, null, 'R'],
            ['AB-144', 'Queso criollo · 1 kg', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 4500)], 4050, self::LOS_POZOS, 24, null, false, null, 'S H C A'],
            ['AB-145', 'Tomate · arroba 11,5 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 6000)], 5400, self::MUTUALISTA, 24, null, false, null, 'C R A'],
            ['AB-146', 'Zanahoria · arroba 11,5 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 4500)], 4050, self::MUTUALISTA, 24, null, false, null, 'C'],
            ['AB-147', 'Pimentón · 5 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 3500)], 3150, self::MUTUALISTA, 24, null, false, null, 'C'],
            ['AB-148', 'Locoto · 1 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 1500)], 1350, self::MUTUALISTA, 24, null, false, null, 'C'],
            ['AB-149', 'Yuca · arroba 11,5 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 4000)], 3600, self::MUTUALISTA, 24, null, false, null, 'H C A M'],
            ['AB-150', 'Plátano verde · bolsa de 20', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 2500)], 2250, self::MUTUALISTA, 24, null, false, null, 'H C'],
            ['AB-151', 'Plátano maduro · bolsa de 20', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 2500)], 2250, self::MUTUALISTA, 24, null, false, null, 'C'],
            ['AB-152', 'Lechuga · bolsa de 12', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 3000)], 2700, self::MUTUALISTA, 24, null, false, null, 'R'],
            ['AB-153', 'Charque de res · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 9000)], 8100, self::LOS_POZOS, 24, null, false, null, 'H C'],
            ['AB-154', 'Carne de res para guiso · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 5500)], 4950, self::LOS_POZOS, 24, null, false, null, 'S C A'],
            ['AB-155', 'Carne molida de res · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 5500)], 4950, self::LOS_POZOS, 24, null, false, null, 'R A'],
            ['AB-156', 'Lomo de res · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 8000)], 7200, self::LOS_POZOS, 24, null, false, null, 'C'],
            ['AB-157', 'Corazón de res · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 3500)], 3150, self::LOS_POZOS, 24, null, false, null, 'A'],
            ['AB-158', 'Pollo entero', 'Carnes', [$e(Presentacion::UNIDAD, 1, 4000)], 3600, self::LOS_POZOS, 24, null, false, null, 'S C R'],
            ['AB-159', 'Patas de pollo · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 1500)], 1350, self::LOS_POZOS, 24, null, false, null, 'C'],
            ['AB-160', 'Gallina criolla', 'Carnes', [$e(Presentacion::UNIDAD, 1, 8000)], 7200, self::LOS_POZOS, 24, null, false, null, 'C'],
            ['AB-161', 'Chorizo · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 5000)], 4500, self::LOS_POZOS, 24, null, false, null, 'C'],
            ['AB-162', 'Salchicha Viena · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 4000)], 3600, self::DISTRIBUIDORA, 24, null, false, null, 'C R'],
            ['AB-163', 'Pan de hamburguesa · bolsa de 50', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 5000)], 4500, self::DISTRIBUIDORA, 24, null, false, null, 'R'],
            ['AB-164', 'Palitos de anticucho · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 800)], 720, self::SIETE_CALLES, 24, null, false, null, 'A'],
            ['AB-165', 'Bolsas de papel para pan · paquete de 500', 'Descartables', [$e(Presentacion::UNIDAD, 1, 4500)], 4050, self::SIETE_CALLES, 24, null, false, null, 'P H'],
            ['AB-166', 'Harina de maíz 1 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 1200), $e(Presentacion::DOCENA, 12, 1130)], 1080, self::LOS_POZOS, 24, null, false, null, 'H T M'],
            ['AB-167', 'Canela molida 250 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 2000)], 1800, self::LA_RAMADA, 24, null, false, null, 'P H'],
            ['AB-168', 'Cacao en polvo 500 g', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 3000)], 2700, self::LA_RAMADA, 24, null, false, null, 'P'],
            ['AB-169', 'Coco rallado 500 g', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 2500)], 2250, self::LA_RAMADA, 24, null, false, null, 'P'],
            ['AB-170', 'Azúcar impalpable 1 kg', 'Harinas y panificación', [$e(Presentacion::UNIDAD, 1, 1800)], 1620, self::LA_RAMADA, 24, null, false, null, 'P'],
            ['AB-171', 'Leche condensada 395 g', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 1300), $e(Presentacion::DOCENA, 12, 1220)], 1170, self::DISTRIBUIDORA, 24, null, false, null, 'P T M'],
            ['AB-172', 'Leche en polvo 400 g', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 2800), $e(Presentacion::DOCENA, 12, 2630)], 2520, self::DISTRIBUIDORA, 24, null, false, null, 'P T M'],
            ['AB-173', 'Crema de leche 1 L', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 3000)], 2700, self::DISTRIBUIDORA, 24, null, false, null, 'P'],
            ['AB-174', 'Dulce de leche · balde 5 kg', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 9000)], 8100, self::DISTRIBUIDORA, 24, null, false, null, 'P'],
            ['AB-175', 'Mantequilla sin sal · 1 kg', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 6500)], 5850, self::DISTRIBUIDORA, 24, null, false, null, 'P H'],
            ['AB-176', 'Queso menonita · 1 kg', 'Huevos y lácteos', [$e(Presentacion::UNIDAD, 1, 5000), $e(Presentacion::DOCENA, 12, 4700)], 4500, self::LOS_POZOS, 24, null, false, null, 'H R T M'],
            ['AB-177', 'Frejol rojo 1 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 1600), $e(Presentacion::DOCENA, 12, 1500)], 1440, self::MUTUALISTA, 24, null, false, null, 'C T M'],
            ['AB-178', 'Lenteja 1 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 1500), $e(Presentacion::DOCENA, 12, 1410)], 1350, self::MUTUALISTA, 24, null, false, null, 'C T M'],
            ['AB-179', 'Mote de maíz pelado 1 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 1000), $e(Presentacion::DOCENA, 12, 940)], 900, self::MUTUALISTA, 24, null, false, null, 'C T M'],
            ['AB-180', 'Quinua real 1 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 2800), $e(Presentacion::DOCENA, 12, 2630)], 2520, self::MUTUALISTA, 24, null, false, null, 'T M'],
            ['AB-181', 'Avena en hojuelas 1 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 1500), $e(Presentacion::DOCENA, 12, 1410)], 1350, self::LOS_POZOS, 24, null, false, null, 'T M'],
            ['AB-182', 'Fideo macarrón · bolsa 5 kg', 'Granos y cereales', [$e(Presentacion::UNIDAD, 1, 4200)], 3780, self::DISTRIBUIDORA, 24, null, false, null, 'C'],
            ['AB-183', 'Laurel seco 100 g', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 800)], 720, self::LA_RAMADA, 24, null, false, null, 'C'],
            ['AB-184', 'Salsa de soya · botella 1 L', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 1800)], 1620, self::LA_RAMADA, 24, null, false, null, 'C R'],
            ['AB-185', 'Caldo de gallina en cubitos · caja de 100', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 3000), $e(Presentacion::DOCENA, 12, 2820)], 2700, self::LA_RAMADA, 24, null, false, null, 'C T M'],
            ['AB-186', 'Sal gruesa parrillera 1 kg', 'Condimentos', [$e(Presentacion::UNIDAD, 1, 500)], 450, self::LOS_POZOS, 24, null, false, null, 'A R M'],
            ['AB-187', 'Mermelada de frutilla 500 g', 'Conservas y desayuno', [$e(Presentacion::UNIDAD, 1, 1800), $e(Presentacion::DOCENA, 12, 1690)], 1620, self::DISTRIBUIDORA, 24, null, false, null, 'P T M'],
            ['AB-188', 'Café molido 500 g', 'Conservas y desayuno', [$e(Presentacion::UNIDAD, 1, 4000), $e(Presentacion::DOCENA, 12, 3760)], 3600, self::DISTRIBUIDORA, 24, null, false, null, 'C T M'],
            ['AB-189', 'Té en bolsitas · caja de 100', 'Conservas y desayuno', [$e(Presentacion::UNIDAD, 1, 1500), $e(Presentacion::DOCENA, 12, 1410)], 1350, self::DISTRIBUIDORA, 24, null, false, null, 'C T M'],
            ['AB-190', 'Atún en lata 170 g', 'Conservas y desayuno', [$e(Presentacion::UNIDAD, 1, 1300), $e(Presentacion::DOCENA, 12, 1220)], 1170, self::DISTRIBUIDORA, 24, null, false, null, 'T M'],
            ['AB-191', 'Sardina en lata 425 g', 'Conservas y desayuno', [$e(Presentacion::UNIDAD, 1, 1500), $e(Presentacion::DOCENA, 12, 1410)], 1350, self::DISTRIBUIDORA, 24, null, false, null, 'T M'],
            ['AB-192', 'Limón · bolsa 5 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 2500)], 2250, self::MUTUALISTA, 24, null, false, null, 'C R A T M'],
            ['AB-193', 'Choclo · bolsa de 12', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 2400)], 2160, self::MUTUALISTA, 24, null, false, null, 'H C'],
            ['AB-194', 'Repollo', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 800)], 720, self::MUTUALISTA, 24, null, false, null, 'C R'],
            ['AB-195', 'Pechuga de pollo · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 3800)], 3420, self::LOS_POZOS, 24, null, false, null, 'C R'],
            ['AB-196', 'Alitas de pollo · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 3000)], 2700, self::LOS_POZOS, 24, null, false, null, 'R'],
            ['AB-197', 'Costilla de res · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 4500)], 4050, self::LOS_POZOS, 24, null, false, null, 'C A'],
            ['AB-198', 'Costilla de cerdo · 1 kg', 'Carnes', [$e(Presentacion::UNIDAD, 1, 4800)], 4320, self::LOS_POZOS, 24, null, false, null, 'C A'],
            ['AB-199', 'Papas prefritas congeladas · bolsa 2,5 kg', 'Verduras y tubérculos', [$e(Presentacion::UNIDAD, 1, 4500)], 4050, self::DISTRIBUIDORA, 24, null, false, null, 'R'],
            ['AB-200', 'Carbón vegetal · bolsa 5 kg', 'Varios', [$e(Presentacion::UNIDAD, 1, 2500)], 2250, self::LOS_POZOS, 24, null, false, null, 'A R M'],
            ['AB-201', 'Guantes descartables · caja de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 3500)], 3150, self::SIETE_CALLES, 24, null, false, null, 'S P H C R A'],
            ['AB-202', 'Papel para hornear · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 3000)], 2700, self::SIETE_CALLES, 24, null, false, null, 'P H'],
            ['AB-203', 'Cajas para torta · paquete de 25', 'Descartables', [$e(Presentacion::UNIDAD, 1, 4000)], 3600, self::SIETE_CALLES, 24, null, false, null, 'P'],
            ['AB-204', 'Cajas para pollo · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 9000)], 8100, self::SIETE_CALLES, 24, null, false, null, 'R'],
            ['AB-205', 'Cucharas descartables · paquete de 100', 'Descartables', [$e(Presentacion::UNIDAD, 1, 1000)], 900, self::SIETE_CALLES, 24, null, false, null, 'C R A'],
            ['AB-206', 'Papel aluminio · rollo de 30 m', 'Descartables', [$e(Presentacion::UNIDAD, 1, 2500)], 2250, self::SIETE_CALLES, 24, null, false, null, 'C R A M'],
            ['AB-207', 'Jabón en barra para ropa · paquete de 6', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 1800), $e(Presentacion::DOCENA, 12, 1690)], 1620, self::LA_RAMADA, 24, null, false, null, 'T M'],
            ['AB-208', 'Lavavajilla líquido 1 L', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 1600), $e(Presentacion::DOCENA, 12, 1500)], 1440, self::LA_RAMADA, 24, null, false, null, 'C R T M'],
            ['AB-209', 'Esponja de cocina · paquete de 6', 'Limpieza del hogar', [$e(Presentacion::UNIDAD, 1, 1200), $e(Presentacion::DOCENA, 12, 1130)], 1080, self::LA_RAMADA, 24, null, false, null, 'C R T M'],
            ['AB-210', 'Fósforos · paquete de 10', 'Varios', [$e(Presentacion::UNIDAD, 1, 500), $e(Presentacion::DOCENA, 12, 470)], 450, self::SIETE_CALLES, 24, null, false, null, 'T M'],
            ['AB-211', 'Velas · paquete de 6', 'Varios', [$e(Presentacion::UNIDAD, 1, 800), $e(Presentacion::DOCENA, 12, 750)], 720, self::SIETE_CALLES, 24, null, false, null, 'T M'],
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
            'usos' => self::usos($f[10]),
        ], $filas));
    }

    /** Letras de la tabla del plan → claves de Producto::USOS */
    private const LETRAS = [
        'S' => 'salteneria', 'P' => 'panaderia', 'H' => 'horneados', 'C' => 'pension',
        'R' => 'polleria', 'A' => 'puesto', 'T' => 'tienda', 'M' => 'hogar',
    ];

    /** @return list<string> «S P T» → [salteneria, panaderia, tienda] */
    private static function usos(string $letras): array
    {
        $elegidos = array_map(static fn (string $l) => self::LETRAS[$l], preg_split('/\s+/', trim($letras)) ?: []);

        return array_values(array_filter(Producto::USOS, static fn (string $u) => in_array($u, $elegidos, true)));
    }
}
