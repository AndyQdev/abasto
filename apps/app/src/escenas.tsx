/**
 * Las escenas animadas de cada estado de la compra (02/11, pedido de Andrés: «que según el estado se vea un dibujo 3D
 * moviéndose, como el chico en su moto yendo»). Cada escena es una ilustración 3D recortada sobre un fondo que se mueve
 * en bucle, hecho en código:
 * - por pagar: el celular con el QR flota y late un aro ámbar;
 * - el vendedor revisa: se balancea mientras se marcan los productos de su lista;
 * - en preparación: empaca la caja; los productos caen y brillan;
 * - en camino: la moto rebota, la calle y la ciudad pasan detrás y sale humito;
 * - entregado: festejan y cae confeti.
 * Pesan poco (una WebP de ~30 KB cada una), andan sin señal y respetan «reducir movimiento» del teléfono.
 */
import { porPagar, type Pedido } from "@abasto/comercio";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { requireOptionalNativeModule } from "expo";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Icono } from "./componentes";
import { ILUSTRACION } from "./ilustraciones";
import { COLOR } from "./tema";

export type ClaveDeEscena =
  "pagar" | "revisa" | "prepara" | "camino" | "entregado";

/** Qué escena va con cada estado. Rechazado o cancelado no tienen: ahí manda lo que se deshizo */
export function escenaDelPedido(
  p: Pick<Pedido, "estado" | "metodoPago" | "cobro" | "total">,
): ClaveDeEscena | null {
  switch (p.estado) {
    case "PENDIENTE":
      return porPagar(p) ? "pagar" : "revisa";
    case "POR_CONFIRMAR":
      return "revisa";
    case "CONFIRMADO":
    case "EN_PREPARACION":
      return "prepara";
    case "DESPACHADO":
      return "camino";
    case "ENTREGADO":
      return "entregado";
    default:
      return null;
  }
}

const FONDO: Record<ClaveDeEscena, [string, string]> = {
  pagar: ["#FFF7E8", "#FFE0A8"],
  revisa: ["#F6FBEA", "#DDF59B"],
  prepara: ["#FBF6EA", "#EBDDB9"],
  camino: ["#F7FCEB", "#D6F08C"],
  entregado: ["#F1FAD9", "#C9F45A"],
};

const DESCRIPCION: Record<ClaveDeEscena, string> = {
  pagar: "Un celular con el QR para pagar",
  revisa: "El vendedor revisa tu lista",
  prepara: "Empacan tu pedido en una caja",
  camino: "El repartidor va en su moto con tu pedido",
  entregado: "Tu pedido llegó",
};

/**
 * El 3D (three.js sobre expo-gl, `escenas-3d.tsx`) se carga solo si el teléfono lo tiene: en la app de desarrollo vieja,
 * en la web y en las pruebas queda la escena ilustrada de abajo.
 */
type Modulo3D = typeof import("./escenas-3d");
let modulo3D: Modulo3D | null | undefined;
function escena3D(): Modulo3D | null {
  if (modulo3D !== undefined) return modulo3D;
  if (Platform.OS === "web" || !requireOptionalNativeModule("ExpoGL"))
    return (modulo3D = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo3D = require("./escenas-3d") as Modulo3D;
  } catch {
    modulo3D = null;
  }
  return modulo3D;
}

/** «Reducir movimiento» del teléfono: entonces la escena queda quieta */
function useSinMovimiento() {
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => vivo && setQuieto(!!v))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return quieto;
}

/** Un reloj 0 → 1 que se repite: de él salen todos los movimientos de la escena */
function useBucle(ms: number, quieto: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (quieto) return undefined;
    const a = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: ms,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    a.start();
    return () => a.stop();
  }, [v, ms, quieto]);
  return v;
}

/** Va y vuelve suave, como una onda (para flotar, balancearse o rebotar) */
const PUNTOS = Array.from({ length: 9 }, (_, i) => i / 8);
const onda = (v: Animated.Value, desde: number, hasta: number) =>
  v.interpolate({
    inputRange: PUNTOS,
    outputRange: PUNTOS.map(
      (t) => desde + ((hasta - desde) * (1 - Math.cos(2 * Math.PI * t))) / 2,
    ),
  });
const ondaEnGrados = (v: Animated.Value, desde: number, hasta: number) =>
  v.interpolate({
    inputRange: PUNTOS,
    outputRange: PUNTOS.map(
      (t) =>
        `${desde + ((hasta - desde) * (1 - Math.cos(2 * Math.PI * t))) / 2}deg`,
    ),
  });

/**
 * `margenArriba` y `margenAbajo`: lo que tapa otra cosa (la barra de estado y la tarjeta que sube en el seguimiento).
 * El dibujo se acomoda en lo que queda; el fondo cubre todo.
 */
