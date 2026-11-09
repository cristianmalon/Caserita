/**
 * Cuidado de los datos, que viven solo en el celular:
 * pedir al navegador que no los borre y recordar cuándo fue el último respaldo.
 */

const CLAVE_PRIMER_USO = 'caserita:primer-uso';
const CLAVE_ULTIMO_RESPALDO = 'caserita:ultimo-respaldo';

const DIA_MS = 86_400_000;

// localStorage puede no estar disponible (modo privado, bloqueado): nunca debe romper la app.
function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: simplemente no se recuerda */
  }
}

export const marcarPrimerUso = () => {
  if (!leer(CLAVE_PRIMER_USO)) guardar(CLAVE_PRIMER_USO, new Date().toISOString());
};
export const registrarRespaldoHecho = () => guardar(CLAVE_ULTIMO_RESPALDO, new Date().toISOString());
export const fechaUltimoRespaldo = (): string | null => leer(CLAVE_ULTIMO_RESPALDO);
export const fechaPrimerUso = (): string | null => leer(CLAVE_PRIMER_USO);

export interface EstadoRespaldo {
  necesita: boolean;
  /** Días desde el último respaldo; null si nunca se hizo. */
  dias: number | null;
}

/**
 * ¿Hay que avisar? Solo si hay datos que perder, pasaron unos días de gracia desde el primer uso
 * y el último respaldo es viejo (o nunca existió).
 */
export function necesitaRespaldo(o: {
  ahora: Date;
  ultimoRespaldo: string | null;
  primerUso: string | null;
  hayDatos: boolean;
  diasAviso?: number;
  diasGracia?: number;
}): EstadoRespaldo {
  const { ahora, ultimoRespaldo, primerUso, hayDatos, diasAviso = 7, diasGracia = 3 } = o;
  const dias = ultimoRespaldo ? Math.floor((ahora.getTime() - new Date(ultimoRespaldo).getTime()) / DIA_MS) : null;
  if (!hayDatos) return { necesita: false, dias };
  if (dias !== null) return { necesita: dias >= diasAviso, dias };
  // Nunca respaldó: se espera unos días desde el primer uso para no molestar de entrada.
  const usoDias = primerUso ? Math.floor((ahora.getTime() - new Date(primerUso).getTime()) / DIA_MS) : 0;
  return { necesita: usoDias >= diasGracia, dias: null };
}

/** Pide al navegador que no borre los datos si falta espacio. null = el navegador no lo soporta. */
export async function pedirAlmacenamientoPersistente(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function almacenamientoProtegido(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
