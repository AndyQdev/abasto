<?php

use App\Providers\AppServiceProvider;
use App\Providers\CatalogoServiceProvider;
use Nuwave\Lighthouse\Federation\FederationServiceProvider;

return [
    AppServiceProvider::class,
    CatalogoServiceProvider::class,
    // Catálogo es un subgrafo de Apollo Federation 2
    FederationServiceProvider::class,
];
