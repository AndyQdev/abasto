<?php

declare(strict_types=1);

namespace Catalogo\Aplicacion;

use Catalogo\Dominio\ErrorDeDominio;
use Catalogo\Dominio\Producto;
use Catalogo\Dominio\Puertos\AlmacenDeFotos;
use Catalogo\Dominio\Puertos\ProductoRepositorio;

/**
 * El mayorista le pone (o le cambia) la foto a un producto suyo desde el Panel.
 * La foto llega en base64 por GraphQL: el Router acepta hasta 2 MB por pedido, así que la imagen
 * no puede pasar de 1,4 MB (el Panel la achica antes de mandarla).
 */
final readonly class CambiarFotoDeProducto
{
    public const MAXIMO_BYTES = 1_400_000;

    /** Los primeros bytes de cada formato aceptado */
    private const FORMATOS = ["\xFF\xD8\xFF" => 'jpg', "\x89PNG" => 'png', 'RIFF' => 'webp'];

    public function __construct(private ProductoRepositorio $productos, private AlmacenDeFotos $fotos)
    {
    }

    /** @param string $imagenBase64 base64 puro o data URL («data:image/jpeg;base64,...») */
    public function ejecutar(string $productoId, string $mayoristaId, string $imagenBase64): Producto
    {
        $producto = $this->productos->porId($productoId)
            ?? throw new ErrorDeDominio('PRODUCTO_INEXISTENTE', 'El producto no existe o fue dado de baja');
        if ($producto->mayoristaId !== $mayoristaId) {
            throw new ErrorDeDominio('PRODUCTO_AJENO', 'El producto no es de tu empresa');
        }

        $base64 = preg_replace('/^data:[^,]*,/', '', trim($imagenBase64)) ?? '';
        $bytes = base64_decode($base64, true);
        if ($bytes === false || $bytes === '') {
            throw new ErrorDeDominio('FOTO_INVALIDA', 'La foto no se pudo leer');
        }
        if (strlen($bytes) > self::MAXIMO_BYTES) {
            throw new ErrorDeDominio('FOTO_MUY_GRANDE', 'La foto pesa demasiado: el máximo es 1,4 MB');
        }

        $producto->cambiarFoto($this->fotos->guardar($producto->id, $bytes, self::extensionDe($bytes)));
        $this->productos->guardar($producto);

        return $producto;
    }

    private static function extensionDe(string $bytes): string
    {
        foreach (self::FORMATOS as $firma => $extension) {
            if (str_starts_with($bytes, $firma) && ($extension !== 'webp' || substr($bytes, 8, 4) === 'WEBP')) {
                return $extension;
            }
        }

        throw new ErrorDeDominio('FOTO_FORMATO', 'La foto tiene que ser JPG, PNG o WebP');
    }
}
