<?php

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EstadoVerificacion;
use Catalogo\Dominio\Organizacion;

/** Un mayorista con la verificación pedida, igual al de la demo. */
function organizacionVerificacion(EstadoVerificacion $verificacion): Organizacion
{
    return new Organizacion('lp', 'Distribuidora Los Pozos', 'mayorista', 'Santa Cruz', $verificacion, '1023456027');
}

it('está verificada solo cuando su estado es VERIFICADO', function () {
    expect(organizacionVerificacion(EstadoVerificacion::VERIFICADO)->estaVerificada())->toBeTrue()
        ->and(organizacionVerificacion(EstadoVerificacion::PENDIENTE)->estaVerificada())->toBeFalse()
        ->and(organizacionVerificacion(EstadoVerificacion::RECHAZADO)->estaVerificada())->toBeFalse();
});

it('una pendiente pasa a verificada', function () {
    $verificada = organizacionVerificacion(EstadoVerificacion::PENDIENTE)->verificar();

    expect($verificada->verificacion)->toBe(EstadoVerificacion::VERIFICADO)
        ->and($verificada->estaVerificada())->toBeTrue()
        ->and($verificada->nit)->toBe('1023456027');
});

it('verificar una ya verificada no cambia su estado', function () {
    $verificada = organizacionVerificacion(EstadoVerificacion::VERIFICADO)->verificar();

    expect($verificada->verificacion)->toBe(EstadoVerificacion::VERIFICADO);
});

it('una pendiente pasa a rechazada', function () {
    $rechazada = organizacionVerificacion(EstadoVerificacion::PENDIENTE)->rechazar();

    expect($rechazada->verificacion)->toBe(EstadoVerificacion::RECHAZADO)
        ->and($rechazada->estaVerificada())->toBeFalse();
});

it('una rechazada no puede pasar a verificada sin volver a pendiente', function () {
    organizacionVerificacion(EstadoVerificacion::RECHAZADO)->verificar();
})->throws(ErrorDeDominio::class, 'Una organización rechazada no puede pasar a verificada sin volver a pendiente');

it('el rechazo de una rechazada la deja igual', function () {
    $rechazada = organizacionVerificacion(EstadoVerificacion::RECHAZADO)->rechazar();

    expect($rechazada->verificacion)->toBe(EstadoVerificacion::RECHAZADO);
});

it('verificar y rechazar devuelven organizaciones nuevas y no cambian la original', function () {
    $original = organizacionVerificacion(EstadoVerificacion::PENDIENTE);
    $verificada = $original->verificar();
    $otraRechazada = $original->rechazar();

    expect($original->verificacion)->toBe(EstadoVerificacion::PENDIENTE)
        ->and($original->estaVerificada())->toBeFalse()
        ->and($verificada)->not->toBe($original)
        ->and($verificada->verificacion)->toBe(EstadoVerificacion::VERIFICADO)
        ->and($otraRechazada)->not->toBe($original)
        ->and($otraRechazada->verificacion)->toBe(EstadoVerificacion::RECHAZADO);
});
