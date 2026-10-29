<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Catalogo\Dominio\Abastecimiento;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use MongoDB\Laravel\Connection as MongoConexion;

/**
 * Abasto vendiendo por su cuenta (modelo de lanzamiento, 28/10/2026): mientras no hay mayoristas afiliados,
 * Abasto es el vendedor de la casa. Todo es BAJO_PEDIDO: cuando entra un pedido se compra en el mercado.
 *
 * Los precios, costos y proveedores son de DEMOSTRACIÓN (referenciales): el catálogo real se carga después.
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

    public function handle(ProductoRepositorio $productos): int
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
        foreach ($catalogo as $p) {
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
            ));
        }

        $this->info('Abasto: vendedor de la casa con '.count($catalogo).' productos bajo pedido');

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
        $docenaYCaja = static fn (int $docena, int $unidadesCaja, int $caja) => [
            $e(Presentacion::DOCENA, 12, $docena),
            $e(Presentacion::CAJA, $unidadesCaja, $caja),
        ];
        $docenaYFardo = static fn (int $docena, int $unidadesFardo, int $fardo) => [
            $e(Presentacion::DOCENA, 12, $docena),
            $e(Presentacion::FARDO, $unidadesFardo, $fardo),
        ];
        $unidadYDocena = static fn (int $unidad, int $docena) => [
            $e(Presentacion::UNIDAD, 1, $unidad),
            $e(Presentacion::DOCENA, 12, $docena),
        ];

        $filas = [
            // código, nombre, rubro, escalas, costo por unidad, proveedor, horas de entrega
            ['AB-001', 'Arroz grano largo 1 kg', 'Abarrotes', $docenaYFardo(820, 24, 790), 735, self::LOS_POZOS, 24],
            ['AB-002', 'Azúcar blanca 1 kg', 'Abarrotes', $docenaYFardo(720, 24, 700), 655, self::LOS_POZOS, 24],
            ['AB-003', 'Fideo spaghetti 400 g', 'Abarrotes', $docenaYCaja(520, 40, 490), 450, self::DISTRIBUIDORA, 24],
            ['AB-004', 'Fideo codito 400 g', 'Abarrotes', $docenaYCaja(520, 40, 490), 450, self::DISTRIBUIDORA, 24],
            ['AB-005', 'Aceite vegetal 900 ml', 'Abarrotes', $unidadYDocena(1500, 1420), 1330, self::LOS_POZOS, 24],
            ['AB-006', 'Harina de trigo 1 kg', 'Abarrotes', $docenaYFardo(650, 24, 620), 570, self::LOS_POZOS, 24],
            ['AB-007', 'Sal yodada 1 kg', 'Abarrotes', $docenaYFardo(250, 50, 220), 190, self::MUTUALISTA, 24],
            ['AB-008', 'Avena en hojuelas 400 g', 'Abarrotes', $docenaYCaja(850, 24, 810), 740, self::MUTUALISTA, 24],
            ['AB-009', 'Lentejas 500 g', 'Abarrotes', $docenaYCaja(900, 24, 860), 780, self::MUTUALISTA, 24],
            ['AB-010', 'Atún en lata 170 g', 'Abarrotes', $docenaYCaja(1250, 48, 1180), 1080, self::LA_RAMADA, 24],
            ['AB-011', 'Sardina en lata 425 g', 'Abarrotes', $docenaYCaja(1100, 24, 1050), 960, self::LA_RAMADA, 24],
            ['AB-012', 'Café instantáneo 50 g', 'Abarrotes', $docenaYCaja(1350, 24, 1290), 1190, self::LA_RAMADA, 24],
            ['AB-013', 'Té en bolsitas · 25 u.', 'Abarrotes', $docenaYCaja(650, 36, 610), 560, self::LA_RAMADA, 24],
            ['AB-014', 'Refresco cola 2 L', 'Bebidas', $unidadYDocena(1200, 1130), 1050, self::DISTRIBUIDORA, 24],
            ['AB-015', 'Agua sin gas 2 L', 'Bebidas', $unidadYDocena(600, 560), 500, self::DISTRIBUIDORA, 24],
            ['AB-016', 'Jugo en caja 1 L', 'Bebidas', $docenaYCaja(900, 24, 860), 790, self::SIETE_CALLES, 24],
            ['AB-017', 'Leche UHT entera 1 L', 'Lácteos', $docenaYCaja(820, 24, 800), 745, self::DISTRIBUIDORA, 24],
            ['AB-018', 'Yogur bebible 1 L', 'Lácteos', $unidadYDocena(1350, 1300), 1180, self::DISTRIBUIDORA, 24],
            ['AB-019', 'Leche en polvo 400 g', 'Lácteos', $docenaYCaja(2650, 24, 2550), 2380, self::LA_RAMADA, 48],
            ['AB-020', 'Galletas de agua · paquete', 'Galletas y dulces', $docenaYCaja(300, 48, 280), 245, self::SIETE_CALLES, 24],
            ['AB-021', 'Galletas rellenas · paquete', 'Galletas y dulces', $docenaYCaja(250, 48, 235), 205, self::SIETE_CALLES, 24],
            ['AB-022', 'Papas fritas 45 g', 'Galletas y dulces', $docenaYCaja(450, 36, 420), 380, self::SIETE_CALLES, 24],
            ['AB-023', 'Chocolate en barra 30 g', 'Galletas y dulces', $docenaYCaja(300, 48, 280), 245, self::SIETE_CALLES, 24],
            ['AB-024', 'Caramelos surtidos · bolsa de 100', 'Galletas y dulces', $unidadYDocena(1100, 1050), 950, self::SIETE_CALLES, 24],
            ['AB-025', 'Detergente en polvo 1 kg', 'Limpieza del hogar', $docenaYCaja(1550, 24, 1490), 1380, self::LA_RAMADA, 24],
            ['AB-026', 'Lavavajilla líquido 500 ml', 'Limpieza del hogar', $docenaYCaja(950, 24, 910), 840, self::LA_RAMADA, 24],
            ['AB-027', 'Lavandina 1 L', 'Limpieza del hogar', $docenaYCaja(700, 24, 660), 600, self::LOS_POZOS, 24],
            ['AB-028', 'Jabón de lavar en barra', 'Limpieza del hogar', $docenaYCaja(450, 50, 420), 380, self::LOS_POZOS, 24],
            ['AB-029', 'Papel higiénico · 4 rollos', 'Limpieza del hogar', $docenaYFardo(1050, 48, 1000), 920, self::LOS_POZOS, 24],
            ['AB-030', 'Jabón de tocador 110 g', 'Higiene y cuidado personal', $docenaYCaja(340, 72, 310), 280, self::LOS_POZOS, 24],
            ['AB-031', 'Pasta dental 90 g', 'Higiene y cuidado personal', $docenaYCaja(680, 72, 630), 570, self::LOS_POZOS, 24],
            ['AB-032', 'Shampoo 400 ml', 'Higiene y cuidado personal', $docenaYCaja(2050, 48, 1890), 1750, self::LA_RAMADA, 24],
            ['AB-033', 'Desodorante roll-on 50 ml', 'Higiene y cuidado personal', $docenaYCaja(1450, 36, 1380), 1270, self::LA_RAMADA, 24],
            ['AB-034', 'Toallas higiénicas · paquete de 10', 'Higiene y cuidado personal', $docenaYCaja(850, 48, 800), 730, self::LA_RAMADA, 24],
            ['AB-035', 'Velas · paquete de 6', 'Varios', $docenaYCaja(500, 24, 470), 430, self::MUTUALISTA, 24],
            ['AB-036', 'Pilas AA · par', 'Varios', $docenaYCaja(650, 24, 610), 540, self::MUTUALISTA, 48],
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
