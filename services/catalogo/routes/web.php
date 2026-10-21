<?php

use Illuminate\Support\Facades\Route;

// Mismo formato que /salud en los demás servicios. El GraphQL está en /graphql (Lighthouse).
Route::get('/salud', fn () => response()->json([
    'servicio' => 'catalogo',
    'estado' => 'ok',
    'hora' => now()->toIso8601ZuluString(),
]));
