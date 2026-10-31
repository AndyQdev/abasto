/**
 * Completa app.json con lo que no puede ir en git: la clave de Google Maps sale de `apps/app/.env.local`
 * (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, ignorado por git). Expo carga ese archivo antes de leer esta config.
 * En iPhone el mapa es el de Apple y no necesita clave.
 */
module.exports = ({ config }) => {
  const clave = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!clave) console.warn('[abasto] Falta EXPO_PUBLIC_GOOGLE_MAPS_API_KEY en apps/app/.env.local: el mapa de Android saldrá en gris.');
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: clave ?? '' }]],
  };
};
