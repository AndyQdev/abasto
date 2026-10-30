"""
PASO 2 DE 2 · deja las ilustraciones listas para la aplicación.

    python -I preparar.py --manifiesto ilustraciones.json --crudas DIR --salida public/ilustraciones [--hoja]

  · escena: se recorta al centro en 4:3 y se guarda en WebP de 800 px de ancho
    (y otra de 400 para teléfonos), con calidad suficiente y menos de 120 KB.
  · maqueta, y toda escena con `proporcion` (D26, D30): se respeta su
    proporción (16:9, 21:9) y se guardan
    en WebP de 1600 px (y otra de 800), menos de 260 KB. La maqueta lleva los
    marcadores encima en %, así que NO se recorta nada.
  · objeto: se le quita el fondo magenta con `recorte-objetos.py` (el de
    Solvexco, probado) y queda en WebP transparente de 512 y 256 px.

--hoja arma una hoja de contactos sobre fondo claro y oscuro para revisarlas a
ojo. Se revisan SIEMPRE antes de usarlas.
"""

import argparse
import json
import os
import subprocess
import sys

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))


def guardar_webp(im, ruta, limite_kb):
    for calidad in (82, 76, 70, 64, 58):
        im.save(ruta, "WEBP", quality=calidad, method=6)
        if os.path.getsize(ruta) / 1024 <= limite_kb:
            return calidad
    return calidad


def sin_margen_blanco(im, umbral=242):
    """El modelo suele pintar la escena como un cuadro con margen de papel
    blanco. Se recorta todo borde casi blanco antes de encuadrar."""
    gris = im.convert("L").point(lambda v: 0 if v >= umbral else 255)
    caja = gris.getbbox()
    if not caja:
        return im
    izq, arriba, der, abajo = caja
    # Si el «margen» es casi toda la imagen, no era un margen: no se toca.
    if (der - izq) < im.width * 0.5 or (abajo - arriba) < im.height * 0.5:
        return im
    return im.crop((izq + 4, arriba + 4, der - 4, abajo - 4))


def escena(cruda, salida, nombre):
    im = sin_margen_blanco(Image.open(cruda).convert("RGB"))
    ancho, alto = im.size
    objetivo = 4 / 3
    if ancho / alto > objetivo:
        nuevo = int(alto * objetivo)
        izq = (ancho - nuevo) // 2
        im = im.crop((izq, 0, izq + nuevo, alto))
    else:
        nuevo = int(ancho / objetivo)
        arriba = (alto - nuevo) // 2
        im = im.crop((0, arriba, ancho, arriba + nuevo))
    for lado, sufijo in ((800, ""), (400, "-chica")):
        chica = im.resize((lado, int(lado * 3 / 4)), Image.LANCZOS)
        destino = os.path.join(salida, f"{nombre}{sufijo}.webp")
        calidad = guardar_webp(chica, destino, 120 if lado == 800 else 50)
        print(f"+  {nombre}{sufijo}.webp  {chica.width}x{chica.height}  "
              f"{os.path.getsize(destino) / 1024:.0f} KB  (calidad {calidad})")


def foto(cruda, salida, nombre):
    im = Image.open(cruda).convert("RGB")
    for lado, sufijo, limite in ((1600, "", 260), (800, "-chica", 90)):
        chica = im.resize((lado, round(lado * im.height / im.width)), Image.LANCZOS)
        destino = os.path.join(salida, f"{nombre}{sufijo}.webp")
        calidad = guardar_webp(chica, destino, limite)
        print(f"+  {nombre}{sufijo}.webp  {chica.width}x{chica.height}  "
              f"{os.path.getsize(destino) / 1024:.0f} KB  (calidad {calidad})")


