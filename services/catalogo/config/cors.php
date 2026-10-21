<?php

// El Superadmin consulta /salud desde el navegador. El GraphQL no necesita CORS: lo llama el Apollo Router.
return [
    'paths' => ['salud'],
    'allowed_methods' => ['GET'],
    'allowed_origins' => explode(',', (string) env('ORIGENES_PERMITIDOS', 'http://localhost:5174')),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
