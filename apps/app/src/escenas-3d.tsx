/**
 * LAS ESCENAS EN 3D DE VERDAD (02/11, pedido de Andrés: «más natural, 3D como el panel del taller»). Con three.js y
 * React Three Fiber sobre expo-gl, armadas con piezas redondeadas y materiales mate (el estilo del taller mecánico):
 * nada de modelos descargados, todo se dibuja en el teléfono y anda sin señal.
 *
 * Este es el único archivo que importa `three`; `escenas.tsx` lo carga solo si el teléfono tiene expo-gl (si no, queda
 * la escena ilustrada). Cada escena es una isla flotante, como la maqueta del taller:
 *   · revisa: el vendedor en su mostrador, con estantes llenos, marca la lista y salta un visto;
 *   · prepara: el depósito; las cajas avanzan por la cinta y caen en la caja grande que la chica empaca;
 *   · camino: la moto recorre el barrio: casas, árboles y faroles pasan, las ruedas giran y sale humito;
 *   · pagar: el celular con el QR gira despacio, con monedas que dan vueltas y un aro que late;
 *   · entregado: el repartidor le da la caja a la dueña en la puerta de su tienda y cae confeti.
 * La cámara deriva despacio. Con «reducir movimiento» se dibuja una vez y queda quieta.
 */
import { useIsFocused } from '@react-navigation/native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ClaveDeEscena } from './escenas';

// ---------------------------------------------------------------------------------------------------------------------
// Colores (los de la app, resueltos para WebGL)
// ---------------------------------------------------------------------------------------------------------------------
const C = {
  lima: '#C9F45A',
  limaFuerte: '#A9D93A',
  bosque: '#1F3B30',
  bosqueClaro: '#2F5545',
  ambar: '#FFB454',
  oro: '#F5B83D',
  kraft: '#D6A86E',
  kraftOscuro: '#B98A52',
  madera: '#C08A5B',
  tierra: '#B9875F',
  piso: '#F4EEDF',
  pasto: '#A9CF8C',
  pastoOscuro: '#93C178',
  copas: ['#6DAE57', '#5E9F4C', '#82BE67', '#74B35E'],
  tronco: '#8A5D3F',
  blanco: '#FBFBF7',
  crema: '#F6EBD3',
  calle: '#3C4652',
  vereda: '#E9E6DC',
  teja: '#D9774A',
  piel: ['#E6BC92', '#C99467', '#A9774F'],
  pelo: '#3B2A20',
  ojo: '#1B1B1B',
  rueda: '#20262E',
  vidrio: '#BFE3F2',
  pantalla: '#E9F9C4',
  aceite: '#F2C230',
  gaseosa: ['#E0533D', '#3E8E41', '#F28C28'],
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// Geometrías y materiales compartidos: se crean una vez
// ---------------------------------------------------------------------------------------------------------------------
const cache = new Map<string, THREE.BufferGeometry>();
function caja(ancho: number, alto: number, largo: number, radio = 0.06) {
  const clave = `c:${ancho}:${alto}:${largo}:${radio}`;
  let g = cache.get(clave);
  if (!g) {
    const r = Math.min(radio, ancho / 2 - 0.001, alto / 2 - 0.001, largo / 2 - 0.001);
    g = r > 0.005 ? new RoundedBoxGeometry(ancho, alto, largo, 3, r) : new THREE.BoxGeometry(ancho, alto, largo);
    cache.set(clave, g);
  }
  return g;
}
function cilindro(radio: number, alto: number, lados = 20, radioArriba = radio) {
  const clave = `y:${radio}:${alto}:${lados}:${radioArriba}`;
  let g = cache.get(clave);
  if (!g) {
    g = new THREE.CylinderGeometry(radioArriba, radio, alto, lados);
    cache.set(clave, g);
  }
  return g;
}
function esfera(radio: number, media = false) {
  const clave = `e:${radio}:${media}`;
  let g = cache.get(clave);
  if (!g) {
    g = new THREE.SphereGeometry(radio, 20, 14, 0, Math.PI * 2, 0, media ? Math.PI / 2 : Math.PI);
    cache.set(clave, g);
  }
  return g;
}
function capsula(radio: number, largo: number) {
  const clave = `k:${radio}:${largo}`;
  let g = cache.get(clave);
  if (!g) {
    g = new THREE.CapsuleGeometry(radio, largo, 6, 12);
    cache.set(clave, g);
  }
  return g;
}
function aro(radio: number, grosor: number) {
  const clave = `t:${radio}:${grosor}`;
  let g = cache.get(clave);
  if (!g) {
    g = new THREE.TorusGeometry(radio, grosor, 12, 28);
    cache.set(clave, g);
  }
  return g;
}
function techo(ancho: number, alto: number) {
  const clave = `r:${ancho}:${alto}`;
  let g = cache.get(clave);
  if (!g) {
    g = new THREE.ConeGeometry(ancho, alto, 4);
    g.rotateY(Math.PI / 4);
    cache.set(clave, g);
  }
  return g;
}

const materiales = new Map<string, THREE.MeshStandardMaterial>();
function mate(color: string, o: { rugosidad?: number; metal?: number; brillo?: string; intensidad?: number; opacidad?: number } = {}) {
  const clave = `${color}:${o.rugosidad ?? 0.62}:${o.metal ?? 0}:${o.brillo ?? ''}:${o.intensidad ?? 0}:${o.opacidad ?? 1}`;
  let m = materiales.get(clave);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rugosidad ?? 0.62,
      metalness: o.metal ?? 0,
      emissive: o.brillo ?? '#000000',
      emissiveIntensity: o.intensidad ?? 0,
      transparent: (o.opacidad ?? 1) < 1,
      opacity: o.opacidad ?? 1,
    });
    materiales.set(clave, m);
  }
  return m;
}

type V3 = [number, number, number];

function Pieza({ geo, color, p, r, s, sombra = true, material }: { geo: THREE.BufferGeometry; color?: string; p?: V3; r?: V3; s?: number | V3; sombra?: boolean; material?: THREE.Material }) {
  return <mesh geometry={geo} material={material ?? mate(color ?? C.blanco)} position={p} rotation={r} scale={s} castShadow={sombra} receiveShadow />;
}

