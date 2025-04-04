export const ACCIDENT_TYPES = [
    '차량',
    '낙상',
    '건설 자재',
    '원인 불명',
  ] as const;
  
  export type AccidentType = (typeof ACCIDENT_TYPES)[number];