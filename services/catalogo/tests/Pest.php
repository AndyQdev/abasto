<?php

use Tests\TestCase;

/*
 * Unit: dominio y casos de uso, sin Laravel ni base de datos.
 * Feature: el subgrafo completo contra MongoDB real (necesita `pnpm infra`).
 */
pest()->extend(TestCase::class)->in('Feature');
