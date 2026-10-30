import {
  combinarConTexto,
  leerVectores,
  masParecidos,
  mezclarConClasificador,
  similitudCoseno,
  type Reconocido,
  type VectorDeProducto,
} from './parecido';

describe('similitudCoseno', () => {
  it('da 1 cuando los vectores son iguales', () => {
    expect(similitudCoseno([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('da -1 cuando los vectores son opuestos', () => {
    expect(similitudCoseno([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
  });

  it('da 0 cuando los vectores son perpendiculares', () => {
    expect(similitudCoseno([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('da 0 sin NaN cuando alguno tiene norma cero', () => {
    expect(similitudCoseno([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(similitudCoseno([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it('lanza con el mensaje exacto cuando los largos no coinciden', () => {
    expect(() => similitudCoseno([1, 2], [1, 2, 3])).toThrow(
      'Los vectores no tienen el mismo largo: 2 y 3',
    );
  });
});

describe('masParecidos', () => {
  const catalogo: VectorDeProducto[] = [
    { codigo: 'B', vector: [1, 0, 0] },
    { codigo: 'A', vector: [0.9, 0.1, 0] },
    { codigo: 'C', vector: [-1, 0, 0] },
  ];

  it('devuelve el más parecido primero', () => {
    const [primero] = masParecidos([1, 0, 0], catalogo);
    expect(primero?.codigo).toBe('B');
  });

  it('respeta el máximo pedido', () => {
    expect(masParecidos([1, 0, 0], catalogo, 1)).toHaveLength(1);
    expect(masParecidos([1, 0, 0], catalogo, 2)).toHaveLength(2);
  });

  it('desempata por código', () => {
    const empatados: VectorDeProducto[] = [
      { codigo: 'Z', vector: [1, 0] },
      { codigo: 'A', vector: [1, 0] },
    ];
    expect(masParecidos([1, 0], empatados).map((r) => r.codigo)).toEqual(['A', 'Z']);
  });

  it('descarta los opuestos, que quedan con confianza cero', () => {
    const codigos = masParecidos([1, 0, 0], catalogo).map((r) => r.codigo);
    expect(codigos).not.toContain('C');
  });

  it('redondea la confianza a 3 decimales', () => {
    const [parecido] = masParecidos([1, 0], [{ codigo: 'A', vector: [0.7071067, 0.7071067] }]);
    expect(parecido?.confianza).toBe(0.707);
  });
});

describe('combinarConTexto', () => {
  const porImagen: Reconocido[] = [
    { codigo: 'A', confianza: 0.9 },
    { codigo: 'B', confianza: 0.8 },
  ];

  it('el texto sube a un producto que la imagen dejó segundo', () => {
    const resultado = combinarConTexto(porImagen, ['B']);
    expect(resultado[0]).toEqual({ codigo: 'B', confianza: 1 });
  });

  it('agrega un producto que solo leyó el texto', () => {
    const resultado = combinarConTexto(porImagen, ['C']);
    expect(resultado).toContainEqual({ codigo: 'C', confianza: 0.25 });
  });

  it('no deja que la confianza pase de 1', () => {
    const resultado = combinarConTexto([{ codigo: 'A', confianza: 0.95 }], ['A']);
    expect(resultado[0]?.confianza).toBe(1);
  });

  it('no cambia los arreglos que recibe', () => {
    const copiaImagen = porImagen.map((r) => ({ ...r }));
    const texto = ['B', 'A'];
    combinarConTexto(porImagen, texto);
    expect(porImagen).toEqual(copiaImagen);
    expect(texto).toEqual(['B', 'A']);
  });

  it('con texto vacío devuelve una copia de la imagen', () => {
    const resultado = combinarConTexto(porImagen, []);
    expect(resultado).toEqual(porImagen);
    expect(resultado).not.toBe(porImagen);
  });
});

describe('leerVectores', () => {
  const validos = {
    modelo: 'mobilenet-v3',
    dimension: 3,
    productos: [{ codigo: 'AR-0100', vector: [0.1, 0.2, 0.3] }],
  };

  it('acepta un archivo válido', () => {
    expect(leerVectores(validos)).toEqual(validos);
  });

  it('rechaza si falta «modelo»', () => {
    expect(() => leerVectores({ dimension: 3, productos: [] })).toThrow(
      'vectores.json: falta «modelo»',
    );
  });

  it('rechaza una dimensión que no es mayor que cero', () => {
    expect(() => leerVectores({ modelo: 'm', dimension: 0, productos: [] })).toThrow(
      'vectores.json: «dimension» debe ser un entero mayor que 0',
    );
  });

  it('rechaza un vector de otro largo y dice cuál es el producto', () => {
    expect(() =>
      leerVectores({
        modelo: 'm',
        dimension: 3,
        productos: [{ codigo: 'AR-0100', vector: [0.1, 0.2, 0.3, 0.4] }],
      }),
    ).toThrow('vectores.json: el producto AR-0100 tiene 4 números y se esperaban 3');
  });

  it('rechaza un número que no es finito', () => {
    expect(() =>
      leerVectores({
        modelo: 'm',
        dimension: 3,
        productos: [{ codigo: 'AR-0100', vector: [0.1, Number.NaN, 0.3] }],
      }),
    ).toThrow('vectores.json: el producto AR-0100 tiene un número que no es finito');
  });
});

describe('mezclarConClasificador', () => {
  const catalogo = [
    { codigo: 'AB-001', vector: [1, 0, 0] },
    { codigo: 'AB-002', vector: [0.8, 0.6, 0] },
  ];

  it('el clasificador desempata lo que el vector ve parecido', () => {
    // por vector AB-001 gana (1 contra 0,8); el clasificador está seguro de AB-002
    const consulta = [1, 0, 0];
    expect(mezclarConClasificador(consulta, catalogo, [0.1, 0.9], ['AB-001', 'AB-002'])).toEqual([
      { codigo: 'AB-002', confianza: 0.85 },
      { codigo: 'AB-001', confianza: 0.55 },
    ]);
  });

  it('un producto que el clasificador no conoce solo suma su parecido', () => {
    expect(mezclarConClasificador([1, 0, 0], catalogo, [1], ['AB-002'])).toEqual([
      { codigo: 'AB-002', confianza: 0.9 },
      { codigo: 'AB-001', confianza: 0.5 },
    ]);
  });

  it('avisa si el modelo y las etiquetas no son del mismo entrenamiento', () => {
    expect(() => mezclarConClasificador([1, 0, 0], catalogo, [0.5, 0.5], ['AB-001'])).toThrow(
      'El clasificador da 2 probabilidades y hay 1 etiquetas',
    );
  });
});
