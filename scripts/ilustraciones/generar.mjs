/**
 * GENERA LAS ILUSTRACIONES DE UN PROYECTO con Gemini (regla 01: guías
 * ilustradas, nunca un manual).
 *
 *   node generar.mjs --manifiesto ilustraciones.json --crudas <dir>            las que falten
 *   node generar.mjs --manifiesto ilustraciones.json --crudas <dir> a b        solo esas
 *   node generar.mjs --manifiesto ilustraciones.json --crudas <dir> a --rehacer
 *
 * PASO 1 DE 2. Pide cada imagen y guarda el PNG crudo en `--crudas`, junto con
 * el texto exacto que se mandó (`<nombre>.txt`). La versión anterior no se
 * pierde: va a `descartadas/`. El PASO 2 es `preparar.py`, que deja los WebP en
 * `public/ilustraciones/` del proyecto.
 *
 * UN ESTILO, «Gibby»: 3D estilizado tipo película animada, con la paleta de Abasto. TRES TIPOS:
 *   · escena: una situación con su fondo pastel (guías, estados vacíos, las
 *     zonas del panel). Con `proporcion` («16:9») se respeta al prepararla;
 *     sin ella, se recorta en 4:3;
 *   · objeto: algo suelto sobre magenta plano, para recortarlo transparente;
 *   · maqueta: la maqueta isométrica del taller, sin techo, que el panel
 *     usa de escenario con los marcadores encima (D26).
 *
 * LA CLAVE. `VERTEX_API_KEY` (Vertex AI) o `GEMINI_API_KEY` (AI Studio), del
 * `.env.local` del proyecto. Viaja en un encabezado, nunca en la URL, así que no
 * aparece en ningún error. No se imprime jamás. La aplicación nunca llama a
 * Gemini: esto corre en local, una vez.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const MODELO = "gemini-2.5-flash-image";

const CLAVE_VERTEX = process.env.VERTEX_API_KEY;
const CLAVE_GEMINI = process.env.GEMINI_API_KEY;
const CLAVE = CLAVE_VERTEX || CLAVE_GEMINI;
const URL_MODELO = CLAVE_VERTEX
  ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${MODELO}:generateContent`
  : `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opcion = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const MANIFIESTO = opcion("--manifiesto");
const CRUDAS = opcion("--crudas");
const REHACER = args.includes("--rehacer");
const pedidos = args.filter(
  (a, i) => !a.startsWith("--") && !["--manifiesto", "--crudas"].includes(args[i - 1]),
);

if (!MANIFIESTO || !CRUDAS) {
  console.error("Uso: node generar.mjs --manifiesto ilustraciones.json --crudas <dir> [nombres...] [--rehacer]");
  process.exit(1);
}
if (!CLAVE) {
  console.error("Falta VERTEX_API_KEY o GEMINI_API_KEY en el entorno.");
  process.exit(1);
}

const manifiesto = JSON.parse(readFileSync(resolve(MANIFIESTO), "utf8"));
mkdirSync(join(CRUDAS, "descartadas"), { recursive: true });

// ---------------------------------------------------------------------------
// El estilo: «Gibby» (D30, 26/10/2026). El de Cell Diagnostic: 3D estilizado
// tipo película animada, personajes simpáticos, formas redondeadas, fondo
// pastel. Reemplaza a la acuarela, las fotos realistas y la maqueta
// fotorrealista, que «parecían full IA». Va en inglés porque el modelo lo
// sigue mejor. Un solo estilo para TODO: escenas, zonas, maqueta y objetos.
// ---------------------------------------------------------------------------
const ESTILO = [
  "Stylized 3D animated-feature-film render, Pixar / Disney look: soft clay-like materials, rounded chunky friendly shapes,",
  "smooth glossy surfaces, warm soft studio lighting with gentle ambient occlusion and soft realistic shadows. Polished, cheerful, premium.",
  "NOT photorealistic, NOT a photograph, NOT watercolor, NOT flat vector, NOT anime.",
  "Palette: vibrant lime-yellow-green as the hero accent, deep forest green for contrast, warm amber touches, natural kraft-cardboard browns and white. Sunny, airy, fresh.",
  "Never write color codes, letters or any characters on objects.",
  "Setting: Bolivia (Santa Cruz), neighborhood grocery stores and wholesale markets, sunny and warm.",
  "Friendly Bolivian characters with expressive big eyes and warm smiles; delivery riders wear a deep forest-green polo shirt and cap with lime-green details.",
  "Grocery products look appetizing and real in color (golden cooking oil, white rice sacks, brown cardboard boxes, colorful soda bottles)",
  "but are cute and simplified, with plain packaging and NO brand names, NO labels with writing.",
  "Simple, uncluttered composition with one clear focus.",
  "No text, no letters, no numbers, no logos, no signs or boards with writing.",
].join(" ");

const FONDO_ESCENA =
  "Background: soft pastel very light mint studio backdrop with a few subtle rounded abstract shapes, gentle gradient, no clutter.";

const FONDO_OBJETO = [
  "The object floats isolated: no floor, no ground, no cast shadow, no reflection, no white outline or sticker border.",
  "Background: one perfectly uniform flat color, pure magenta RGB(255,0,255), identical in every corner, no gradient.",
].join(" ");

// Se repite al final: el modelo respeta más lo último que lee.
const CIERRE_OBJETO =
  "Reminder: uniform flat pure magenta RGB(255,0,255) background, no shadow, no floor, no text anywhere. Stylized Pixar-like 3D render.";
const CIERRE_ESCENA = "Reminder: stylized Pixar-like 3D render, not a photo; no text, no letters, no numbers and no logos anywhere.";

const ESTILO_MAQUETA = [
  "A cute ISOMETRIC MINIATURE DIORAMA, like a premium toy model, seen from above at a 35 degree isometric angle,",
  "sitting on a rounded floating base platform with soft edges, with NO ROOF so every room is visible from above.",
  "Chunky rounded walls, toy-like cars, tiny cute cartoon people working, little round trees and potted plants.",
  "Plain very light warm grey #EEF2F5 background around the model, no sky, no horizon, no landscape, soft contact shadow under the base.",
].join(" ");

// La maqueta «isla» (D30): la misma maqueta sobre magenta, para recortarla y
// que flote sola en el panel, con su sombra y su inclinación en CSS.
const MAQUETA_SOBRE_MAGENTA = [
  "The diorama floats isolated: no table, no ground, no cast shadow under the base, no reflection.",
  "Background: one perfectly uniform flat color, pure magenta RGB(255,0,255), identical in every corner, no gradient.",
].join(" ");

function armarPrompt(img) {
  if (img.tipo === "maqueta" && img.recorte) {
    const estilo = ESTILO_MAQUETA.replace(/Plain very light warm grey[^.]*\./, "");
    return `${ESTILO}

${estilo} ${MAQUETA_SOBRE_MAGENTA}

Model: ${img.tema}

${CIERRE_OBJETO} Isometric diorama, no roof.`;
  }
  if (img.tipo === "maqueta") {
    return `${ESTILO}

${ESTILO_MAQUETA}

Model: ${img.tema}

${CIERRE_ESCENA} Isometric diorama, no roof.`;
  }
  if (img.tipo === "objeto") {
    return `${ESTILO} ${FONDO_OBJETO}

Subject: ${img.tema}

${CIERRE_OBJETO}`;
  }
  // «ambiente»: la escena trae su propio lugar (calle, tienda) en vez del fondo de estudio (portadas del registro, 02/11)
  return `${ESTILO} ${img.ambiente ? "" : FONDO_ESCENA}

Scene: ${img.tema}

${CIERRE_ESCENA}`;
}

// ---------------------------------------------------------------------------
// El pedido
// ---------------------------------------------------------------------------
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const tapar = (texto) => (CLAVE ? String(texto).split(CLAVE).join("***") : String(texto));

async function pedir(prompt, img) {
  const res = await fetch(URL_MODELO, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": CLAVE },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: img.proporcion ?? (img.tipo === "objeto" ? "1:1" : "4:3") },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const cuerpo = await res.text();
  if (!res.ok) {
    let mensaje = cuerpo;
    try {
      mensaje = JSON.parse(cuerpo).error?.message ?? cuerpo;
    } catch {}
    const err = new Error(`HTTP ${res.status}: ${tapar(mensaje).replace(/\s+/g, " ").slice(0, 200)}`);
    err.reintentable = res.status === 429 || res.status >= 500;
    throw err;
  }
  const datos = JSON.parse(cuerpo);
  const parte = (datos.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!parte) {
    const err = new Error(`El modelo no devolvió imagen (${datos.candidates?.[0]?.finishReason ?? "sin candidatos"})`);
    err.reintentable = true;
    throw err;
  }
  return Buffer.from(parte.inlineData.data, "base64");
}

// El 429 es el cupo por minuto del modelo: se le da tiempo de sobra.
async function pedirConReintentos(prompt, img, intentos = 6) {
  for (let i = 1; ; i++) {
    try {
      return await pedir(prompt, img);
    } catch (e) {
      const red = e.name === "TimeoutError" || e.name === "TypeError";
      if (i >= intentos || !(e.reintentable || red)) throw e;
      const ms = Math.min(60_000, 10_000 * i);
      console.log(`   intento ${i} falló (${tapar(e.message).slice(0, 120)}); reintento en ${ms / 1000}s`);
      await espera(ms);
    }
  }
}

// ---------------------------------------------------------------------------
// En serie, una por una: el modelo tiene cupo por minuto.
// ---------------------------------------------------------------------------
const lista = pedidos.length
  ? manifiesto.imagenes.filter((i) => pedidos.includes(i.nombre))
  : manifiesto.imagenes;
let hechas = 0;
let fallidas = 0;

for (const img of lista) {
  const png = join(CRUDAS, `${img.nombre}.png`);
  if (existsSync(png) && !REHACER) {
    console.log(`=  ${img.nombre} (ya estaba)`);
    continue;
  }
  if (hechas + fallidas > 0) await espera(5000);
  const prompt = armarPrompt(img);
  const t0 = Date.now();
  try {
    const buf = await pedirConReintentos(prompt, img);
    if (existsSync(png)) renameSync(png, join(CRUDAS, "descartadas", `${img.nombre}-${Date.now()}.png`));
    writeFileSync(png, buf);
    writeFileSync(join(CRUDAS, `${img.nombre}.txt`), prompt);
    hechas++;
    console.log(`+  ${img.nombre}  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${(buf.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    fallidas++;
    console.log(`x  ${img.nombre}: ${tapar(e.message)}`);
  }
}

console.log(`\nListo: ${hechas} generadas, ${fallidas} fallidas. Crudas en ${CRUDAS}`);
if (fallidas) process.exit(1);
