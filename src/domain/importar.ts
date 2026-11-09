import { BODEGA_ID, type BodegaDB, ahora, nuevoId } from '../data/db';
import { crearSeccion } from './gestion';
import { ErrorDeNegocio, redondear, redondearCantidad, unidadDe, validarCantidad } from './operaciones';
import type { Producto, Unidad } from './types';

// ---------- 1. Leer el texto (CSV de Excel, o pegado desde una hoja) ----------

const quitarTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** «Precio de Venta» → «preciodeventa». */
const clave = (s: string) => quitarTildes(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function detectarDelimitador(primeraLinea: string): string {
  let mejor = ',';
  let cuenta = -1;
  for (const d of [';', '\t', ',']) {
    // solo se cuentan las que están fuera de comillas
    let dentro = false;
    let n = 0;
    for (const c of primeraLinea) {
      if (c === '"') dentro = !dentro;
      else if (c === d && !dentro) n++;
    }
    if (n > cuenta) {
      mejor = d;
      cuenta = n;
    }
  }
  return mejor;
}

/** Lee CSV con comillas, saltos de línea dentro de comillas y delimitador `,` `;` o tabulación. */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '');
  const delimitador = detectarDelimitador(limpio.split(/\r?\n/, 1)[0] ?? '');
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let dentro = false;

  const cerrarCelda = () => {
    fila.push(celda.trim());
    celda = '';
  };
  const cerrarFila = () => {
    cerrarCelda();
    if (fila.some((c) => c !== '')) filas.push(fila); // se ignoran las líneas vacías
    fila = [];
  };

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (dentro) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') dentro = false;
      else celda += c;
    } else if (c === '"') dentro = true;
    else if (c === delimitador) cerrarCelda();
    else if (c === '\n') cerrarFila();
    else if (c === '\r') continue;
    else celda += c;
  }
  if (celda !== '' || fila.length > 0) cerrarFila();
  return filas;
}

/** «S/ 3,50», «3.50», «1,234.50», «1.234,50» → número. NaN si no es un número. */
export function leerNumero(texto: string): number {
  let t = texto.replace(/[^\d.,-]/g, '');
  if (t === '' || t === '-') return Number.NaN;
  const ultimaComa = t.lastIndexOf(',');
  const ultimoPunto = t.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    // el que va último es el decimal; el otro separa miles
    t = ultimaComa > ultimoPunto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (ultimaComa >= 0) {
    // una sola coma = decimal (3,50); varias = miles (1,234,567)
    t = (t.match(/,/g) ?? []).length === 1 ? t.replace(',', '.') : t.replace(/,/g, '');
  } else if ((t.match(/\./g) ?? []).length > 1) {
    t = t.replace(/\./g, '');
  }
  return Number(t);
}

// ---------- 2. Entender las columnas y revisar cada fila ----------

const ALIAS: Record<string, string[]> = {
  nombre: ['nombre', 'producto', 'descripcion', 'articulo', 'item', 'detalle'],
  precio: ['precio', 'preciodeventa', 'precioventa', 'pv', 'venta', 'preciounitario'],
  costo: ['costo', 'preciodecompra', 'preciocompra', 'compra', 'pc'],
  stock: ['stock', 'cantidad', 'existencias', 'existencia', 'inventario', 'unidades'],
  codigo: ['codigo', 'codigodebarras', 'barras', 'ean', 'sku', 'cod'],
  seccion: ['seccion', 'categoria', 'familia', 'rubro', 'grupo', 'linea'],
  unidad: ['unidad', 'unidaddemedida', 'medida', 'um', 'vendidopor'],
  minimo: ['minimo', 'stockminimo', 'avisarcuando'],
};

export const COLUMNAS_PLANTILLA = ['nombre', 'precio', 'costo', 'stock', 'codigo', 'seccion', 'unidad'] as const;

export interface FilaImportada {
  /** Número de fila en el archivo (la 1 es el encabezado). */
  fila: number;
  nombre: string;
  precio: number;
  costo: number;
  stock: number;
  codigo?: string;
  seccion?: string;
  unidad: Unidad;
  minimo?: number;
}

export interface LecturaProductos {
  validas: FilaImportada[];
  errores: Array<{ fila: number; motivo: string }>;
}

