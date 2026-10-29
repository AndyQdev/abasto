import TextRecognition from '@react-native-ml-kit/text-recognition';

/** Lee el texto de una foto con ML Kit, dentro del teléfono y sin internet. */
export async function leerTexto(uri: string): Promise<string> {
  return (await TextRecognition.recognize(uri)).text;
}