// ---------------------------------------------------------------------------------------------------------------------
// El tiempo: quieto con «reducir movimiento»
// ---------------------------------------------------------------------------------------------------------------------
const Moverse = createContext(true);
function useTiempo() {
  const moverse = useContext(Moverse);
  return (reloj: THREE.Clock) => (moverse ? reloj.elapsedTime : 1.7);
}
/** Un cuadro de animación: `f(t)` con el tiempo de la escena */
function useCuadro(f: (t: number) => void) {
  const tiempo = useTiempo();
  useFrame(({ clock }) => f(tiempo(clock)));
}

// ---------------------------------------------------------------------------------------------------------------------
// El lienzo
// ---------------------------------------------------------------------------------------------------------------------
const CAMARA: Record<ClaveDeEscena, { pos: V3; mira: V3; fov: number }> = {
  revisa: { pos: [0, 2.9, 8.4], mira: [0, 1.1, 0], fov: 26 },
  prepara: { pos: [0.3, 3.0, 8.5], mira: [0, 1.0, 0], fov: 26 },
  camino: { pos: [2.0, 2.5, 10.2], mira: [0.2, 0.95, 0], fov: 26 },
  pagar: { pos: [0.2, 2.9, 8.5], mira: [0.1, 1.15, 0], fov: 26 },
  entregado: { pos: [0, 3.2, 8.8], mira: [0, 1.1, 0], fov: 27 },
};

export function Escena3D({ clave, quieto }: { clave: ClaveDeEscena; quieto: boolean }) {
  const enFoco = useIsFocused();
  const cam = CAMARA[clave];
  return (
    <Canvas
      shadows
      frameloop={quieto ? 'demand' : enFoco ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.pos, fov: cam.fov, near: 0.1, far: 80 }}
      style={{ flex: 1, backgroundColor: 'transparent' }}
    >
      <Moverse.Provider value={!quieto}>
        <Camara base={cam.pos} mira={cam.mira} />
        <Luces />
        {clave === 'revisa' && <Revisa />}
        {clave === 'prepara' && <Prepara />}
        {clave === 'camino' && <EnCamino />}
        {clave === 'pagar' && <Pagar />}
        {clave === 'entregado' && <Entregado />}
      </Moverse.Provider>
    </Canvas>
  );
}

/** La cámara deriva despacio de un lado al otro (prioridad negativa: no le quita a R3F el dibujo) */
function Camara({ base, mira }: { base: V3; mira: V3 }) {
  const { camera } = useThree();
  const objetivo = useMemo(() => new THREE.Vector3(...mira), [mira]);
  const tiempo = useTiempo();
  useFrame(({ clock }) => {
    const t = tiempo(clock);
    camera.position.set(base[0] + Math.sin(t * 0.35) * 0.55, base[1] + Math.sin(t * 0.5) * 0.08, base[2]);
    camera.lookAt(objetivo);
  }, -1);
  return null;
}

function Luces() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#e8efd9', 1.35]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[-4, 9, 6]}
        intensity={1.85}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={6}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0008}
        shadow-normalBias={0.03}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------------------------------------------------

/** La isla flotante: el piso de la escena con su borde de tierra (como la maqueta del taller) */
function Isla({ ancho = 7.2, fondo = 3.4, piso = C.piso, flota = true }: { ancho?: number; fondo?: number; piso?: string; flota?: boolean }) {
  const g = useRef<THREE.Group>(null);
  useCuadro((t) => {
    if (g.current && flota) g.current.position.y = Math.sin(t * 0.8) * 0.04;
  });
  return (
    <group ref={g}>
      <Pieza geo={caja(ancho, 0.22, fondo, 0.1)} color={piso} p={[0, -0.11, 0]} />
      <Pieza geo={caja(ancho - 0.12, 0.42, fondo - 0.12, 0.16)} color={C.tierra} p={[0, -0.4, 0]} />
      <Pieza geo={caja(ancho - 0.5, 0.3, fondo - 0.5, 0.14)} color={C.kraftOscuro} p={[0, -0.7, 0]} />
    </group>
  );
}

function Maceta({ p, escala = 1 }: { p: V3; escala?: number }) {
  return (
    <group position={p} scale={escala}>
      <Pieza geo={cilindro(0.2, 0.34, 14, 0.25)} color={C.blanco} p={[0, 0.17, 0]} />
      <Pieza geo={esfera(0.32)} color={C.copas[1]} p={[0, 0.58, 0]} />
      <Pieza geo={esfera(0.22)} color={C.copas[2]} p={[0.18, 0.72, 0.08]} />
    </group>
  );
}

function Arbol({ p, escala = 1, color = C.copas[0], fase = 0 }: { p: V3; escala?: number; color?: string; fase?: number }) {
  const copa = useRef<THREE.Group>(null);
  useCuadro((t) => {
    if (!copa.current) return;
    copa.current.rotation.z = Math.sin(t * 0.9 + fase) * 0.05;
    copa.current.rotation.x = Math.cos(t * 0.7 + fase) * 0.03;
  });
  return (
    <group position={p} scale={escala}>
      <Pieza geo={cilindro(0.1, 0.8, 10, 0.07)} color={C.tronco} p={[0, 0.4, 0]} />
      <group ref={copa} position={[0, 0.75, 0]}>
        <Pieza geo={esfera(0.55)} color={color} p={[0, 0.45, 0]} />
        <Pieza geo={esfera(0.38)} color={color} p={[0.3, 0.3, 0.15]} />
        <Pieza geo={esfera(0.33)} color={color} p={[-0.28, 0.32, -0.1]} />
      </group>
    </group>
  );
}

