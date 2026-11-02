"""Recorta el fondo magenta SOLO si toca el borde (relleno desde las orillas): nunca deja huecos dentro de la figura.

python -I recorte_sin_huecos.py cruda.png salida.webp [alto_maximo_fraccion]
"""
import sys
from collections import deque

from PIL import Image, ImageFilter

cruda, salida = sys.argv[1], sys.argv[2]
corte = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0

im = Image.open(cruda).convert('RGB')
w, h = im.size
px = im.load()


def magenta(c):
    r, g, b = c
    # Magenta o frambuesa (el modelo a veces pinta un degradé): rojo y azul muy por encima del verde
    return r - g > 55 and b - g > 25 and r > 110


fondo = bytearray(w * h)
cola = deque()
for x in range(w):
    for y in (0, h - 1):
        if magenta(px[x, y]):
            cola.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if magenta(px[x, y]):
            cola.append((x, y))
while cola:
    x, y = cola.popleft()
    i = y * w + x
    if fondo[i]:
        continue
    fondo[i] = 1
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not fondo[ny * w + nx] and magenta(px[nx, ny]):
            cola.append((nx, ny))


# Los huecos encerrados (entre un brazo y el cuerpo, entre la moto y el piloto) solo se quitan si son magenta FUERTE:
# la piel, la madera o una fruta nunca tienen el azul tan por encima del verde (02/11)
def magenta_fuerte(c):
    r, g, b = c
    return r - g > 90 and b - g > 50 and r > 130


for y in range(h):
    for x in range(w):
        if not fondo[y * w + x] and magenta_fuerte(px[x, y]):
            fondo[y * w + x] = 1

# Manchas sueltas (la sombra que queda flotando debajo): se borra todo lo que no sea la figura más grande
visto = bytearray(w * h)
piezas = []
for inicio in range(w * h):
    if fondo[inicio] or visto[inicio]:
        continue
    pieza = [inicio]
    visto[inicio] = 1
    k = 0
    while k < len(pieza):
        i = pieza[k]
        k += 1
        x, y = i % w, i // w
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            j = ny * w + nx
            if 0 <= nx < w and 0 <= ny < h and not fondo[j] and not visto[j]:
                visto[j] = 1
                pieza.append(j)
    piezas.append(pieza)
if piezas:
    mayor = max(len(p) for p in piezas)
    for p in piezas:
        # Las monedas y el confeti sueltos se quedan; solo se van las manchas chiquitas
        if len(p) < mayor * 0.004:
            for i in p:
                fondo[i] = 1

alfa = Image.new('L', (w, h))
alfa.putdata([0 if f else 255 for f in fondo])
# Borde suave y sin halo magenta
alfa = alfa.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1))
rgba = im.convert('RGBA')
rgba.putalpha(alfa)
datos = rgba.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = datos[x, y]
        if 0 < a < 255 and r > g + 40 and b > g + 40:
            m = min(r, b)
            datos[x, y] = (max(g, r - (m - g)), g, max(g, b - (m - g)), a)

if corte < 1:
    rgba = rgba.crop((0, 0, w, int(h * corte)))
caja = rgba.getbbox()
rgba = rgba.crop(caja)
lado = max(rgba.size) + 24
lienzo = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
lienzo.paste(rgba, ((lado - rgba.size[0]) // 2, (lado - rgba.size[1]) // 2), rgba)
lienzo.resize((640, 640), Image.LANCZOS).save(salida, 'WEBP', quality=85, method=6)
print('ok', salida)
