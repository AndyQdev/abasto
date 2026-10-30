import { Boton, Texto } from '../componentes';

/** En la vista web de desarrollo no hay cámara ni TFLite: el diagnóstico corre en el teléfono. */
export function Diagnostico({ alCerrar }: { alCerrar: () => void }) {
  return (
    <>
      <Texto>El diagnóstico de la IA corre en el teléfono.</Texto>
      <Boton texto="Volver" alTocar={alCerrar} />
    </>
  );
}
