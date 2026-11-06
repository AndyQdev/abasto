<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\EstadoProducto;
use Catalogo\Dominio\EstadoReserva;
use Catalogo\Dominio\LineaReservada;
use Catalogo\Dominio\PoliticaDePrecios;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Catalogo\Dominio\Puertos\ProductoRepositorio;
use Catalogo\Dominio\Puertos\PublicadorDeEventos;
use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Dominio\Puertos\ReservaRepositorio;
use Catalogo\Dominio\ReservaDeStock;

/**
 * Paso 2 de la saga de compra: aparta el stock de cada línea y fija su precio por volumen
 * según la lista de la tienda. Responde con `stock.reservado` o `stock.rechazado`.
 *
 * Es idempotente por pedido: si el comando llega otra vez, no vuelve a descontar y repite la respuesta.
 */
final readonly class ReservarStock
{
    public function __construct(
        private ProductoRepositorio $productos,
        private RelacionRepositorio $relaciones,
        private ReservaRepositorio $reservas,
        private PublicadorDeEventos $eventos,
        /** Para saber si el mayorista es Abasto (vendedor de la casa). Sin él, nadie es de la casa */
        private ?OrganizacionRepositorio $organizaciones = null,
    ) {}

    /** @param list<array{productoId: string, presentacion: string, cantidad: int}> $lineas */
    public function ejecutar(string $pedidoId, string $mayoristaId, string $tiendaId, array $lineas): ReservaDeStock
    {
        $existente = $this->reservas->de($pedidoId);
        if ($existente !== null) {
            $this->responder($existente, $mayoristaId);

            return $existente;
        }

        $reserva = $this->reservar($pedidoId, $mayoristaId, $tiendaId, $lineas);
        $this->reservas->guardar($reserva);
        $this->responder($reserva, $mayoristaId);
        if ($reserva->estado() === EstadoReserva::RESERVADA) {
            (new AvisoDeStock($this->productos, $this->eventos))->avisar('reserva', $reserva, $mayoristaId);
        }

        return $reserva;
    }

    /** @param list<array{productoId: string, presentacion: string, cantidad: int}> $lineas */
    private function reservar(string $pedidoId, string $mayoristaId, string $tiendaId, array $lineas): ReservaDeStock
    {
        if ($lineas === []) {
            return ReservaDeStock::rechazada($pedidoId, 'El pedido no trae productos');
        }
        if ($this->organizaciones?->porId($tiendaId)?->suspendida === true) {
            return ReservaDeStock::rechazada($pedidoId, 'Tu cuenta está suspendida. Escríbenos para revisarla.');
        }

        $relacion = $this->relaciones->de($tiendaId, $mayoristaId);
        $deLaCasa = $this->organizaciones?->porId($mayoristaId)->deLaCasa ?? false;
        $plan = [];
        foreach ($lineas as $linea) {
            $producto = $this->productos->porId($linea['productoId']);
            $presentacion = Presentacion::tryFrom($linea['presentacion']);
            if ($producto === null || $producto->mayoristaId !== $mayoristaId || $presentacion === null || $linea['cantidad'] < 1) {
                return ReservaDeStock::rechazada($pedidoId, "Producto {$linea['productoId']} no disponible");
            }
            if ($producto->estado !== EstadoProducto::ACTIVO) {
                return ReservaDeStock::rechazada($pedidoId, "{$producto->nombre} no está a la venta");
            }
            $escalas = PoliticaDePrecios::escalasPara($producto, $tiendaId, $relacion, $deLaCasa);
            if ($escalas === null) {
                return ReservaDeStock::rechazada($pedidoId, 'La tienda no es cliente aprobado de este mayorista');
            }
            $escala = null;
            foreach ($escalas as $candidata) {
                if ($candidata->presentacion === $presentacion) {
                    $escala = $candidata;
                }
            }
            if ($escala === null) {
                return ReservaDeStock::rechazada($pedidoId, "{$producto->nombre} no se vende por {$presentacion->value}");
            }
            $plan[] = [$producto->id, $producto->nombre, $linea['cantidad'] * $escala->unidades, $escala->precioUnitarioCentavos, $producto->bajoPedido()];
        }

        $apartadas = [];
        foreach ($plan as [$productoId, $nombre, $unidades, $precio, $bajoPedido]) {
            if ($bajoPedido) {
                // Se compra cuando entra el pedido: no hay stock que apartar
                $apartadas[] = new LineaReservada($productoId, $unidades, $precio, false);

                continue;
            }
            if (! $this->productos->descontarStock($productoId, $unidades)) {
                foreach ($apartadas as $previa) {
                    if ($previa->descontado) {
                        $this->productos->devolverStock($previa->productoId, $previa->unidades);
                    }
                }

                return ReservaDeStock::rechazada($pedidoId, "Stock insuficiente de {$nombre}");
            }
            $apartadas[] = new LineaReservada($productoId, $unidades, $precio);
        }

        return ReservaDeStock::reservada($pedidoId, $apartadas);
    }

    private function responder(ReservaDeStock $reserva, string $mayoristaId): void
    {
        match ($reserva->estado()) {
            EstadoReserva::RESERVADA => $this->eventos->publicar('stock.reservado', $reserva->pedidoId, $mayoristaId, [
                'pedidoId' => $reserva->pedidoId,
                'lineas' => array_map(static fn (LineaReservada $l) => [
                    'unidades' => $l->unidades,
                    'precioUnitarioCentavos' => $l->precioUnitarioCentavos,
                ], $reserva->lineas()),
            ]),
            EstadoReserva::RECHAZADA => $this->eventos->publicar('stock.rechazado', $reserva->pedidoId, $mayoristaId, [
                'pedidoId' => $reserva->pedidoId,
                'motivo' => $reserva->motivo ?? 'Sin stock',
            ]),
            // La reserva ya se liberó: la compensación que llegó tarde no cambia nada
            EstadoReserva::LIBERADA => null,
        };
    }
}