def isla(cruda, salida, nombre):
    """La maqueta sobre magenta (D30): se le quita el fondo con el mismo
    recorte por tono de los objetos, se recorta al contenido con un margen y
    se guarda ANCHA y transparente, sin encuadrar en un cuadrado. El panel le
    pone la sombra y el movimiento."""
    sys.path.insert(0, AQUI)
    import importlib.util
    spec = importlib.util.spec_from_file_location("recorte", os.path.join(AQUI, "recorte-objetos.py"))
    recorte = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(recorte)
    import numpy as np
    arreglo = recorte.quitar_fondo(Image.open(cruda))
    rgba = Image.fromarray((arreglo * 255 + 0.5).astype(np.uint8), "RGBA")
    caja = rgba.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if caja:
        izq, arriba, der, abajo = caja
        margen = int((der - izq) * 0.02)
        rgba = rgba.crop((max(izq - margen, 0), max(arriba - margen, 0),
                          min(der + margen, rgba.width), min(abajo + margen, rgba.height)))
    for lado, sufijo, limite in ((1600, "", 320), (800, "-chica", 110)):
        chica = rgba.convert("RGBa").resize((lado, round(lado * rgba.height / rgba.width)), Image.LANCZOS).convert("RGBA")
        destino = os.path.join(salida, f"{nombre}{sufijo}.webp")
        for calidad in (86, 80, 74, 68, 62):
            chica.save(destino, "WEBP", quality=calidad, method=6)
            if os.path.getsize(destino) / 1024 <= limite:
                break
        print(f"+  {nombre}{sufijo}.webp  {chica.width}x{chica.height}  {os.path.getsize(destino) / 1024:.0f} KB (transparente)")


def hoja(salida, nombres, ruta):
    celda, columnas = 260, 4
    filas = (len(nombres) + columnas - 1) // columnas
    hoja = Image.new("RGB", (columnas * celda, filas * celda * 3 // 4 + 20), (236, 239, 244))
    for i, nombre in enumerate(nombres):
        im = Image.open(os.path.join(salida, nombre + ".webp")).convert("RGB")
        im.thumbnail((celda - 10, celda - 10))
        hoja.paste(im, ((i % columnas) * celda + 5, (i // columnas) * (celda * 3 // 4) + 5))
    hoja.save(ruta)
    print(f"hoja de contactos: {ruta}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifiesto", required=True)
    p.add_argument("--crudas", required=True)
    p.add_argument("--salida", required=True)
    p.add_argument("--hoja", action="store_true")
    args = p.parse_args()

    with open(args.manifiesto, encoding="utf-8") as f:
        manifiesto = json.load(f)
    os.makedirs(args.salida, exist_ok=True)

    escenas, objetos = [], []
    for img in manifiesto["imagenes"]:
        cruda = os.path.join(args.crudas, img["nombre"] + ".png")
        if not os.path.exists(cruda):
            print(f"-  {img['nombre']}: todavía no está generada")
            continue
        if img.get("tipo") == "maqueta" and img.get("recorte"):
            isla(cruda, args.salida, img["nombre"])
        elif img.get("tipo") == "objeto":
            # «lado» en el manifiesto para los que se ven grandes (la portada); si no, 512
            objetos.append((img["nombre"], int(img.get("lado", 512))))
        elif img.get("tipo") in ("foto", "maqueta") or img.get("proporcion"):
            foto(cruda, args.salida, img["nombre"])
            escenas.append(img["nombre"])
        else:
            escena(cruda, args.salida, img["nombre"])
            escenas.append(img["nombre"])

    if objetos:
        # recorte-objetos.py lee su propio manifiesto de la carpeta de crudas.
        with open(os.path.join(args.crudas, "manifiesto.json"), "w", encoding="utf-8") as f:
            json.dump([{"nombre": n, "lado": lado} for n, lado in objetos], f, ensure_ascii=False)
        subprocess.run(
            [sys.executable, "-I", os.path.join(AQUI, "recorte-objetos.py"),
             "--crudas", args.crudas, "--salida", args.salida, *[n for n, _ in objetos]],
            check=True,
        )

    if args.hoja and escenas:
        hoja(args.salida, escenas, os.path.join(args.crudas, "hoja-de-contactos.png"))


if __name__ == "__main__":
    main()