export function Escena({
  clave,
  alto = 140,
  margenArriba = 0,
  margenAbajo = 0,
  redondeo = 0,
  style,
  children,
}: {
  clave: ClaveDeEscena;
  alto?: number;
  margenArriba?: number;
  margenAbajo?: number;
  redondeo?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const quieto = useSinMovimiento();
  const dibujo = alto - margenArriba - margenAbajo;
  const tres = escena3D();
  return (
    <View
      style={[
        { height: alto, borderRadius: redondeo, overflow: "hidden" },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={DESCRIPCION[clave]}
    >
      <LinearGradient
        colors={FONDO[clave]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Sol
        quieto={quieto}
        color={
          clave === "pagar" ? "rgba(255,180,84,0.35)" : "rgba(255,255,255,0.7)"
        }
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: tres ? Math.max(0, margenArriba - 24) : margenArriba,
          height: tres ? dibujo + 24 : dibujo,
        }}
      >
        {tres ? (
          <tres.Escena3D clave={clave} quieto={quieto} />
        ) : (
          <>
            {clave === "camino" && <EnCamino alto={dibujo} quieto={quieto} />}
            {clave === "revisa" && <Revisa alto={dibujo} quieto={quieto} />}
            {clave === "prepara" && <Prepara alto={dibujo} quieto={quieto} />}
            {clave === "pagar" && <Pagar alto={dibujo} quieto={quieto} />}
            {clave === "entregado" && (
              <Entregado alto={dibujo} quieto={quieto} />
            )}
          </>
        )}
      </View>
      {children}
    </View>
  );
}

function Sol({ quieto, color }: { quieto: boolean; color: string }) {
  const v = useBucle(4000, quieto);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        e.sol,
        {
          backgroundColor: color,
          transform: [
            {
              scale: v.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.12, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// En camino: la ciudad y la calle pasan; la moto rebota y deja humito
// ---------------------------------------------------------------------------------------------------------------------
const EDIFICIOS = [
  { ancho: 46, alto: 0.42 },
  { ancho: 30, alto: 0.6 },
  { ancho: 54, alto: 0.34 },
  { ancho: 36, alto: 0.52 },
  { ancho: 26, alto: 0.3 },
  { ancho: 50, alto: 0.48 },
  { ancho: 34, alto: 0.38 },
  { ancho: 42, alto: 0.56 },
];
const PERIODO_CIUDAD = EDIFICIOS.reduce((s, b) => s + b.ancho + 10, 0);
const PERIODO_RAYAS = 44;

function EnCamino({ alto, quieto }: { alto: number; quieto: boolean }) {
  const ciudad = useBucle(9000, quieto);
  const calle = useBucle(420, quieto);
  const rebote = useBucle(380, quieto);
  const humo = useBucle(1100, quieto);
  const calleAlto = Math.max(20, alto * 0.16);
  const lado = alto * 0.92;
  return (
    <>
      {/* La ciudad, lejos y lenta (dos copias para que el bucle no se note) */}
      <Animated.View
        pointerEvents="none"
        style={[
          e.fila,
          {
            bottom: calleAlto,
            transform: [
              {
                translateX: ciudad.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -PERIODO_CIUDAD],
                }),
              },
            ],
          },
        ]}
      >
        {[0, 1, 2, 3].flatMap((copia) =>
          EDIFICIOS.map((b, i) => (
            <View
              key={`${copia}-${i}`}
              style={{
                width: b.ancho,
                height: alto * b.alto,
                marginRight: 10,
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                backgroundColor:
                  i % 3 === 0 ? "rgba(24,45,37,0.10)" : "rgba(24,45,37,0.06)",
              }}
            >
              <View style={e.ventanas}>
                {[0, 1, 2].map((k) => (
                  <View key={k} style={e.ventana} />
                ))}
              </View>
            </View>
          )),
        )}
      </Animated.View>
      {/* Rayitas de velocidad */}
      {[0.28, 0.45, 0.62].map((y, i) => (
        <Animated.View
          key={y}
          pointerEvents="none"
          style={[
            e.velocidad,
            {
              top: alto * y,
              left: "18%",
              width: 26 + i * 10,
              opacity: rebote.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.2, 0.9, 0.2],
              }),
              transform: [
                {
                  translateX: humo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10 - i * 6, -50 - i * 6],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      {/* La calle con sus rayas que corren */}
      <View pointerEvents="none" style={[e.calle, { height: calleAlto }]}>
        <Animated.View
          style={[
            e.rayas,
            {
              transform: [
                {
                  translateX: calle.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -PERIODO_RAYAS],
                  }),
                },
              ],
            },
          ]}
        >
          {Array.from({ length: 30 }, (_, i) => (
            <View key={i} style={e.raya} />
          ))}
        </Animated.View>
      </View>
      {/* Humito detrás de la moto */}
      {[0, 1, 2].map((i) => {
        const fase = Animated.modulo(Animated.add(humo, i / 3), 1);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              e.humo,
              {
                left: "26%",
                bottom: calleAlto + lado * 0.14,
                opacity: fase.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, 0.75, 0],
                }),
                transform: [
                  {
                    translateX: fase.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -46],
                    }),
                  },
                  {
                    translateY: fase.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -10],
                    }),
                  },
                  {
                    scale: fase.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1.5],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
      {/* La moto: rebota con la calle y se inclina un poquito */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: "28%",
          bottom: calleAlto - lado * 0.11,
          transform: [
            {
              translateY: rebote.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, -3.5, 0],
              }),
            },
            {
              rotate: rebote.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: ["0deg", "-1.2deg", "0deg"],
              }),
            },
          ],
        }}
      >
        <Image
          source={ILUSTRACION.escenaCamino}
          style={{ width: lado * 1.1, height: lado }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// El vendedor revisa: se balancea y su lista se va marcando
// ---------------------------------------------------------------------------------------------------------------------
function Revisa({ alto, quieto }: { alto: number; quieto: boolean }) {
  const vaiven = useBucle(2600, quieto);
  const lista = useBucle(3600, quieto);
  const lado = alto * 0.98;
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: "8%",
          bottom: -lado * 0.06,
          transform: [
            { rotate: ondaEnGrados(vaiven, -2.5, 2.5) },
            { translateY: onda(vaiven, 0, -3) },
          ],
        }}
      >
        <Image
          source={ILUSTRACION.escenaRevisa}
          style={{ width: lado, height: lado }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </Animated.View>
      <View pointerEvents="none" style={[e.lista, { top: alto * 0.18 }]}>
        {[0, 1, 2].map((i) => {
          const marca = lista.interpolate({
            inputRange: [0, 0.15 + i * 0.2, 0.22 + i * 0.2, 0.9, 1],
            outputRange: [0, 0, 1, 1, 0],
            extrapolate: "clamp",
          });
          return (
            <View key={i} style={e.renglon}>
              <View style={e.casilla}>
                <Animated.View
                  style={{ transform: [{ scale: marca }], opacity: marca }}
                >
                  <Icono nombre="checkmark" tamano={13} color={COLOR.bosque} />
                </Animated.View>
              </View>
              <View style={[e.linea, { width: 46 - i * 8 }]} />
            </View>
          );
        })}
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// En preparación: empaca; caen productos a la caja y brilla
// ---------------------------------------------------------------------------------------------------------------------
const CAEN: { icono: Parameters<typeof Icono>[0]["nombre"]; color: string }[] =
  [
    { icono: "nutrition", color: "#E0533D" },
    { icono: "water", color: "#FFB454" },
    { icono: "leaf", color: "#3E8E41" },
  ];

function Prepara({ alto, quieto }: { alto: number; quieto: boolean }) {
  const respira = useBucle(2200, quieto);
  const caida = useBucle(2400, quieto);
  const lado = alto * 1.0;
  return (
    <>
      {/* Estantes del depósito, al fondo */}
      {[0.3, 0.62].map((y) => (
        <View
          key={y}
          pointerEvents="none"
          style={[e.estante, { top: alto * y }]}
        />
      ))}
      {CAEN.map((c, i) => {
        const fase = Animated.modulo(Animated.add(caida, i / CAEN.length), 1);
        return (
          <Animated.View
            key={c.icono}
            pointerEvents="none"
            style={[
              e.cae,
              {
                left: `${50 + i * 4}%`,
                top: -24,
                opacity: fase.interpolate({
                  inputRange: [0, 0.1, 0.6, 0.75],
                  outputRange: [0, 1, 1, 0],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    translateY: fase.interpolate({
                      inputRange: [0, 0.75],
                      outputRange: [0, alto * 0.62],
                      extrapolate: "clamp",
                    }),
                  },
                  {
                    rotate: fase.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", `${i % 2 ? -200 : 200}deg`],
                    }),
                  },
                ],
              },
            ]}
          >
            <Icono nombre={c.icono} tamano={14} color={c.color} />
          </Animated.View>
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: "22%",
          bottom: -lado * 0.04,
          transform: [
            { translateY: onda(respira, 0, -4) },
            {
              scale: respira.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.02, 1],
              }),
            },
          ],
        }}
      >
        <Image
          source={ILUSTRACION.escenaPrepara}
          style={{ width: lado, height: lado }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </Animated.View>
      <Destellos alto={alto} quieto={quieto} />
    </>
  );
}

