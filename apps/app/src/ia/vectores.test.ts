import etiquetas from '../../assets/modelos/etiquetas.json';
import datos from '../../assets/modelos/vectores.json';
import { leerVectores, masParecidos } from './parecido';

// Lo que sale de ml/src/abasto_ml/vision/catalogo.py tiene que poder leerlo la app tal cual
describe('Vectores del catálogo que van dentro de la app', () => {
  const vectores = leerVectores(datos);

  it('tiene un vector de 576 números por cada producto del modelo', () => {
    expect(vectores.dimension).toBe(576);
    expect(vectores.productos.map((p) => p.codigo).sort()).toEqual([...etiquetas].sort());
  });

  it('el vector de un producto se reconoce a sí mismo primero y con confianza 1', () => {
    const [arroz] = vectores.productos;
    expect(masParecidos(arroz.vector, vectores.productos, 1)).toEqual([{ codigo: arroz.codigo, confianza: 1 }]);
  });
});