/** Productos del mercado, de juguete */
function Bolsa({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Pieza geo={capsula(0.17, 0.16)} color={C.blanco} p={[0, 0.25, 0]} />
      <Pieza geo={cilindro(0.06, 0.08, 10)} color={C.limaFuerte} p={[0, 0.5, 0]} />
    </group>
  );
}
function Botella({ p, color = C.aceite, s = 1 }: { p: V3; color?: string; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Pieza geo={cilindro(0.09, 0.32, 14)} material={mate(color, { rugosidad: 0.25 })} p={[0, 0.16, 0]} />
      <Pieza geo={cilindro(0.04, 0.1, 10, 0.03)} color={color} p={[0, 0.37, 0]} />
      <Pieza geo={cilindro(0.035, 0.04, 10)} color={C.bosque} p={[0, 0.43, 0]} />
    </group>
  );
}
function Carton({ p, s = 1, r }: { p: V3; s?: number | V3; r?: V3 }) {
  return (
    <group position={p} rotation={r} scale={s}>
      <Pieza geo={caja(0.42, 0.32, 0.36, 0.03)} color={C.kraft} p={[0, 0.16, 0]} />
      <Pieza geo={caja(0.43, 0.04, 0.08, 0.01)} color={C.kraftOscuro} p={[0, 0.3, 0]} sombra={false} />
    </group>
  );
}

/** Un estante de madera lleno de productos */
function Estante({ p, ancho = 2.2 }: { p: V3; ancho?: number }) {
  const filas = [0.55, 1.15, 1.75];
  return (
    <group position={p}>
      <Pieza geo={caja(ancho, 2.2, 0.08, 0.03)} color={C.madera} p={[0, 1.1, -0.28]} />
      <Pieza geo={caja(0.08, 2.2, 0.62, 0.03)} color={C.bosque} p={[-ancho / 2, 1.1, 0]} />
      <Pieza geo={caja(0.08, 2.2, 0.62, 0.03)} color={C.bosque} p={[ancho / 2, 1.1, 0]} />
      <Pieza geo={caja(ancho + 0.1, 0.1, 0.66, 0.03)} color={C.lima} p={[0, 2.22, 0]} />
      {filas.map((y, i) => (
        <group key={y}>
          <Pieza geo={caja(ancho, 0.06, 0.58, 0.02)} color={C.madera} p={[0, y - 0.04, 0]} />
          {i === 0 && [-0.7, -0.25, 0.2, 0.65].map((x) => <Bolsa key={x} p={[x, y, 0]} s={0.95} />)}
          {i === 1 && [-0.8, -0.55, -0.3, -0.05].map((x) => <Botella key={x} p={[x, y, 0.02]} />)}
          {i === 1 && [0.35, 0.75].map((x) => <Carton key={x} p={[x, y, 0]} s={0.9} />)}
          {i === 2 && [-0.8, -0.55, -0.3, 0.1, 0.35, 0.6, 0.85].map((x, k) => <Botella key={x} p={[x, y, 0.02]} color={C.gaseosa[k % 3]} s={0.9} />)}
        </group>
      ))}
    </group>
  );
}

/**
 * Un muñeco simpático (más cercano a la ilustración que el del taller: cabeza grande, ojos, gorra y brazos que se
 * mueven). Los brazos son grupos para animarlos desde afuera (`brazos`).
 */
function Muneco({
  piel = 0,
  ropa = C.lima,
  delantal = true,
  gorra = true,
  casco = false,
  pelo = false,
  brazoIzq,
  brazoDer,
  sentado = false,
  manejando = false,
}: {
  piel?: number;
  ropa?: string;
  delantal?: boolean;
  gorra?: boolean;
  casco?: boolean;
  pelo?: boolean;
  brazoIzq?: React.RefObject<THREE.Group | null>;
  brazoDer?: React.RefObject<THREE.Group | null>;
  sentado?: boolean;
  /** Los brazos hacia adelante, al manubrio */
  manejando?: boolean;
}) {
  const colorPiel = C.piel[piel % C.piel.length];
  return (
    <group>
      {/* Piernas */}
      {!sentado ? (
        <>
          <Pieza geo={capsula(0.1, 0.32)} color={C.bosque} p={[-0.12, 0.26, 0]} />
          <Pieza geo={capsula(0.1, 0.32)} color={C.bosque} p={[0.12, 0.26, 0]} />
        </>
      ) : (
        <>
          <Pieza geo={capsula(0.1, 0.36)} color={C.bosque} p={[-0.12, 0.5, 0.2]} r={[Math.PI / 2, 0, 0]} />
          <Pieza geo={capsula(0.1, 0.36)} color={C.bosque} p={[0.12, 0.5, 0.2]} r={[Math.PI / 2, 0, 0]} />
        </>
      )}
      {/* Cuerpo */}
      <Pieza geo={capsula(0.27, 0.38)} color={ropa} p={[0, 0.82, 0]} />
      {delantal && <Pieza geo={caja(0.4, 0.5, 0.06, 0.03)} color={C.bosque} p={[0, 0.74, 0.25]} />}
      {/* Brazos */}
      <group ref={brazoIzq} position={[-0.32, 1.0, 0]} rotation={manejando ? [-1.25, 0, 0.15] : undefined}>
        <Pieza geo={capsula(0.08, 0.3)} color={ropa} p={[0, -0.18, 0]} />
        <Pieza geo={esfera(0.09)} color={colorPiel} p={[0, -0.4, 0]} />
      </group>
      <group ref={brazoDer} position={[0.32, 1.0, 0]} rotation={manejando ? [-1.25, 0, -0.15] : undefined}>
        <Pieza geo={capsula(0.08, 0.3)} color={ropa} p={[0, -0.18, 0]} />
        <Pieza geo={esfera(0.09)} color={colorPiel} p={[0, -0.4, 0]} />
      </group>
      {/* Cabeza */}
      <Pieza geo={esfera(0.3)} color={colorPiel} p={[0, 1.42, 0]} />
      <Pieza geo={esfera(0.045)} color={C.ojo} p={[-0.1, 1.46, 0.27]} sombra={false} />
      <Pieza geo={esfera(0.045)} color={C.ojo} p={[0.1, 1.46, 0.27]} sombra={false} />
      <Pieza geo={esfera(0.06)} color={colorPiel} p={[0, 1.38, 0.29]} sombra={false} />
      {pelo && (
        <>
          <Pieza geo={esfera(0.32, true)} color={C.pelo} p={[0, 1.44, -0.03]} />
          <Pieza geo={esfera(0.33)} color={C.pelo} p={[0, 1.4, -0.08]} s={[1, 0.95, 0.9]} />
          <Pieza geo={capsula(0.1, 0.22)} color={C.pelo} p={[0, 1.2, -0.32]} r={[0.35, 0, 0]} />
        </>
      )}
      {gorra && !casco && (
        <>
          <Pieza geo={esfera(0.31, true)} color={C.bosque} p={[0, 1.5, 0]} />
          {/* La visera sale hacia adelante, por encima de los ojos */}
          <Pieza geo={caja(0.4, 0.035, 0.24, 0.015)} color={C.lima} p={[0, 1.54, 0.33]} r={[-0.12, 0, 0]} />
          <Pieza geo={esfera(0.05)} color={C.lima} p={[0, 1.8, 0]} sombra={false} />
        </>
      )}
      {casco && (
        <>
          <Pieza geo={esfera(0.36, true)} color={C.bosque} p={[0, 1.44, 0]} />
          <Pieza geo={caja(0.5, 0.06, 0.06, 0.02)} color={C.lima} p={[0, 1.5, 0.3]} />
        </>
      )}
    </group>
  );
}