function Destellos({ alto, quieto }: { alto: number; quieto: boolean }) {
  const v = useBucle(1800, quieto);
  return (
    <>
      {[
        { x: "14%", y: 0.2 },
        { x: "78%", y: 0.3 },
        { x: "86%", y: 0.68 },
      ].map((d, i) => {
        const fase = Animated.modulo(Animated.add(v, i / 3), 1);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: d.x as `${number}%`,
              top: alto * d.y,
              opacity: fase.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  scale: fase.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.4, 1.1, 0.4],
                  }),
                },
              ],
            }}
          >
            <Icono nombre="sparkles" tamano={16} color={COLOR.bosque} />
          </Animated.View>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Por pagar: el celular flota y late un aro ámbar
// ---------------------------------------------------------------------------------------------------------------------
function Pagar({ alto, quieto }: { alto: number; quieto: boolean }) {
  const flota = useBucle(2000, quieto);
  const aro = useBucle(1600, quieto);
  const lado = alto * 0.86;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { alignItems: "center", justifyContent: "center" },
      ]}
    >
      {[0, 0.5].map((d) => {
        const fase = Animated.modulo(Animated.add(aro, d), 1);
        return (
          <Animated.View
            key={d}
            style={[
              e.aro,
              {
                width: lado * 0.8,
                height: lado * 0.8,
                borderRadius: lado * 0.4,
                opacity: fase.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 0],
                }),
                transform: [
                  {
                    scale: fase.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1.6],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
      <Animated.View
        style={{
          transform: [
            { translateY: onda(flota, 4, -6) },
            { rotate: ondaEnGrados(flota, -3, 3) },
          ],
        }}
      >
        <Image
          source={ILUSTRACION.escenaPagar}
          style={{ width: lado, height: lado }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Entregado: festejan y cae confeti
// ---------------------------------------------------------------------------------------------------------------------
const PAPELITOS = Array.from({ length: 12 }, (_, i) => ({
  x: (i * 37) % 100,
  color: [COLOR.bosque, COLOR.ambar, "#FFFFFF", COLOR.limaFuerte][i % 4],
  fase: (i * 0.29) % 1,
  ancho: 6 + (i % 3) * 2,
}));

function Entregado({ alto, quieto }: { alto: number; quieto: boolean }) {
  const salta = useBucle(1400, quieto);
  const cae = useBucle(3000, quieto);
  const lado = alto * 1.02;
  return (
    <>
      {PAPELITOS.map((p, i) => {
        const fase = Animated.modulo(Animated.add(cae, p.fase), 1);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: -10,
              width: p.ancho,
              height: p.ancho * 1.6,
              borderRadius: 2,
              backgroundColor: p.color,
              transform: [
                {
                  translateY: fase.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, alto + 20],
                  }),
                },
                {
                  rotate: fase.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", `${i % 2 ? 360 : -360}deg`],
                  }),
                },
              ],
            }}
          />
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          alignSelf: "center",
          bottom: -lado * 0.05,
          transform: [
            {
              translateY: salta.interpolate({
                inputRange: [0, 0.3, 0.5, 1],
                outputRange: [0, -6, 0, 0],
              }),
            },
          ],
        }}
      >
        <Image
          source={ILUSTRACION.pedidoEntregado}
          style={{ width: lado, height: lado }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </>
  );
}

const e = StyleSheet.create({
  sol: {
    position: "absolute",
    right: -30,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  fila: {
    position: "absolute",
    left: 0,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  ventanas: { flexDirection: "row", flexWrap: "wrap", gap: 4, padding: 6 },
  ventana: {
    width: 6,
    height: 6,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  velocidad: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  calle: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLOR.bosqueMedio,
    justifyContent: "center",
    overflow: "hidden",
  },
  rayas: { flexDirection: "row", width: PERIODO_RAYAS * 30 },
  raya: {
    width: 24,
    height: 3,
    marginRight: PERIODO_RAYAS - 24,
    borderRadius: 2,
    backgroundColor: COLOR.lima,
  },
  humo: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  lista: {
    position: "absolute",
    right: "9%",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  renglon: { flexDirection: "row", alignItems: "center", gap: 6 },
  casilla: {
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.lima,
    borderWidth: 1.5,
    borderColor: COLOR.bosque,
  },
  linea: { height: 6, borderRadius: 3, backgroundColor: "rgba(24,45,37,0.18)" },
  estante: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "rgba(122,67,0,0.10)",
  },
  cae: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  aro: { position: "absolute", borderWidth: 3, borderColor: COLOR.ambar },
});
