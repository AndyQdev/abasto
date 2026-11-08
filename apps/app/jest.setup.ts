import { configure } from '@testing-library/react-native';

// Las pantallas esperan cosas asíncronas (animaciones, la API simulada). Con la máquina ocupada (Docker armando
// imágenes, toda la suite en paralelo) un segundo no alcanza y la prueba falla por tiempo, no por la lógica.
configure({ asyncUtilTimeout: 5000 });