/** El visto que salta: un círculo lima con su check */
function Visto({ g }: { g: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={g}>
      <Pieza geo={cilindro(0.26, 0.08, 24)} material={mate(C.lima, { brillo: C.lima, intensidad: 0.25 })} r={[Math.PI / 2, 0, 0]} />
      <Pieza geo={caja(0.09, 0.2, 0.05, 0.02)} color={C.bosque} p={[-0.06, -0.03, 0.06]} r={[0, 0, 0.75]} sombra={false} />
      <Pieza geo={caja(0.09, 0.34, 0.05, 0.02)} color={C.bosque} p={[0.07, 0.03, 0.06]} r={[0, 0, -0.65]} sombra={false} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// El vendedor revisa
// ---------------------------------------------------------------------------------------------------------------------
function Revisa() {
  const brazo = useRef<THREE.Group>(null);
  const otro = useRef<THREE.Group>(null);
  const cuerpo = useRef<THREE.Group>(null);
  const visto = useRef<THREE.Group>(null);
  const lapiz = useRef<THREE.Group>(null);
  useCuadro((t) => {
    // Mira la lista, escribe (el brazo va y viene) y cada tanto levanta la cabeza
    if (cuerpo.current) cuerpo.current.rotation.x = 0.06 + Math.sin(t * 0.9) * 0.05;
    if (brazo.current) brazo.current.rotation.x = -1.25 + Math.sin(t * 9) * 0.1;
    if (brazo.current) brazo.current.rotation.z = 0.25 + Math.sin(t * 4.5) * 0.08;
    if (otro.current) otro.current.rotation.x = -1.2;
    if (lapiz.current) lapiz.current.position.x = 0.08 + Math.sin(t * 9) * 0.05;
    // El visto sale de la lista, sube, gira y desaparece (cada 1,6 s)
    const f = (t % 1.6) / 1.6;
    if (visto.current) {
      visto.current.position.set(-0.75, 1.75 + f * 0.5, 1.05);
      const e = f < 0.15 ? f / 0.15 : f > 0.8 ? (1 - f) / 0.2 : 1;
      visto.current.scale.setScalar(Math.max(0.001, e * 1.1));
      visto.current.rotation.y = f * Math.PI * 2;
    }
  });
  return (
    <group>
      <Isla />
      <Estante p={[-1.6, 0, -0.9]} />
      <Estante p={[1.7, 0, -0.9]} ancho={2} />
      {/* El vendedor detrás del mostrador, grande y de frente */}
      <group ref={cuerpo} position={[0.15, 0, 0.15]} scale={1.3}>
        <Muneco piel={0} ropa={C.lima} brazoDer={brazo} brazoIzq={otro} />
        {/* La tablilla con la lista, a la altura del pecho, inclinada hacia él */}
        <group position={[0, 0.92, 0.42]} rotation={[-1.15, 0, 0]}>
          <Pieza geo={caja(0.44, 0.56, 0.04, 0.03)} color={C.bosque} />
          <Pieza geo={caja(0.36, 0.46, 0.02, 0.01)} color={C.blanco} p={[0, -0.02, 0.025]} sombra={false} />
          {[0.12, 0.0, -0.12].map((y) => (
            <group key={y}>
              <Pieza geo={caja(0.07, 0.07, 0.02, 0.01)} color={C.limaFuerte} p={[-0.11, y, 0.04]} sombra={false} />
              <Pieza geo={caja(0.18, 0.03, 0.01, 0.005)} color="#C9CFC6" p={[0.05, y, 0.04]} sombra={false} />
            </group>
          ))}
          <group ref={lapiz} position={[0.08, -0.05, 0.08]} rotation={[0, 0, 0.6]}>
            <Pieza geo={cilindro(0.02, 0.26, 8)} color={C.ambar} sombra={false} />
          </group>
        </group>
      </group>
      {/* El mostrador, bajo: se le ve medio cuerpo */}
      <Pieza geo={caja(2.6, 0.62, 0.62, 0.08)} color={C.bosque} p={[0.15, 0.31, 0.95]} />
      <Pieza geo={caja(2.75, 0.09, 0.74, 0.05)} color={C.lima} p={[0.15, 0.66, 0.95]} />
      <Carton p={[-0.85, 0.7, 0.92]} />
      <Carton p={[-0.85, 1.02, 0.94]} s={0.85} r={[0, 0.3, 0]} />
      <Bolsa p={[1.15, 0.7, 0.95]} />
      <Botella p={[1.45, 0.7, 1.0]} />
      <Visto g={visto} />
      <Maceta p={[-3.15, 0, 1.0]} />
      <Maceta p={[3.1, 0, 1.0]} escala={0.85} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// En preparación: la cinta trae cajas y productos que caen en la caja grande
// ---------------------------------------------------------------------------------------------------------------------
/** Lo que viaja por la cinta y al final salta dentro de la caja grande. Cada uno con su desfase */
function EnLaCinta({ fase, children }: { fase: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useCuadro((t) => {
    if (!g.current) return;
    const f = (t * 0.2 + fase) % 1;
    if (f < 0.72) {
      // Por la cinta, de izquierda a derecha
      const k = f / 0.72;
      g.current.position.set(-2.95 + k * 3.0, 0.88, -0.05);
      g.current.rotation.set(0, 0, 0);
      g.current.scale.setScalar(k < 0.06 ? Math.max(0.001, k / 0.06) : 1);
    } else {
      // Salta a la caja: sube un poco, gira y entra
      const k = (f - 0.72) / 0.28;
      g.current.position.set(0.05 + k * 0.75, 0.88 + Math.sin(k * Math.PI) * 0.55 - k * 0.25, -0.05 + k * 0.75);
      g.current.rotation.set(k * 1.2, 0, -k * 2.4);
      g.current.scale.setScalar(k > 0.8 ? Math.max(0.001, (1 - k) / 0.2) : 1);
    }
  });
  return <group ref={g}>{children}</group>;
}

function Prepara() {
  const rodillos = useRef<THREE.Group>(null);
  const izq = useRef<THREE.Group>(null);
  const der = useRef<THREE.Group>(null);
  const cuerpo = useRef<THREE.Group>(null);
  const tapa = useRef<THREE.Group>(null);
  useCuadro((t) => {
    rodillos.current?.children.forEach((r) => (r.rotation.y = -t * 5));
    // Acomoda lo que cae: los brazos bajan a la caja y suben
    const em = Math.sin(t * 3.2);
    if (izq.current) izq.current.rotation.x = -1.0 + em * 0.35;
    if (der.current) der.current.rotation.x = -1.0 - em * 0.35;
    if (cuerpo.current) cuerpo.current.rotation.x = 0.2 + Math.sin(t * 1.6) * 0.05;
    // Las solapas de la caja se mueven un poquito, como si la tocaran
    if (tapa.current) tapa.current.rotation.z = Math.sin(t * 3.2) * 0.06;
  });
  return (
    <group>
      <Isla />
      <Estante p={[-1.9, 0, -1.05]} ancho={2.4} />
      <Estante p={[2.0, 0, -1.05]} ancho={1.9} />
      {/* La cinta, de la izquierda hasta la caja */}
      <Pieza geo={caja(3.3, 0.1, 0.62, 0.05)} color={C.calle} p={[-1.45, 0.8, -0.05]} />
      <Pieza geo={caja(3.32, 0.05, 0.08, 0.02)} color={C.lima} p={[-1.45, 0.86, 0.27]} sombra={false} />
      <Pieza geo={caja(3.32, 0.05, 0.08, 0.02)} color={C.lima} p={[-1.45, 0.86, -0.37]} sombra={false} />
      <group ref={rodillos}>
        {[-2.9, -2.3, -1.7, -1.1, -0.5, 0.1].map((x) => (
          <group key={x} position={[x, 0.86, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <Pieza geo={cilindro(0.05, 0.6, 10)} color="#AEB6BE" sombra={false} />
          </group>
        ))}
      </group>
      {[-3.0, 0.15].map((x) => (
        <Pieza key={x} geo={caja(0.12, 0.76, 0.5, 0.03)} color={C.bosque} p={[x, 0.38, -0.05]} />
      ))}
      <EnLaCinta fase={0}>
        <Carton p={[0, 0, 0]} s={0.75} />
      </EnLaCinta>
      <EnLaCinta fase={0.25}>
        <Bolsa p={[0, -0.05, 0]} s={0.85} />
      </EnLaCinta>
      <EnLaCinta fase={0.5}>
        <Botella p={[0, 0, 0]} />
      </EnLaCinta>
      <EnLaCinta fase={0.75}>
        <Botella p={[0, 0, 0]} color={C.gaseosa[0]} />
      </EnLaCinta>
      {/* Tu caja, al final de la cinta */}
      <group position={[0.85, 0, 0.75]}>
        <Pieza geo={caja(1.0, 0.7, 0.75, 0.04)} color={C.kraft} p={[0, 0.35, 0]} />
        <Pieza geo={caja(0.9, 0.05, 0.65, 0.01)} color={C.kraftOscuro} p={[0, 0.69, 0]} sombra={false} />
        <group ref={tapa}>
          <Pieza geo={caja(0.04, 0.42, 0.72, 0.01)} color={C.kraft} p={[-0.62, 0.82, 0]} r={[0, 0, 0.55]} />
          <Pieza geo={caja(0.04, 0.42, 0.72, 0.01)} color={C.kraft} p={[0.62, 0.82, 0]} r={[0, 0, -0.55]} />
        </group>
        <Pieza geo={caja(0.5, 0.02, 0.06, 0.01)} color={C.lima} p={[0, 0.35, 0.38]} sombra={false} />
      </group>
      {/* La chica, al costado de la caja, mirando hacia ella */}
      <group ref={cuerpo} position={[1.95, 0, 0.6]} rotation={[0, -0.75, 0]} scale={1.25}>
        <Muneco piel={1} ropa={C.bosqueClaro} delantal={false} pelo brazoIzq={izq} brazoDer={der} />
      </group>
      <Carton p={[2.7, 0, 1.0]} s={1.1} r={[0, 0.4, 0]} />
      <Carton p={[2.7, 0.36, 1.0]} s={0.9} r={[0, 0.1, 0]} />
      <Maceta p={[-3.2, 0, 1.05]} escala={0.9} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// En camino: la moto recorre el barrio
// ---------------------------------------------------------------------------------------------------------------------
const LARGO_BARRIO = 22;
const CASAS = [
  { x: 0, color: C.crema, alto: 1.3, ancho: 1.6 },
  { x: 2.6, color: '#F3D9B1', alto: 1.0, ancho: 1.4 },
  { x: 5.2, color: '#E8F5D0', alto: 1.5, ancho: 1.7 },
  { x: 8.4, color: '#F6E0CF', alto: 1.15, ancho: 1.5 },
  { x: 11.6, color: C.crema, alto: 1.4, ancho: 1.9 },
  { x: 15.0, color: '#E9F2DA', alto: 1.0, ancho: 1.3 },
  { x: 18.0, color: '#F3D9B1', alto: 1.35, ancho: 1.6 },
];
const ARBOLES = [1.3, 4.0, 7.0, 10.1, 13.4, 16.6, 19.8];

function EnCamino() {
  const barrio = useRef<THREE.Group>(null);
  const rayas = useRef<THREE.Group>(null);
  const moto = useRef<THREE.Group>(null);
  const ruedas = useRef<(THREE.Group | null)[]>([]);
  const humo = useRef<(THREE.Mesh | null)[]>([]);
  useCuadro((t) => {
    const v = 2.4;
    // Todo lo del barrio pasa de derecha a izquierda (la moto va a la derecha) y vuelve a entrar por la derecha
    barrio.current?.children.forEach((g) => {
      const x0 = (g.userData.x0 as number) ?? 0;
      g.position.x = ((((x0 - t * v) % LARGO_BARRIO) + LARGO_BARRIO) % LARGO_BARRIO) - LARGO_BARRIO / 2;
    });
    rayas.current?.children.forEach((g, i) => {
      g.position.x = ((((i * 1.2 - t * v) % 14.4) + 14.4) % 14.4) - 7.2;
    });
    if (moto.current) {
      moto.current.position.y = Math.abs(Math.sin(t * 9)) * 0.035;
      moto.current.rotation.z = Math.sin(t * 2.2) * 0.025;
    }
    ruedas.current.forEach((r) => r && (r.rotation.z = -t * 9));
    humo.current.forEach((m, i) => {
      if (!m) return;
      const f = (t * 1.1 + i / 3) % 1;
      m.position.set(-1.05 - f * 0.9, 0.32 + f * 0.25, 0.65);
      m.scale.setScalar(0.4 + f * 1.1);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - f);
    });
  });
  return (
    <group>
      {/* La calle, las veredas y el pasto */}
      <Pieza geo={caja(16, 0.1, 1.5, 0.02)} color={C.calle} p={[0, -0.05, 0.7]} />
      <Pieza geo={caja(16, 0.14, 0.6, 0.03)} color={C.vereda} p={[0, -0.03, -0.35]} />
      <Pieza geo={caja(16, 0.14, 0.5, 0.03)} color={C.vereda} p={[0, -0.03, 1.7]} />
      <Pieza geo={caja(16, 0.1, 2.2, 0.03)} color={C.pasto} p={[0, -0.07, -1.7]} />
      <Pieza geo={caja(16, 0.1, 1.2, 0.03)} color={C.pastoOscuro} p={[0, -0.07, 2.5]} />
      <group ref={rayas}>
        {Array.from({ length: 12 }, (_, i) => (
          <Pieza key={i} geo={caja(0.55, 0.02, 0.07, 0.01)} color={C.lima} p={[0, 0.01, 0.7]} sombra={false} />
        ))}
      </group>
      {/* El barrio que pasa */}
      <group ref={barrio}>
        {CASAS.map((c) => (
          <group key={c.x} userData={{ x0: c.x }} position={[c.x, 0, -1.6]}>
            <Pieza geo={caja(c.ancho, c.alto, 1.1, 0.06)} color={c.color} p={[0, c.alto / 2, 0]} />
            <Pieza geo={techo(c.ancho * 0.78, 0.6)} color={C.teja} p={[0, c.alto + 0.3, 0]} s={[1, 1, 0.75]} />
            <Pieza geo={caja(0.32, 0.55, 0.04, 0.02)} color={C.bosque} p={[0, 0.28, 0.56]} />
            <Pieza geo={caja(0.32, 0.3, 0.04, 0.02)} color={C.vidrio} p={[-c.ancho * 0.28, c.alto * 0.62, 0.56]} />
            <Pieza geo={caja(0.32, 0.3, 0.04, 0.02)} color={C.vidrio} p={[c.ancho * 0.28, c.alto * 0.62, 0.56]} />
          </group>
        ))}
        {ARBOLES.map((x, i) => (
          <group key={x} userData={{ x0: x }} position={[x, 0, -0.55]}>
            <Arbol p={[0, 0, 0]} escala={0.75 + (i % 3) * 0.12} color={C.copas[i % 4]} fase={i} />
          </group>
        ))}
        {[3.3, 9.5, 17.2].map((x) => (
          <group key={`f${x}`} userData={{ x0: x }} position={[x, 0, 1.75]}>
            <Pieza geo={cilindro(0.04, 1.4, 8)} color={C.bosque} p={[0, 0.7, 0]} />
            <Pieza geo={esfera(0.12)} material={mate('#FFF3C4', { brillo: '#FFE38A', intensidad: 0.6 })} p={[0, 1.45, 0]} />
          </group>
        ))}
      </group>
      {/* La moto con el repartidor */}
      <group ref={moto} position={[0, 0, 0.65]}>
        <Moto ruedas={ruedas} />
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (humo.current[i] = m)} geometry={esfera(0.12)} material={new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.6, roughness: 1 })} />
      ))}
    </group>
  );
}

function Moto({ ruedas }: { ruedas: React.RefObject<(THREE.Group | null)[]> }) {
  return (
    <group rotation={[0, 0, 0]}>
      {/* Ruedas */}
      {[-0.62, 0.68].map((x, i) => (
        <group key={x} position={[x, 0.27, 0]} ref={(g) => void (ruedas.current[i] = g)}>
          <Pieza geo={aro(0.2, 0.08)} color={C.rueda} />
          <Pieza geo={cilindro(0.1, 0.12, 12)} color="#D3D9E0" r={[Math.PI / 2, 0, 0]} />
          <Pieza geo={caja(0.32, 0.04, 0.04, 0.01)} color="#9AA4AE" sombra={false} />
        </group>
      ))}
      {/* Cuerpo del scooter */}
      <Pieza geo={caja(1.1, 0.22, 0.42, 0.1)} color={C.lima} p={[0, 0.42, 0]} />
      <Pieza geo={caja(0.5, 0.42, 0.46, 0.16)} color={C.lima} p={[-0.42, 0.6, 0]} />
      <Pieza geo={caja(0.22, 0.75, 0.4, 0.1)} color={C.lima} p={[0.62, 0.72, 0]} r={[0, 0, -0.25]} />
      <Pieza geo={caja(0.62, 0.1, 0.36, 0.05)} color="#3B2A20" p={[-0.3, 0.86, 0]} />
      <Pieza geo={cilindro(0.025, 0.6, 8)} color={C.bosque} p={[0.78, 1.12, 0]} r={[Math.PI / 2, 0, 0]} />
      <Pieza geo={esfera(0.08)} material={mate('#FFF8D6', { brillo: '#FFF1A8', intensidad: 0.8 })} p={[0.86, 0.98, 0]} />
      {/* La caja de reparto */}
      <Pieza geo={caja(0.62, 0.55, 0.58, 0.07)} color={C.bosque} p={[-0.78, 1.12, 0]} />
      <Pieza geo={caja(0.64, 0.06, 0.6, 0.02)} color={C.lima} p={[-0.78, 1.2, 0]} sombra={false} />
      {/* El repartidor */}
      <group position={[-0.15, 0.4, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Muneco piel={1} ropa={C.bosqueClaro} delantal={false} gorra={false} casco sentado manejando />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Por pagar: el celular con el QR y las monedas
// ---------------------------------------------------------------------------------------------------------------------
function qr(n = 11) {
  const celdas: [number, number][] = [];
  let s = 7;
  const azar = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const esquina = (x: number, y: number) => (x < 3 && y < 3) || (x > n - 4 && y < 3) || (x < 3 && y > n - 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!esquina(x, y) && azar() > 0.52) celdas.push([x, y]);
  return celdas;
}
const CELDAS = qr();

function Pagar() {
  const cel = useRef<THREE.Group>(null);
  const monedas = useRef<(THREE.Group | null)[]>([]);
  const onda = useRef<THREE.Mesh>(null);
  const brazo = useRef<THREE.Group>(null);
  const otro = useRef<THREE.Group>(null);
  useCuadro((t) => {
    // Levanta el celular para que se escanee: se mueve un poquito, como en la mano
    if (cel.current) {
      cel.current.rotation.y = -0.25 + Math.sin(t * 0.9) * 0.15;
      cel.current.position.y = 1.55 + Math.sin(t * 1.6) * 0.05;
    }
    if (brazo.current) brazo.current.rotation.set(-1.5 + Math.sin(t * 1.6) * 0.05, 0, -0.35);
    if (otro.current) otro.current.rotation.z = -0.15 + Math.sin(t * 2) * 0.05;
    monedas.current.forEach((m, i) => {
      if (!m) return;
      const a = t * 1.1 + (i / 5) * Math.PI * 2;
      m.position.set(1.05 + Math.cos(a) * 0.62, 1.5 + Math.sin(t * 1.4 + i) * 0.4, 1.0 + Math.sin(a) * 0.35);
      m.rotation.y = t * 3 + i;
    });
    if (onda.current) {
      const f = (t * 0.6) % 1;
      onda.current.scale.setScalar(0.6 + f * 1.6);
      (onda.current.material as THREE.MeshStandardMaterial).opacity = 0.75 * (1 - f);
    }
  });
  const lado = 0.075;
  return (
    <group>
      <Isla />
      <Estante p={[-1.9, 0, -1.0]} ancho={2.3} />
      <Estante p={[2.1, 0, -1.0]} ancho={1.8} />
      {/* El mostrador de su tienda, a un costado, con la caja registradora */}
      <Pieza geo={caja(1.6, 0.62, 0.6, 0.08)} color={C.bosque} p={[-1.7, 0.31, 0.75]} />
      <Pieza geo={caja(1.7, 0.08, 0.7, 0.04)} color={C.lima} p={[-1.7, 0.66, 0.75]} />
      <Pieza geo={caja(0.5, 0.32, 0.4, 0.06)} color="#E9E4D6" p={[-1.95, 0.86, 0.72]} r={[0, 0.3, 0]} />
      <Pieza geo={caja(0.36, 0.1, 0.06, 0.02)} material={mate(C.pantalla, { brillo: C.lima, intensidad: 0.3 })} p={[-1.93, 1.0, 0.92]} r={[0, 0.3, 0]} sombra={false} />
      <Botella p={[-1.2, 0.7, 0.8]} />
      {/* El aro que late en el piso, alrededor de ella */}
      <mesh ref={onda} geometry={aro(0.9, 0.04)} rotation={[Math.PI / 2, 0, 0]} position={[0.3, 0.03, 0.55]} material={new THREE.MeshStandardMaterial({ color: C.ambar, transparent: true, opacity: 0.6 })} />
      {/* La dueña levanta el celular */}
      <group position={[0.3, 0, 0.55]} rotation={[0, -0.2, 0]} scale={1.25}>
        <Muneco piel={0} ropa={C.lima} pelo gorra={false} brazoDer={brazo} brazoIzq={otro} />
      </group>
      <group ref={cel} position={[0.95, 1.55, 1.0]}>
        <Pieza geo={caja(0.62, 1.15, 0.09, 0.09)} color="#8B5E3C" />
        <Pieza geo={caja(0.54, 1.0, 0.02, 0.04)} material={mate(C.pantalla, { brillo: C.pantalla, intensidad: 0.35 })} p={[0, 0, 0.05]} sombra={false} />
        {/* El QR: las tres esquinas y las celdas */}
        <group position={[-0.245, 0.245, 0.062]} scale={0.6}>
          {[
            [0, 0],
            [8, 0],
            [0, 8],
          ].map(([x, y]) => (
            <group key={`${x}-${y}`} position={[(x + 1) * lado, -(y + 1) * lado, 0]}>
              <Pieza geo={caja(lado * 3, lado * 3, 0.012, 0.005)} color={C.bosque} sombra={false} />
              <Pieza geo={caja(lado * 2, lado * 2, 0.014, 0.004)} color={C.pantalla} p={[0, 0, 0.002]} sombra={false} />
              <Pieza geo={caja(lado, lado, 0.016, 0.003)} color={C.bosque} p={[0, 0, 0.004]} sombra={false} />
            </group>
          ))}
          {CELDAS.map(([x, y]) => (
            <Pieza key={`${x}:${y}`} geo={caja(lado, lado, 0.012, 0.003)} color={C.bosque} p={[x * lado, -y * lado, 0]} sombra={false} />
          ))}
        </group>
      </group>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} ref={(g) => void (monedas.current[i] = g)}>
          <Pieza geo={cilindro(0.15, 0.05, 24)} material={mate(C.oro, { metal: 0.55, rugosidad: 0.3 })} r={[Math.PI / 2, 0, 0]} />
          <Pieza geo={cilindro(0.1, 0.06, 20)} material={mate('#FFD36B', { metal: 0.5, rugosidad: 0.3 })} r={[Math.PI / 2, 0, 0]} sombra={false} />
        </group>
      ))}
      <Maceta p={[3.2, 0, 1.05]} escala={0.9} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Entregado: el repartidor le da la caja a la dueña en la puerta de su tienda
// ---------------------------------------------------------------------------------------------------------------------
const PAPELITOS = Array.from({ length: 22 }, (_, i) => ({ x: ((i * 37) % 70) / 10 - 3.5, z: ((i * 13) % 20) / 10 - 0.6, fase: (i * 0.29) % 1, color: [C.lima, C.ambar, C.blanco, C.bosque][i % 4] }));

function Entregado() {
  const duena = useRef<THREE.Group>(null);
  const brazoDuena = useRef<THREE.Group>(null);
  const otroDuena = useRef<THREE.Group>(null);
  const brazoRep = useRef<THREE.Group>(null);
  const otroRep = useRef<THREE.Group>(null);
  const papeles = useRef<(THREE.Mesh | null)[]>([]);
  useCuadro((t) => {
    // La dueña salta de contenta con los brazos arriba; el repartidor saluda
    if (duena.current) duena.current.position.y = Math.abs(Math.sin(t * 3.4)) * 0.18;
    // Los dos brazos arriba (el derecho gira hacia +x, el izquierdo hacia −x)
    if (brazoDuena.current) brazoDuena.current.rotation.z = 2.5 + Math.sin(t * 6.8) * 0.2;
    if (otroDuena.current) otroDuena.current.rotation.z = -2.5 - Math.sin(t * 6.8) * 0.2;
    if (brazoRep.current) brazoRep.current.rotation.z = 2.5 + Math.sin(t * 5) * 0.35;
    if (otroRep.current) otroRep.current.rotation.x = -1.2;
    papeles.current.forEach((m, i) => {
      if (!m) return;
      const p = PAPELITOS[i];
      const f = (t * 0.32 + p.fase) % 1;
      m.position.set(p.x + Math.sin(t * 2 + i) * 0.15, 3.4 - f * 3.4, p.z);
      m.rotation.set(t * 3 + i, t * 2 + i, 0);
    });
  });
  return (
    <group>
      <Isla />
      {/* La tienda: paredes, toldo a rayas y puerta */}
      <group position={[-1.3, 0, -0.8]}>
        <Pieza geo={caja(3.2, 2.1, 1.0, 0.08)} color={C.crema} p={[0, 1.05, 0]} />
        <Pieza geo={caja(3.4, 0.16, 1.2, 0.05)} color={C.teja} p={[0, 2.18, 0]} />
        {Array.from({ length: 8 }, (_, i) => (
          <Pieza key={i} geo={caja(0.42, 0.06, 0.8, 0.02)} color={i % 2 ? C.blanco : C.lima} p={[-1.47 + i * 0.42, 1.75, 0.82]} r={[0.45, 0, 0]} />
        ))}
        <Pieza geo={caja(0.9, 1.35, 0.06, 0.03)} color={C.bosque} p={[0.6, 0.68, 0.51]} />
        <Pieza geo={caja(1.1, 0.75, 0.05, 0.03)} color={C.vidrio} p={[-0.75, 1.0, 0.51]} />
        <Carton p={[-0.75, 0, 0.75]} />
        <Carton p={[-0.35, 0, 0.8]} s={0.85} r={[0, 0.4, 0]} />
        <Bolsa p={[-1.2, 0, 0.75]} />
      </group>
      {/* La dueña, contenta, con su caja */}
      <group ref={duena} position={[0.55, 0, 0.55]}>
        <Muneco piel={0} ropa={C.lima} pelo gorra={false} brazoIzq={otroDuena} brazoDer={brazoDuena} />
      </group>
      <Carton p={[0.95, 0, 0.95]} s={1.2} />
      {/* El repartidor y su moto */}
      <group position={[2.0, 0, 0.45]} rotation={[0, -0.35, 0]}>
        <Muneco piel={1} ropa={C.bosqueClaro} delantal={false} brazoDer={brazoRep} brazoIzq={otroRep} />
      </group>
      <group position={[2.6, 0, -0.6]} rotation={[0, -0.5, 0]} scale={0.8}>
        <MotoQuieta />
      </group>
      <Maceta p={[-3.25, 0, 1.0]} />
      {PAPELITOS.map((p, i) => (
        <mesh key={i} ref={(m) => void (papeles.current[i] = m)} geometry={caja(0.08, 0.13, 0.01, 0.002)} material={mate(p.color)} />
      ))}
    </group>
  );
}

function MotoQuieta() {
  return (
    <group>
      {[-0.62, 0.68].map((x) => (
        <group key={x} position={[x, 0.27, 0]}>
          <Pieza geo={aro(0.2, 0.08)} color={C.rueda} />
        </group>
      ))}
      <Pieza geo={caja(1.1, 0.22, 0.42, 0.1)} color={C.lima} p={[0, 0.42, 0]} />
      <Pieza geo={caja(0.5, 0.42, 0.46, 0.16)} color={C.lima} p={[-0.42, 0.6, 0]} />
      <Pieza geo={caja(0.22, 0.75, 0.4, 0.1)} color={C.lima} p={[0.62, 0.72, 0]} r={[0, 0, -0.25]} />
      <Pieza geo={caja(0.62, 0.55, 0.58, 0.07)} color={C.bosque} p={[-0.78, 1.12, 0]} />
    </group>
  );
}

/** Para envolver en las pruebas o en otro lienzo */
export function ConMovimiento({ children, moverse }: { children: ReactNode; moverse: boolean }) {
  return <Moverse.Provider value={moverse}>{children}</Moverse.Provider>;
}
