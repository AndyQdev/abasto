# -*- coding: utf-8 -*-
"""
RECORTA LAS ILUSTRACIONES: quita el fondo magenta y guarda WebP transparentes.
Paso 2 de 2; el 1 es scripts-ilustraciones.mjs, que deja los PNG crudos.

  python -I scripts-ilustraciones-recorte.py --crudas DIR [nombres...]
    --salida DIR   dónde van los .webp (por omisión public/ilustraciones/)
    --prueba       arma además DIR/pruebas/<nombre>.png sobre fondo claro y oscuro
    --hoja         arma DIR/hoja-de-contactos.png con todo lo que haya en --salida

El modelo nunca pinta #FF00FF puro: da un magenta rosado con degradé y alguna
sombra del mismo tono. Por eso no se recorta por color exacto sino por TONO:

 1. Cada píxel cae en FONDO seguro (tono magenta y tan saturado como el fondo
    de su zona, sombras incluidas), OBJETO seguro (otro tono, o casi sin
    color) o en la franja dudosa del borde. Un reflejo del fondo sobre acero
    o el rebote rosado en un blanco tienen el tono del fondo pero menos
    saturación: quedan del lado del objeto.
 2. En la franja, la opacidad sale de proyectar el color sobre la recta que va
    del fondo vecino al objeto vecino, y con eso se desmezcla el color.
 3. Se le quita el tinte magenta a lo que quedó (rebote sobre blancos,
    plástico traslúcido y metal) y el violeta de los azules vuelve a azul.
    Ningún producto de la planta es magenta ni violeta.
 4. Se recorta al contenido, se centra en un cuadrado y se achica con alfa
    premultiplicado para que el borde no se oscurezca.

Los casos difíciles se ajustan por ilustración con `recorte` en el .mjs
(llega por el manifiesto): `conservarOscuros` y `silueta`.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
CLARO = (0xED, 0xEF, 0xF2)
OSCURO = (0x1A, 0x1F, 0x1C)
MARGEN = 0.04  # aire alrededor del objeto, en fracción del lado
PESO_MAX_KB = 60


def tono_saturacion(rgb):
    """Tono en grados (0-360), saturación y valor (0-1) de una imagen float 0-1."""
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    c = mx - mn
    cz = np.maximum(c, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / cz) % 6, 0.0)
    h = np.where(mx == g, (b - r) / cz + 2, h)
    h = np.where(mx == b, (r - g) / cz + 4, h)
    s = np.where(mx > 1e-6, c / np.maximum(mx, 1e-6), 0.0)
    return (h * 60) % 360, s, mx


def hsv_a_rgb(h, s, v):
    """Inversa de tono_saturacion: tono en grados, saturación y valor 0-1."""
    h6 = (h % 360) / 60.0
    i = np.floor(h6).astype(int) % 6
    f = h6 - np.floor(h6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.dstack([r, g, b]).astype(np.float32)


def distancia_tono(h, h0):
    d = np.abs(h - h0) % 360
    return np.minimum(d, 360 - d)


def promedio_vecino(rgb, mascara, sigma):
    """Color medio de los píxeles de `mascara` alrededor de cada punto.

    Convolución normalizada: suave, sin los saltos que deja tomar "el vecino
    más cercano" (esos saltos se veían como rayas en el borde). Donde no hay
    ningún píxel de la máscara cerca, cae al más cercano.
    """
    m = mascara.astype(np.float32)
    peso = ndimage.gaussian_filter(m, sigma)
    suma = np.dstack([ndimage.gaussian_filter(rgb[..., i] * m, sigma) for i in range(3)])
    _, (y, x) = ndimage.distance_transform_edt(~mascara, return_indices=True)
    cercano = rgb[y, x]
    hay = (peso > 1e-3)[..., None]
    return np.where(hay, suma / np.maximum(peso, 1e-6)[..., None], cercano)


def quitar_fondo(img, conservar_oscuros=False, forzar_objeto=None):
    """Devuelve un RGBA float (H, W, 4) con el fondo magenta transparente.

    forzar_objeto: máscara booleana de lo que seguro es objeto (ver `silueta`).
    """
    rgb = np.asarray(img.convert("RGB")).astype(np.float32) / 255.0
    h, s, v = tono_saturacion(rgb)

    # Tono del fondo: mediana del borde de la imagen (siempre es fondo).
    borde = np.zeros(h.shape, bool)
    borde[:6, :] = borde[-6:, :] = borde[:, :6] = borde[:, -6:] = True
    h0 = float(np.median(h[borde]))
    s0 = float(np.median(s[borde]))
    d = distancia_tono(h, h0)

    # 1. Clasificación. La saturación del fondo cambia de una zona a otra
    #    (degradé, reflejo del piso), así que cada píxel se compara contra la
    #    de su zona. La firma que separa fondo de objeto es esa saturación:
    #    una sombra sobre el fondo es más oscura pero igual de saturada; un
    #    reflejo del fondo en acero, o el rebote rosado en un blanco, tiene el
    #    tono del fondo pero bastante MENOS saturación.
    #    La saturación de zona se mide solo con fondo seguro pegado al borde,
    #    para que los reflejos de adentro del objeto no la arrastren.
    #    Y solo con fondo iluminado: las sombras no son la referencia.
    semilla = (d < 20) & (s > 0.8 * s0) & (v > 0.75 * np.median(v[borde]))
    etiquetas, n = ndimage.label(semilla)
    if n:
        semilla &= np.isin(etiquetas, np.unique(etiquetas[borde & semilla]))
    m = semilla.astype(np.float32)
    peso = ndimage.gaussian_filter(m, 30)
    s_zona = np.where(peso > 1e-3, ndimage.gaussian_filter(s * m, 30) / np.maximum(peso, 1e-6), s0)
    v_zona = np.where(peso > 1e-3, ndimage.gaussian_filter(v * m, 30) / np.maximum(peso, 1e-6), np.median(v[borde]))
    # Y algo de luz: el reflejo del fondo en una pieza oscura (azul marino,
    # acero en sombra) es magenta saturado pero mucho más oscuro que el fondo.
    # Pero una sombra de contacto también es oscura y magenta, y el pedido es
    # SIN sombra: por omisión lo oscuro y saturado se toma como sombra, o sea
    # fondo. La frontera entre los dos casos es fina; con `conservar_oscuros`
    # (pieza oscura y brillante, sin sombra debajo) gana siempre el objeto.
    oscuro_es_fondo = np.zeros(h.shape, bool) if conservar_oscuros else (s > np.maximum(0.45, 0.75 * s_zona))
    fondo = (d < 32) & (s > np.maximum(0.30, 0.82 * s_zona)) & ((v > 0.55 * v_zona) | oscuro_es_fondo)
    objeto = (d > 55) | (s < 0.18)
    # Lo que parece fondo pero está encerrado por el objeto: es un agujero de
    # verdad (entre peldaños, dentro de un asa) solo si tiene la saturación
    # plena del fondo y algún tamaño; si no, es un brillo y queda opaco.
    etiquetas, n = ndimage.label(fondo)
    if n:
        indices = np.arange(1, n + 1)
        tamanos = ndimage.sum(fondo, etiquetas, indices)
        s_comp = ndimage.median(s, etiquetas, indices)
        s_ref = ndimage.median(s_zona, etiquetas, indices)
        toca_borde = np.zeros(n + 1, bool)
        toca_borde[np.unique(etiquetas[borde])] = True
        brillo = np.zeros(n + 1, bool)
        brillo[1:] = ~toca_borde[1:] & ((tamanos < 30) | (s_comp < 0.9 * s_ref))
        fondo &= ~brillo[etiquetas]
        objeto |= brillo[etiquetas]
    # Silueta conocida (una edición de color de otra ilustración, alineada al
    # píxel): adentro de ella no hay fondo posible, sea cual sea el reflejo.
    if forzar_objeto is not None:
        fondo &= ~forzar_objeto
        objeto |= forzar_objeto
    objeto &= ~fondo

    alfa = np.ones(h.shape, np.float32)
    alfa[fondo] = 0.0
    color = rgb.copy()

    # 2. Franja dudosa: lo que no es ni uno ni otro y está pegado al fondo.
    #    Angosta a propósito: la mezcla real del antialias ocupa 1-2 px; más
    #    adentro, un rosado es rebote sobre el objeto y queda opaco.
    cerca_fondo = ndimage.binary_dilation(fondo, iterations=3)
    franja = ~fondo & ~objeto & cerca_fondo
    if franja.any():
        M = promedio_vecino(rgb, fondo, 4)  # color del fondo de al lado (con su sombra)
        F = promedio_vecino(rgb, objeto, 2.5)  # color del objeto de al lado
        # a) Proyección sobre la recta fondo → objeto: sirve con objetos de color.
        MF = F - M
        largo2 = np.maximum((MF ** 2).sum(-1), 1e-4)
        a_proy = ((rgb - M) * MF).sum(-1) / largo2
        # b) Con un objeto neutro (blanco, gris, metal) mezclar con el fondo solo
        #    agrega croma, así que la opacidad es 1 - croma / croma del fondo.
        #    Aguanta mejor el rebote rosado en las caras en sombra.
        croma = rgb.max(-1) - rgb.min(-1)
        croma_m = np.maximum(M.max(-1) - M.min(-1), 1e-3)
        a_croma = 1 - croma / croma_m
        _, sF, _ = tono_saturacion(F)
        neutro = np.clip(1 - sF / 0.25, 0, 1)
        a_real = np.clip(neutro * a_croma + (1 - neutro) * a_proy, 0.0, 1.0)
        # Niveles: lo casi opaco es objeto teñido, no mezcla; el borde queda nítido.
        a = np.clip((a_real - 0.08) / 0.8, 0.0, 1.0)
        alfa[franja] = a[franja]
        # Desmezcla: C = a·F + (1-a)·M  →  F = (C - (1-a)·M) / a. Con la
        # opacidad SIN niveles: con la nivelada se resta magenta de más y un
        # gris sale verde (el complemento del magenta).
        az = np.maximum(a_real, 1e-3)[..., None]
        desmezcla = np.clip((rgb - (1 - a_real)[..., None] * M) / az, 0, 1)
        desmezcla = np.where((a_real < 0.25)[..., None], F, desmezcla)
        # Junto a un objeto neutro el resultado tiene que ser neutro.
        gris_d = desmezcla.mean(-1, keepdims=True)
        desmezcla = desmezcla + (gris_d - desmezcla) * neutro[..., None]
        color[franja] = desmezcla[franja]

    # 3. Sin tinte magenta. Ningún producto es violeta, rosa ni magenta:
    #    a) del lado azul, el violeta es azul con reflejo magenta, así que se
    #       le devuelve el tono hacia el azul (225°) sin tocar su saturación;
    #    b) cerca del tono del fondo se desatura. El gris de destino va entre
    #       la luminosidad y el máximo, para que un blanco teñido de rosa
    #       vuelva a blanco y no a gris sucio.
    h2, s2, v2 = tono_saturacion(color)
    delta = (h2 - h0 + 540) % 360 - 180  # negativo = hacia el azul
    lado_azul = (h2 >= 235) & (delta < -25)
    t = np.clip((h2 - 235) / 30, 0, 1)  # de 265° para arriba vuelve entero a 225°
    h_corr = np.where(lado_azul, h2 + (225 - h2) * t, h2)
    color = np.where(lado_azul[..., None], hsv_a_rgb(h_corr, s2, v2), color)
    ancho = np.where(delta < 0, 15, 30)  # del lado azul ya actuó la corrección de tono
    w = np.clip(1 - (np.abs(delta) - 25) / ancho, 0, 1)
    lum = (color * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
    gris = 0.5 * lum + 0.5 * color.max(-1, keepdims=True)
    color = gris + (color - gris) * (1 - w)[..., None]

    # Borde suave de ~1 px (a 1024 px) y fuera las motas sueltas.
    alfa = ndimage.gaussian_filter(alfa, 0.7)
    solido = alfa > 0.5
    etiquetas, n = ndimage.label(solido)
    if n > 1:
        tamanos = ndimage.sum(solido, etiquetas, range(1, n + 1))
        motas = np.zeros(n + 1, bool)
        motas[1:] = tamanos < max(150, 0.001 * tamanos.max())
        quitar = ndimage.binary_dilation(motas[etiquetas], iterations=3) & ~ndimage.binary_dilation(
            ~motas[etiquetas] & solido, iterations=1
        )
        alfa[quitar] = 0.0
    alfa[alfa < 0.02] = 0.0
    return np.dstack([np.clip(color, 0, 1), alfa])


def encuadrar(rgba, lado):
    """Recorta al contenido, centra en un cuadrado con margen y achica a `lado`."""
    alfa = rgba[..., 3]
    ys, xs = np.nonzero(alfa > 0.02)
    if not len(ys):
        raise ValueError("quedó vacía: el recorte se comió todo")
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    recorte = rgba[y0:y1, x0:x1]
    alto, ancho = recorte.shape[:2]
    caja = int(round(max(alto, ancho) / (1 - 2 * MARGEN)))
    lienzo = np.zeros((caja, caja, 4), np.float32)
    oy, ox = (caja - alto) // 2, (caja - ancho) // 2
    lienzo[oy:oy + alto, ox:ox + ancho] = recorte
    im = Image.fromarray((lienzo * 255 + 0.5).astype(np.uint8), "RGBA")
    # Premultiplicado: si no, el color del fondo transparente se cuela en el borde.
    return im.convert("RGBa").resize((lado, lado), Image.LANCZOS).convert("RGBA")


def guardar_webp(im, ruta):
    for calidad in (90, 85, 80, 75, 70, 65, 60):
        im.save(ruta, "WEBP", quality=calidad, method=6, alpha_quality=90)
        if os.path.getsize(ruta) <= PESO_MAX_KB * 1024:
            break
    return calidad


def sobre(im, fondo):
    base = Image.new("RGBA", im.size, fondo + (255,))
    base.alpha_composite(im)
    return base.convert("RGB")


def prueba(im, ruta):
    """Claro | oscuro, ampliado si es chico, para mirar el borde."""
    k = max(1, 512 // im.width)
    grande = im.resize((im.width * k, im.height * k), Image.NEAREST)
    hoja = Image.new("RGB", (grande.width * 2, grande.height))
    hoja.paste(sobre(grande, CLARO), (0, 0))
    hoja.paste(sobre(grande, OSCURO), (grande.width, 0))
    hoja.save(ruta)


def hoja_de_contactos(salida, nombres, ruta, celda=180, columnas=7):
    fuente = ImageFont.load_default(size=13)
    filas = -(-len(nombres) // columnas)
    alto_celda = celda + 22
    hoja = Image.new("RGB", (columnas * celda, 2 * filas * alto_celda), CLARO)
    ImageDraw.Draw(hoja).rectangle([0, filas * alto_celda, hoja.width, hoja.height], fill=OSCURO)
    for seccion, (fondo, tinta) in enumerate([(CLARO, (60, 60, 60)), (OSCURO, (200, 200, 200))]):
        for i, nombre in enumerate(nombres):
            im = Image.open(os.path.join(salida, nombre + ".webp")).convert("RGBA")
            im = im.resize((celda - 12, celda - 12), Image.LANCZOS)
            x = (i % columnas) * celda
            y = (seccion * filas + i // columnas) * alto_celda
            hoja.paste(im, (x + 6, y + 4), im)
            ImageDraw.Draw(hoja).text((x + celda / 2, y + celda + 2), nombre, fill=tinta, font=fuente, anchor="ma")
    hoja.save(ruta)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("nombres", nargs="*")
    p.add_argument("--crudas", required=True)
    p.add_argument("--salida", default=os.path.join(AQUI, "public", "ilustraciones"))
    p.add_argument("--prueba", action="store_true")
    p.add_argument("--hoja", action="store_true")
    args = p.parse_args()

    with open(os.path.join(args.crudas, "manifiesto.json"), encoding="utf-8") as f:
        manifiesto = json.load(f)
    lados = {m["nombre"]: m["lado"] for m in manifiesto}
    # Ajustes de recorte por ilustración (ver `recorte` en scripts-ilustraciones.mjs).
    ajustes = {m["nombre"]: m.get("recorte") or {} for m in manifiesto}
    desconocidos = [n for n in args.nombres if n not in lados]
    if desconocidos:
        sys.exit("No están en el manifiesto: " + ", ".join(desconocidos))
    os.makedirs(args.salida, exist_ok=True)
    if args.prueba:
        os.makedirs(os.path.join(args.crudas, "pruebas"), exist_ok=True)

    for nombre in args.nombres or list(lados):
        cruda = os.path.join(args.crudas, nombre + ".png")
        if not os.path.exists(cruda):
            print(f"-  {nombre}: falta el crudo, se saltea")
            continue
        ajuste = ajustes[nombre]
        forzar = None
        if ajuste.get("silueta"):
            # La silueta de la base, achicada 3 px por si la edición corrió algún borde.
            base = os.path.join(args.crudas, ajuste["silueta"] + ".png")
            solido = quitar_fondo(Image.open(base))[..., 3] > 0.5
            forzar = ndimage.binary_erosion(solido, iterations=3)
        rgba = quitar_fondo(Image.open(cruda), bool(ajuste.get("conservarOscuros")), forzar)
        im = encuadrar(rgba, lados[nombre])
        destino = os.path.join(args.salida, nombre + ".webp")
        calidad = guardar_webp(im, destino)
        kb = os.path.getsize(destino) / 1024
        print(f"+  {nombre}.webp  {im.width}x{im.height}  {kb:.1f} KB  (calidad {calidad})")
        if args.prueba:
            prueba(im, os.path.join(args.crudas, "pruebas", nombre + ".png"))

    if args.hoja:
        hechas = [m["nombre"] for m in manifiesto if os.path.exists(os.path.join(args.salida, m["nombre"] + ".webp"))]
        ruta = os.path.join(args.crudas, "hoja-de-contactos.png")
        hoja_de_contactos(args.salida, hechas, ruta)
        print(f"Hoja de contactos: {ruta}")


if __name__ == "__main__":
    main()
