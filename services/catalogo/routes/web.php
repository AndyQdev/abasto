<?php

use Illuminate\Support\Facades\Route;

// Mismo formato que /salud en los demás servicios. El GraphQL está en /graphql (Lighthouse).
Route::get('/salud', fn () => response()->json([
    'servicio' => 'catalogo',
    'estado' => 'ok',
    'hora' => now()->toIso8601ZuluString(),
]));

// Fotos de los productos: públicas, como las de cualquier tienda en línea (las sube CambiarFotoDeProducto)
Route::get('/fotos/{archivo}', function (string $archivo) {
    $ruta = rtrim((string) config('catalogo.fotos_carpeta'), '/').'/'.$archivo;
    abort_unless(is_file($ruta), 404);

    return response()->file($ruta, ['Cache-Control' => 'public, max-age=31536000, immutable']);
})->where('archivo', '[A-Za-z0-9_-]+\.(jpg|png|webp)');
