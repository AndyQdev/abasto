<?php

return [
    // Dónde se guardan las fotos de los productos y desde qué URL las ven el Panel y la app
    'fotos_carpeta' => env('FOTOS_CARPETA', storage_path('app/public/fotos')),
    'fotos_url' => env('FOTOS_URL', 'http://localhost:8082/fotos'),
    // Mientras no está WhatsApp, el código para entrar a la app vuelve en la respuesta y la app lo muestra
    'codigos_de_prueba' => (bool) env('CODIGOS_DE_PRUEBA', true),
];
