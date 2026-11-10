/**
 * Completa app.json con lo que no puede ir en git: Firebase (google-services.json) y la clave de Google Maps, que sale de `apps/app/.env.local`
 * (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, ignorado por git). Expo carga ese archivo antes de leer esta config.
 * En iPhone el mapa es el de Apple y no necesita clave.
 */
const { existsSync } = require('node:fs');
const { join } = require('node:path');

module.exports = ({ config }) => {
  const clave = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!clave) console.warn('[abasto] Falta EXPO_PUBLIC_GOOGLE_MAPS_API_KEY en apps/app/.env.local: el mapa de Android saldrá en gris.');
  // Notificaciones push (10/11): Firebase entra solo si está su archivo. Lleva una clave de Google, por eso no va
  // en git (.gitignore). Sin él la app anda igual, pero no recibe notificaciones.
  const firebase = existsSync(join(__dirname, 'google-services.json'));
  if (!firebase) console.warn('[abasto] Falta apps/app/google-services.json (Firebase): la app no recibirá notificaciones push.');
  return {
    ...config,
    android: { ...config.android, ...(firebase ? { googleServicesFile: './google-services.json' } : {}) },
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: clave ?? '' }]],
  };
};
