"""
PASO 3 (opcional) · borra el «piso» gris que a veces queda debajo de un objeto recortado.

    python -I quitar-piso.py <carpeta> <nombre> [<nombre> ...]

Gemini a veces pinta una sombra o un piso gris plano bajo el objeto, y el recorte por magenta
lo deja. Se separan las manchas del recorte (componentes conectados) y se borran las que son
grises (poca saturación), planas (más anchas que altas) o muy chicas comparadas con el objeto.
Lo que es parte del objeto (un saco blanco, una vela) queda: es grande y no es plano.
"""

import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def limpiar(ruta):
    im = Image.open(ruta).convert("RGBA")
    a = np.array(im).astype(np.float32)
    alfa = a[..., 3] > 20
    etiquetas, cuantas = ndimage.label(alfa)
    if cuantas <= 1:
        return 0
    tamanos = ndimage.sum(alfa, etiquetas, range(1, cuantas + 1))
    mayor = tamanos.max()
    rgb = a[..., :3]
    maximo, minimo = rgb.max(axis=2), rgb.min(axis=2)
    saturacion = np.where(maximo > 0, (maximo - minimo) / np.maximum(maximo, 1), 0)
    # Un piso gris y plano se borra aunque sea la mancha más grande; el objeto es lo que queda
    planos = set()
    for i in range(1, cuantas + 1):
        zona = etiquetas == i
        ys, xs = np.nonzero(zona)
        alto, ancho = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if saturacion[zona].mean() < 0.12 and maximo[zona].mean() < 235 and ancho > alto * 2.5:
            planos.add(i)
    restantes = [t for i, t in enumerate(tamanos, start=1) if i not in planos]
    mayor = max(restantes) if restantes else mayor
    borradas = 0
    for i, tam in enumerate(tamanos, start=1):
        zona = etiquetas == i
        gris = saturacion[zona].mean() < 0.12 and maximo[zona].mean() < 235
        chica = tam < mayor * 0.01
        if i in planos or chica or (gris and tam < mayor * 0.2):
            a[zona, 3] = 0
            borradas += 1
    if borradas:
        Image.fromarray(a.astype(np.uint8), "RGBA").save(ruta, "WEBP", quality=88, method=6)
        recentrar(ruta, im.size[0])
    return borradas


def recentrar(ruta, lado):
    """Después de borrar, el objeto puede quedar corrido: se recorta a su contenido y se centra otra vez."""
    im = Image.open(ruta).convert("RGBA")
    caja = im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    if not caja:
        return
    obj = im.crop(caja)
    margen = int(max(obj.size) * 0.04)
    cuadro = max(obj.size) + 2 * margen
    lienzo = Image.new("RGBA", (cuadro, cuadro), (0, 0, 0, 0))
    lienzo.paste(obj, ((cuadro - obj.width) // 2, (cuadro - obj.height) // 2), obj)
    lienzo.resize((lado, lado), Image.LANCZOS).save(ruta, "WEBP", quality=88, method=6)


def main():
    carpeta, nombres = sys.argv[1], sys.argv[2:]
    for n in nombres:
        ruta = os.path.join(carpeta, n + ".webp")
        print(f"{n}: {limpiar(ruta)} manchas borradas")


if __name__ == "__main__":
    main()
