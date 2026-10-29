<?php

use Catalogo\Aplicacion\CambiarFotoDeProducto;
use Catalogo\Aplicacion\CrearProducto;
use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\EscalaDePrecio;
use Catalogo\Dominio\Presentacion;
use Catalogo\Dominio\Puertos\AlmacenDeFotos;
use Tests\Support\ProductosEnMemoria;

beforeEach(function () {
    $this->productos = new ProductosEnMemoria;
    $this->almacen = new class implements AlmacenDeFotos
    {
        /** @var array<string, string> */
        public array $guardadas = [];

        public function guardar(string $productoId, string $bytes, string $extension): string
        {
            $archivo = "{$productoId}.{$extension}";
            $this->guardadas[$archivo] = $bytes;

            return $archivo;
        }
    };
    $this->cambiar = new CambiarFotoDeProducto($this->productos, $this->almacen);
    $this->producto = (new CrearProducto($this->productos))->ejecutar(
        'lp', 'HP-0400', 'Shampoo 400 ml', 'Higiene', '', 24,
        [new EscalaDePrecio(Presentacion::from('DOCENA'), 12, 2000)],
    );
});

// Un JPG mínimo: lo que importa son los primeros bytes
const JPG = "\xFF\xD8\xFF\xE0".'resto de la imagen';

it('guarda la foto del producto y la deja en el producto', function () {
    $producto = $this->cambiar->ejecutar($this->producto->id, 'lp', base64_encode(JPG));

    expect($producto->foto)->toBe("{$this->producto->id}.jpg")
        ->and($this->almacen->guardadas[$producto->foto])->toBe(JPG)
        ->and($this->productos->porId($this->producto->id)?->foto)->toBe($producto->foto);
});

it('acepta la foto como data URL, que es lo que da el navegador', function () {
    $producto = $this->cambiar->ejecutar($this->producto->id, 'lp', 'data:image/png;base64,'.base64_encode("\x89PNG\r\n\x1a\n..."));

    expect($producto->foto)->toEndWith('.png');
});

it('no deja cambiar la foto de un producto ajeno', function () {
    $this->cambiar->ejecutar($this->producto->id, 'lr', base64_encode(JPG));
})->throws(ErrorDeDominio::class, 'El producto no es de tu empresa');

it('rechaza lo que no es una imagen JPG, PNG o WebP', function () {
    $this->cambiar->ejecutar($this->producto->id, 'lp', base64_encode('%PDF-1.7 un documento'));
})->throws(ErrorDeDominio::class, 'La foto tiene que ser JPG, PNG o WebP');

it('rechaza una foto que no entra por el Router', function () {
    $grande = JPG.str_repeat('x', CambiarFotoDeProducto::MAXIMO_BYTES);
    $this->cambiar->ejecutar($this->producto->id, 'lp', base64_encode($grande));
})->throws(ErrorDeDominio::class, 'La foto pesa demasiado');

it('rechaza un base64 roto', function () {
    $this->cambiar->ejecutar($this->producto->id, 'lp', '¡esto no es base64!');
})->throws(ErrorDeDominio::class, 'La foto no se pudo leer');
