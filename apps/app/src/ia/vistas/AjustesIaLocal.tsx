import { StyleSheet, View } from 'react-native';
import { Boton, Insignia, Tarjeta, Texto } from '../../componentes';
import { COLOR } from '../../tema';
import { useIaLocal } from '../local/estado';
import { bytesDe, megas, type ModeloLocal } from '../local/modelos';

const NIVEL: Record<string, string> = {
  ninguno: 'Sin modelo de lenguaje: usa las reglas, ML Kit y el reconocedor de productos',
  basico: 'Teléfono económico',
  medio: 'Teléfono intermedio',
  alto: 'Teléfono potente',
  maximo: 'Teléfono de gama alta',
};

const tamano = (m: ModeloLocal) => {
  const mb = megas(bytesDe(m));
  return mb >= 1000 ? `${(mb / 1000).toFixed(1).replace('.', ',')} GB` : `${mb} MB`;
};

/**
 * «IA en tu teléfono»: qué modelo le toca a este teléfono, bajarlo una vez (mejor con Wi-Fi) y elegir cuál usar.
 * Después de bajado, el asistente entiende pedidos, recetas y fotos sin internet.
 */
export function AjustesIaLocal() {
  const ia = useIaLocal();
  const otros = ia.posibles.filter((m) => m.id !== ia.recomendado?.id);

  return (
    <View style={{ gap: 12 }}>
      <Tarjeta>
        <Texto v="t3">{ia.telefono}</Texto>
        <Texto v="gris">
          {NIVEL[ia.nivel]}
          {ia.capacidades?.memoriaMb ? ` · ${Math.round(ia.capacidades.memoriaMb / 1024)} GB de memoria` : ''}
          {ia.capacidades?.espacioLibreMb ? ` · ${Math.round(ia.capacidades.espacioLibreMb / 1024)} GB libres` : ''}
        </Texto>
        <Texto v="chico" style={{ marginTop: 6 }}>
          {ia.activo ? `Usando ${ia.activo.nombre}: entiende pedidos, recetas y fotos sin internet.` : 'Sin modelo bajado: el asistente usa las reglas, que también andan sin internet.'}
        </Texto>
      </Tarjeta>

      {ia.error && (
        <Tarjeta style={estilos.error}>
          <Texto v="chico" style={{ color: COLOR.rojoTexto }}>{ia.error}</Texto>
        </Tarjeta>
      )}

      <Tarjeta>
        <View style={estilos.fila}>
          <View style={{ flex: 1 }}>
            <Texto v="fuerte">Sin modelo</Texto>
            <Texto v="gris">Solo las reglas y el reconocedor de productos. Rápido y anda en cualquier teléfono.</Texto>
          </View>
          {!ia.activo && <Insignia texto="En uso" />}
        </View>
        {ia.activo && (
          <View style={estilos.acciones}>
            <Boton tipo="chico" texto="Usar sin modelo" alTocar={() => void ia.usar(null)} />
          </View>
        )}
      </Tarjeta>

      {ia.recomendado && <FilaDeModelo modelo={ia.recomendado} recomendado />}
      {otros.map((m) => (
        <FilaDeModelo key={m.id} modelo={m} />
      ))}
      {!ia.posibles.length && ia.nivel !== 'ninguno' && (
        <Texto v="gris">No hay espacio libre para ningún modelo. Libera espacio y vuelve a entrar.</Texto>
      )}
    </View>
  );
}

function FilaDeModelo({ modelo, recomendado }: { modelo: ModeloLocal; recomendado?: boolean }) {
  const ia = useIaLocal();
  const instalado = ia.instalados.includes(modelo.id);
  const enUso = ia.activo?.id === modelo.id;
  const bajando = ia.progreso?.modeloId === modelo.id ? ia.progreso : null;

  return (
    <Tarjeta>
      <View style={estilos.fila}>
        <View style={{ flex: 1 }}>
          <Texto v="fuerte">{modelo.nombre}</Texto>
          <Texto v="gris">
            {modelo.familia} · {tamano(modelo)} · entiende texto{modelo.tareas.includes('vision') ? ' y fotos' : ''}
          </Texto>
        </View>
        {recomendado && <Insignia texto="Para tu teléfono" />}
        {enUso && <Insignia texto="En uso" />}
      </View>

      {bajando ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          <View style={estilos.barra}>
            <View style={[estilos.relleno, { width: `${Math.round(bajando.fraccion * 100)}%` }]} />
          </View>
          <Texto v="chico">
            Bajando {Math.round(bajando.fraccion * 100)} % · {megas(bajando.bajados)} de {megas(bajando.total)} MB
          </Texto>
          <Boton tipo="secundario" texto="Cancelar" alTocar={() => void ia.cancelar()} />
        </View>
      ) : instalado ? (
        <View style={estilos.acciones}>
          {!enUso && <Boton tipo="chico" texto="Usar este" alTocar={() => void ia.usar(modelo)} />}
          <Boton tipo="secundario" texto="Borrar del teléfono" alTocar={() => void ia.borrar(modelo)} />
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <Boton
            tipo={recomendado ? 'primario' : 'secundario'}
            texto={`Bajar (${tamano(modelo)})`}
            icono="cloud-download-outline"
            deshabilitado={!!ia.progreso}
            alTocar={() => void ia.descargar(modelo)}
          />
          <Texto v="chico" style={{ marginTop: 6 }}>Mejor con Wi-Fi. Se baja una sola vez.</Texto>
        </View>
      )}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acciones: { flexDirection: 'row', gap: 8, marginTop: 10 },
  barra: { height: 8, borderRadius: 4, backgroundColor: COLOR.tenue, overflow: 'hidden' },
  relleno: { height: 8, backgroundColor: COLOR.lima },
  error: { backgroundColor: COLOR.rojoSuave },
});
