<?php

return [
    'host' => env('RABBITMQ_HOST', 'localhost'),
    'puerto' => (int) env('RABBITMQ_PUERTO', 5680),
    'usuario' => env('RABBITMQ_USUARIO', 'abasto'),
    'clave' => env('RABBITMQ_CLAVE', 'abasto'),
];