export function interpretarProductos(filas: string[][]): LecturaProductos {
  if (filas.length === 0) throw new ErrorDeNegocio('El archivo está vacío');
  const encabezado = filas[0].map(clave);
  const columna = (campo: string) => encabezado.findIndex((h) => ALIAS[campo].includes(h));
  const col = Object.fromEntries(Object.keys(ALIAS).map((c) => [c, columna(c)])) as Record<string, number>;

  if (col.nombre < 0) throw new ErrorDeNegocio('No encontré la columna «nombre». La primera fila debe tener los títulos de las columnas.');
  if (col.precio < 0) throw new ErrorDeNegocio('No encontré la columna «precio» (el precio de venta).');

  const validas: FilaImportada[] = [];
  const errores: LecturaProductos['errores'] = [];
  const codigosVistos = new Map<string, number>();
  const dato = (f: string[], campo: string) => (col[campo] >= 0 ? (f[col[campo]] ?? '').trim() : '');

  filas.slice(1).forEach((f, i) => {
    const fila = i + 2;
    const motivos: string[] = [];

    const nombre = dato(f, 'nombre');
    if (!nombre) motivos.push('falta el nombre');

    const precio = leerNumero(dato(f, 'precio'));
    if (!(precio > 0)) motivos.push('el precio no es válido');

    const textoCosto = dato(f, 'costo');
    const costo = textoCosto === '' ? 0 : leerNumero(textoCosto);
    if (Number.isNaN(costo) || costo < 0) motivos.push('el costo no es válido');

    const unidadTexto = clave(dato(f, 'unidad'));
    const unidad: Unidad = /^(kg|kilo|kilos|kilogramo|kilogramos|peso)$/.test(unidadTexto) ? 'kg' : 'unidad';

    const textoStock = dato(f, 'stock');
    const stock = textoStock === '' ? 0 : leerNumero(textoStock);
    try {
      validarCantidad({ unidad }, Number.isNaN(stock) ? -1 : redondearCantidad(stock), true);
    } catch {
      motivos.push(unidad === 'kg' ? 'el stock no es válido' : 'el stock debe ser un número entero');
    }

    const textoMinimo = dato(f, 'minimo');
    const minimo = textoMinimo === '' ? undefined : leerNumero(textoMinimo);
    if (minimo !== undefined && (!Number.isInteger(minimo) || minimo < 0)) motivos.push('el mínimo no es válido');

    const codigo = dato(f, 'codigo') || undefined;
    if (codigo) {
      const antes = codigosVistos.get(codigo);
      if (antes) motivos.push(`el código ${codigo} ya está en la fila ${antes}`);
      else codigosVistos.set(codigo, fila);
    }

    if (motivos.length > 0) {
      errores.push({ fila, motivo: motivos.join(', ') });
      return;
    }
    validas.push({
      fila,
      nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      precio: redondear(precio),
      costo: redondear(costo),
      stock: redondearCantidad(stock),
      codigo,
      seccion: dato(f, 'seccion') || undefined,
      unidad,
      minimo,
    });
  });
  return { validas, errores };
}

/** Archivo de ejemplo para descargar. Lleva BOM para que Excel respete las tildes. */
export function plantillaCsv(): string {
  const filas = [
    COLUMNAS_PLANTILLA.join(','),
    'Leche 400 g,4.50,3.60,24,7750210001234,Abarrotes,unidad',
    'Arroz suelto,4.20,3.40,20,,Abarrotes,kg',
    'Gaseosa 500 ml,2.50,1.70,18,7750540005678,Bebidas,unidad',
  ];
  return '﻿' + filas.join('\r\n') + '\r\n';
}

// ---------- 3. Guardar ----------

export interface ResumenImportacion {
  creados: number;
  repetidos: FilaImportada[];
  seccionesNuevas: number;
}

const normalizarNombre = (s: string) => clave(s);

/** Separa lo que ya existe (mismo código o mismo nombre) de lo que se puede crear. */
export async function clasificarProductos(db: BodegaDB, validas: FilaImportada[]) {
  const existentes = await db.productos.filter((p) => !p.sinStock).toArray();
  const codigos = new Set(existentes.map((p) => p.codigo).filter(Boolean));
  const nombres = new Set(existentes.map((p) => normalizarNombre(p.nombre)));
  const nuevos: FilaImportada[] = [];
  const repetidos: FilaImportada[] = [];
  const nombresDelArchivo = new Set<string>();
  for (const f of validas) {
    const nombre = normalizarNombre(f.nombre);
    const yaExiste = (f.codigo && codigos.has(f.codigo)) || nombres.has(nombre) || nombresDelArchivo.has(nombre);
    if (yaExiste) repetidos.push(f);
    else {
      nuevos.push(f);
      nombresDelArchivo.add(nombre);
    }
  }
  return { nuevos, repetidos };
}

/**
 * Crea los productos nuevos (los repetidos se omiten, sin tocar los que ya tienes).
 * Todo o nada: si algo falla, no queda ningún producto a medias.
 */
export async function importarProductos(db: BodegaDB, validas: FilaImportada[]): Promise<ResumenImportacion> {
  const { nuevos, repetidos } = await clasificarProductos(db, validas);
  if (nuevos.length === 0) return { creados: 0, repetidos, seccionesNuevas: 0 };

  // secciones: se reutilizan las que existen y se crean las que falten
  const porNombre = new Map((await db.secciones.toArray()).map((s) => [normalizarNombre(s.nombre), s.id]));
  let seccionesNuevas = 0;
  for (const f of nuevos) {
    if (!f.seccion) continue;
    const k = normalizarNombre(f.seccion);
    if (!porNombre.has(k)) {
      porNombre.set(k, (await crearSeccion(db, f.seccion)).id);
      seccionesNuevas++;
    }
  }

  const fecha = ahora();
  await db.transaction('rw', [db.productos, db.movimientos], async () => {
    const productos: Producto[] = nuevos.map((f) => ({
      id: nuevoId(),
      bodegaId: BODEGA_ID,
      nombre: f.nombre,
      codigo: f.codigo,
      costo: f.costo,
      precio: f.precio,
      stock: f.stock,
      minimo: f.minimo ?? 5,
      seccionId: f.seccion ? porNombre.get(normalizarNombre(f.seccion)) : undefined,
      unidad: unidadDe(f) === 'kg' ? 'kg' : undefined,
      actualizadoEn: fecha,
    }));
    await db.productos.bulkAdd(productos);
    await db.movimientos.bulkAdd(
      productos
        .filter((p) => p.stock > 0)
        .map((p) => ({ id: nuevoId(), bodegaId: BODEGA_ID, productoId: p.id, tipo: 'ingreso' as const, cantidad: p.stock, fecha })),
    );
  });
  return { creados: nuevos.length, repetidos, seccionesNuevas };
}
