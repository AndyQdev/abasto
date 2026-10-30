import type { Tensor } from 'react-native-fast-tflite';

const BYTES_POR_DATO: Partial<Record<Tensor['dataType'], number>> = {
  float16: 2,
  float32: 4,
  float64: 8,
  bfloat16: 2,
  int8: 1,
  int16: 2,
  int32: 4,
  int64: 8,
  uint8: 1,
  uint16: 2,
  uint32: 4,
  uint64: 8,
  bool: 1,
  complex64: 8,
  complex128: 16,
};

export function elementosDe(tensor: Tensor): number {
  return tensor.shape.reduce((total, lado) => total * lado, 1);
}

export function bytesDe(tensor: Tensor): number {
  return elementosDe(tensor) * (BYTES_POR_DATO[tensor.dataType] ?? 1);
}

export function entradaNeutra(tensor: Tensor): ArrayBuffer {
  return new ArrayBuffer(bytesDe(tensor));
}

export function describirTensor(tensor: Tensor): string {
  return `${tensor.name} · ${tensor.shape.join('×')} · ${tensor.dataType}`;
}
