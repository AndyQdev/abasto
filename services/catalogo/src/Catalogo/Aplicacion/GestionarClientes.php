<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\ListaDePrecios;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;
use Catalogo\Dominio\Puertos\RelacionRepositorio;
use Catalogo\Dominio\RelacionComercial;

/** Casos de uso de la red privada: la tienda pide ser cliente, el mayorista aprueba con una lista. */
final readonly class GestionarClientes
{
    public function __construct(
        private RelacionRepositorio $relaciones,
        private OrganizacionRepositorio $organizaciones,
    ) {
    }

    public function pedirSerCliente(string $tiendaId, string $mayoristaId): RelacionComercial
    {
        $mayorista = $this->organizaciones->porId($mayoristaId);
        if ($mayorista === null || !$mayorista->esMayorista()) {
            throw new ErrorDeDominio('MAYORISTA_NO_EXISTE', 'Ese mayorista no está en Abasto');
        }
        $relacion = $this->relaciones->de($tiendaId, $mayoristaId);
        if ($relacion === null) {
            $relacion = RelacionComercial::solicitar($tiendaId, $mayoristaId);
        } else {
            $relacion->volverASolicitar();
        }
        $this->relaciones->guardar($relacion);

        return $relacion;
    }

    public function aprobar(string $mayoristaId, string $tiendaId, ListaDePrecios $lista): RelacionComercial
    {
        $relacion = $this->relaciones->de($tiendaId, $mayoristaId)
            ?? throw new ErrorDeDominio('SOLICITUD_NO_EXISTE', 'Esa tienda no pidió ser tu cliente');
        $relacion->aprobar($lista);
        $this->relaciones->guardar($relacion);

        return $relacion;
    }

    public function rechazar(string $mayoristaId, string $tiendaId): RelacionComercial
    {
        $relacion = $this->relaciones->de($tiendaId, $mayoristaId)
            ?? throw new ErrorDeDominio('SOLICITUD_NO_EXISTE', 'Esa tienda no pidió ser tu cliente');
        $relacion->rechazar();
        $this->relaciones->guardar($relacion);

        return $relacion;
    }
}
