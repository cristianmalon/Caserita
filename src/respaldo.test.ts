import { describe, expect, it } from 'vitest';
import { necesitaRespaldo } from './respaldo';

const ahora = new Date('2026-11-20T12:00:00.000Z');
const haceDias = (n: number) => new Date(ahora.getTime() - n * 86_400_000).toISOString();

describe('necesitaRespaldo', () => {
  it('no avisa si no hay nada que perder', () => {
    expect(necesitaRespaldo({ ahora, ultimoRespaldo: null, primerUso: haceDias(30), hayDatos: false }).necesita).toBe(false);
  });

  it('da unos días de gracia a quien nunca respaldó', () => {
    const base = { ahora, ultimoRespaldo: null, hayDatos: true };
    expect(necesitaRespaldo({ ...base, primerUso: haceDias(1) })).toEqual({ necesita: false, dias: null });
    expect(necesitaRespaldo({ ...base, primerUso: haceDias(4) })).toEqual({ necesita: true, dias: null });
  });

  it('avisa a los 7 días del último respaldo', () => {
    const base = { ahora, primerUso: haceDias(60), hayDatos: true };
    expect(necesitaRespaldo({ ...base, ultimoRespaldo: haceDias(3) })).toEqual({ necesita: false, dias: 3 });
    expect(necesitaRespaldo({ ...base, ultimoRespaldo: haceDias(6) }).necesita).toBe(false);
    expect(necesitaRespaldo({ ...base, ultimoRespaldo: haceDias(8) })).toEqual({ necesita: true, dias: 8 });
  });

  it('sin fecha de primer uso no molesta de inmediato', () => {
    expect(necesitaRespaldo({ ahora, ultimoRespaldo: null, primerUso: null, hayDatos: true }).necesita).toBe(false);
  });
});
