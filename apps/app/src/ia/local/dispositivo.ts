import * as Device from 'expo-device';
import { getFreeDiskStorageAsync } from 'expo-file-system/legacy';
import type { Capacidades } from './modelos';

const MB = 1024 * 1024;

/** Memoria, procesador y espacio libre del teléfono, para elegir el modelo que le toca. */
export async function capacidadesDelTelefono(): Promise<Capacidades> {
  const libre = await getFreeDiskStorageAsync().catch(() => null);
  return {
    memoriaMb: Device.totalMemory ? Math.round(Device.totalMemory / MB) : null,
    arquitecturas: Device.supportedCpuArchitectures ?? [],
    espacioLibreMb: libre === null ? null : Math.round(libre / MB),
  };
}

export const nombreDelTelefono = () => [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'Este teléfono';
