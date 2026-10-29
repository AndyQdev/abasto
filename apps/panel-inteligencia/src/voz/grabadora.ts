/** Graba del micrófono hasta que se llama a detener(). Libera el micrófono al terminar. */
export interface Grabacion {
  detener(): Promise<Blob>;
}

export type IniciarGrabacion = () => Promise<Grabacion>;

export const grabarDelMicrofono: IniciarGrabacion = async () => {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar el micrófono');
  let flujo: MediaStream;
  try {
    flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error('No tengo permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.');
  }
  const grabador = new MediaRecorder(flujo);
  const partes: Blob[] = [];
  grabador.ondataavailable = (e) => partes.push(e.data);
  grabador.start();

  return {
    detener: () =>
      new Promise<Blob>((resolver) => {
        grabador.onstop = () => {
          for (const pista of flujo.getTracks()) pista.stop();
          resolver(new Blob(partes, { type: grabador.mimeType }));
        };
        grabador.stop();
      }),
  };
};
