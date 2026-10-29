import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lo que la app guarda en el teléfono para funcionar sin señal: el catálogo, el carrito y los pedidos.
 * Si el almacenamiento falla, la app sigue sin guardar.
 */
export const guardado = {
  async leer<T>(clave: string): Promise<T | null> {
    try {
      const v = await AsyncStorage.getItem(`abasto:${clave}`);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  async escribir(clave: string, valor: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(`abasto:${clave}`, JSON.stringify(valor));
    } catch {
      /* sin espacio: se sigue sin guardar */
    }
  },
  async borrar(clave: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`abasto:${clave}`);
    } catch {
      /* nada que hacer */
    }
  },
};
