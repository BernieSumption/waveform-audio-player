

export interface NumberArray {
  [key: number]: number;
  length: number;
}

export function makeNumberArray(length: number): NumberArray {
  if ("Float32Array" in window) {
    return new Float32Array(length);
  }
  return new Array(length);
}