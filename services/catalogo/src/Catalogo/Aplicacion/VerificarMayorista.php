<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Organizacion;
use Catalogo\Dominio\Puertos\OrganizacionRepositorio;

/** Abasto revisa a un mayorista que se registró (CU-01): lo verifica y sus productos salen en la app, o lo rechaza con un motivo. */
final readonly class VerificarMayorista
{
    public function __construct(private OrganizacionRepositorio $organizaciones)
    {
    }

    /** @return list<Organizacion> */
    public function porEstado(EstadoVerificacion $estado): array
    {
        return $this->organizaciones->mayoristasPorVerificacion($estado);
    }

    public function aprobar(string $id): Organizacion
    {
        $verificado = $this->mayorista($id)->verificar();
        $this->organizaciones->guardar($verificado);

        return $verificado;
    }

    public function rechazar(string $id, string $motivo): Organizacion
    {
        $motivo = trim($motivo);
        if (mb_strlen($motivo) < 5) {
            throw new ErrorDeDominio('MOTIVO_REQUERIDO', 'Escribe por qué lo rechazas: el mayorista lo va a ver');
        }
        $rechazado = $this->mayorista($id)->rechazar($motivo);
        $this->organizaciones->guardar($rechazado);

        return $rechazado;
    }

    private function mayorista(string $id): Organizacion
    {
        $organizacion = $this->organizaciones->porId($id);
        if ($organizacion === null || !$organizacion->esMayorista()) {
            throw new ErrorDeDominio('MAYORISTA_NO_EXISTE', 'Ese mayorista no existe');
        }

        return $organizacion;
    }
}
