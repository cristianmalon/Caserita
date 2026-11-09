import { BODEGA_ID, type BodegaDB, ahora, nuevoId } from '../data/db';
import { ErrorDeNegocio, ID_VARIOS, diaLocal, redondear, redondearCantidad, validarCantidad } from './operaciones';
import type { Cliente, Conteo, LineaVenta, Producto, Seccion, Unidad, Venta } from './types';

const COLORES = ['#F2A33A', '#3B82C4', '#D9534F', '#1B7F45', '#8B6B4A', '#7A5BA6', '#2A9D8F'];

const mismoNombre = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'base' }) === 0;

// ---------- Clientes ----------

export async function crearCliente(
  db: BodegaDB,
  datos: { nombre: string; telefono?: string },
): Promise<Cliente> {
  const limpio = datos.nombre.trim();
  if (!limpio) throw new ErrorDeNegocio('Escribe el nombre del cliente');
  const nombre = limpio.charAt(0).toUpperCase() + limpio.slice(1);
  const existentes = await db.clientes.toArray();
  if (existentes.some((c) => mismoNombre(c.nombre, nombre))) {
    throw new ErrorDeNegocio('Ya tienes un cliente con ese nombre');
  }
  const cliente: Cliente = {
    id: nuevoId(),
    bodegaId: BODEGA_ID,
    nombre,
    telefono: datos.telefono?.trim() || undefined,
  };
  await db.clientes.add(cliente);
  return cliente;
}

// ---------- Secciones ----------

export async function crearSeccion(db: BodegaDB, nombre: string): Promise<Seccion> {
  const limpio = nombre.trim();
  if (!limpio) throw new ErrorDeNegocio('Escribe el nombre de la sección');
  const existentes = await db.secciones.toArray();
  if (existentes.some((s) => mismoNombre(s.nombre, limpio))) {
    throw new ErrorDeNegocio('Ya existe una sección con ese nombre');
  }
  const seccion: Seccion = {
    id: nuevoId(),
    bodegaId: BODEGA_ID,
    nombre: limpio.charAt(0).toUpperCase() + limpio.slice(1),
    color: COLORES[existentes.length % COLORES.length],
  };
  await db.secciones.add(seccion);
  return seccion;
}

export async function renombrarSeccion(db: BodegaDB, id: string, nombre: string) {
  const limpio = nombre.trim();
  if (!limpio) throw new ErrorDeNegocio('Escribe el nombre de la sección');
  const otras = (await db.secciones.toArray()).filter((s) => s.id !== id);
  if (otras.some((s) => mismoNombre(s.nombre, limpio))) {
    throw new ErrorDeNegocio('Ya existe una sección con ese nombre');
  }
  await db.secciones.update(id, { nombre: limpio.charAt(0).toUpperCase() + limpio.slice(1) });
}

/** Elimina la sección; sus productos pasan a otra o quedan sin sección. */
export async function eliminarSeccion(db: BodegaDB, id: string, destinoId?: string) {
  await db.transaction('rw', [db.secciones, db.productos], async () => {
    await db.productos.where('seccionId').equals(id).modify({
      seccionId: destinoId,
      actualizadoEn: ahora(),
    });
    await db.secciones.delete(id);
  });
}

// ---------- Productos ----------

export interface CambiosProducto {
  nombre?: string;
  precio?: number;
  costo?: number;
  minimo?: number;
  seccionId?: string | null; // null = sin sección
  codigo?: string | null; // código de barras; vacío o null = sin código
  unidad?: Unidad;
  favorito?: boolean;
}

export async function actualizarProducto(db: BodegaDB, id: string, cambios: CambiosProducto) {
  const producto = await db.productos.get(id);
  if (!producto) throw new ErrorDeNegocio('Producto no encontrado');
  const nuevo: Partial<Producto> = { actualizadoEn: ahora() };
  if (cambios.nombre !== undefined) {
    if (!cambios.nombre.trim()) throw new ErrorDeNegocio('El nombre no puede quedar vacío');
    nuevo.nombre = cambios.nombre.trim();
  }
  if (cambios.precio !== undefined) {
    if (!(cambios.precio > 0)) throw new ErrorDeNegocio('Escribe el precio de venta');
    nuevo.precio = redondear(cambios.precio);
  }
  if (cambios.costo !== undefined) {
    if (cambios.costo < 0) throw new ErrorDeNegocio('El costo no puede ser negativo');
    nuevo.costo = redondear(cambios.costo);
  }
  if (cambios.minimo !== undefined) {
    if (cambios.minimo < 0 || !Number.isInteger(cambios.minimo)) {
      throw new ErrorDeNegocio('El aviso debe ser un número entero');
    }
    nuevo.minimo = cambios.minimo;
  }
  if (cambios.seccionId !== undefined) nuevo.seccionId = cambios.seccionId ?? undefined;
  if (cambios.favorito !== undefined) nuevo.favorito = cambios.favorito || undefined;
  if (cambios.unidad !== undefined) {
    if (cambios.unidad === 'unidad' && !Number.isInteger(producto.stock)) {
      throw new ErrorDeNegocio('No se puede pasar a «por unidad» con stock decimal. Corrige el stock primero.');
    }
    nuevo.unidad = cambios.unidad === 'kg' ? 'kg' : undefined;
  }
  if (cambios.codigo !== undefined) {
    const codigo = cambios.codigo?.trim() || undefined;
    if (codigo) {
      const otros = await db.productos.where('codigo').equals(codigo).toArray();
      if (otros.some((p) => p.id !== id)) throw new ErrorDeNegocio(`Ya existe un producto con ese código: ${otros[0].nombre}`);
    }
    nuevo.codigo = codigo;
  }
  await db.productos.update(id, nuevo);
}

// ---------- Conteo de inventario por sección ----------

/** Productos que entran en el conteo: los de la sección, o todos. */
async function productosDelAlcance(db: BodegaDB, seccionId: string | null) {
  const todos = (await db.productos.toArray()).filter((p) => !p.sinStock);
  return seccionId ? todos.filter((p) => p.seccionId === seccionId) : todos;
}

/** Abre un conteo, o retoma el que ya estaba abierto para esa sección. */
export async function iniciarConteo(db: BodegaDB, seccionId: string | null): Promise<Conteo> {
  const abiertos = await db.conteos.where('estado').equals('abierto').toArray();
  const retomar = abiertos.find((c) => c.seccionId === seccionId);
  if (retomar) return retomar;
  const conteo: Conteo = {
    id: nuevoId(),
    bodegaId: BODEGA_ID,
    seccionId,
    estado: 'abierto',
    creadoEn: ahora(),
    lineas: {},
  };
  await db.conteos.add(conteo);
  return conteo;
}

/** Anota lo contado. Guarda también lo que decía el sistema en ese momento. */
export async function registrarConteo(
  db: BodegaDB,
  conteoId: string,
  productoId: string,
  contado: number,
) {
  await db.transaction('rw', [db.conteos, db.productos], async () => {
    const conteo = await db.conteos.get(conteoId);
    if (!conteo || conteo.estado !== 'abierto') throw new ErrorDeNegocio('Este conteo ya terminó');
    const producto = await db.productos.get(productoId);
    if (!producto) throw new ErrorDeNegocio('Producto no encontrado');
    validarCantidad(producto, contado, true);
    const previo = conteo.lineas[productoId];
    // Si ya se había contado, se conserva el "sistema" original: es contra lo que se compara.
    await db.conteos.update(conteoId, {
      [`lineas.${productoId}`]: { contado, sistema: previo?.sistema ?? producto.stock },
    });
  });
}

export interface ResultadoConteo {
  total: number; // productos del alcance
  contados: number;
  sinContar: number;
  coinciden: number;
  diferencias: Array<{ producto: Producto; sistema: number; contado: number; diferencia: number }>;
  diferenciaACosto: number; // negativo = faltan
}

export async function resultadoConteo(db: BodegaDB, conteoId: string): Promise<ResultadoConteo> {
  const conteo = await db.conteos.get(conteoId);
  if (!conteo) throw new ErrorDeNegocio('Conteo no encontrado');
  const productos = await productosDelAlcance(db, conteo.seccionId);
  const porId = new Map(productos.map((p) => [p.id, p]));

  const diferencias: ResultadoConteo['diferencias'] = [];
  let coinciden = 0;
  let contados = 0;
  for (const [productoId, linea] of Object.entries(conteo.lineas)) {
    const producto = porId.get(productoId);
    if (!producto) continue; // salió de la sección después de contarlo
    contados++;
    const diferencia = redondearCantidad(linea.contado - linea.sistema);
    if (diferencia === 0) coinciden++;
    else diferencias.push({ producto, sistema: linea.sistema, contado: linea.contado, diferencia });
  }
  return {
    total: productos.length,
    contados,
    sinContar: productos.length - contados,
    coinciden,
    diferencias,
    diferenciaACosto: redondear(
      diferencias.reduce((s, d) => s + d.diferencia * d.producto.costo, 0),
    ),
  };
}

/**
 * Aplica las diferencias. Como pudo haber ventas mientras se contaba, no se pisa el stock:
 * se suma la diferencia (contado − sistema al contar) al stock de ahora.
 */
export async function aplicarConteo(db: BodegaDB, conteoId: string): Promise<number> {
  return db.transaction('rw', [db.conteos, db.productos, db.movimientos], async () => {
    const conteo = await db.conteos.get(conteoId);
    if (!conteo) throw new ErrorDeNegocio('Conteo no encontrado');
    if (conteo.estado !== 'abierto') throw new ErrorDeNegocio('Este conteo ya se aplicó');

    const fecha = ahora();
    let ajustes = 0;
    for (const [productoId, linea] of Object.entries(conteo.lineas)) {
      const diferencia = redondearCantidad(linea.contado - linea.sistema);
      if (diferencia === 0) continue;
      const producto = await db.productos.get(productoId);
      if (!producto) continue;
      const stock = Math.max(0, redondearCantidad(producto.stock + diferencia));
      if (stock === producto.stock) continue;
      await db.productos.update(productoId, { stock, actualizadoEn: fecha });
      await db.movimientos.add({
        id: nuevoId(),
        bodegaId: BODEGA_ID,
        productoId,
        tipo: 'conteo',
        cantidad: redondearCantidad(stock - producto.stock),
        ref: conteoId,
        fecha,
      });
      ajustes++;
    }
    await db.conteos.update(conteoId, { estado: 'aplicado', aplicadoEn: fecha });
    return ajustes;
  });
}

/** Cuándo se contó por última vez cada sección (clave "" = todo el inventario). */
export async function ultimosConteos(db: BodegaDB): Promise<Map<string, string>> {
  const aplicados = (await db.conteos.toArray()).filter((c) => c.estado === 'aplicado');
  const mapa = new Map<string, string>();
  for (const c of aplicados) {
    const clave = c.seccionId ?? '';
    const fecha = c.aplicadoEn ?? c.creadoEn;
    if (!mapa.has(clave) || mapa.get(clave)! < fecha) mapa.set(clave, fecha);
  }
  return mapa;
}

/** Movimientos recientes de un producto (más nuevo primero). */
export async function movimientosDe(db: BodegaDB, productoId: string, limite = 5) {
  const lista = await db.movimientos.where('productoId').equals(productoId).toArray();
  return lista.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, limite);
}

// ---------- Deudas (fiados) ----------

export interface DeudaDeCliente {
  cliente: Cliente;
  deuda: number;
  /** Fecha de la venta fiada más antigua que sigue sin cubrirse del todo. */
  desde: string | null;
}

/**
 * Deuda de cada cliente. Los abonos cubren primero las ventas más antiguas,
 * así que "desde" indica cuánto lleva esperando lo que aún se debe.
 */
export async function resumenDeDeudas(db: BodegaDB): Promise<DeudaDeCliente[]> {
  const [clientes, ventas, abonos] = await Promise.all([
    db.clientes.toArray(),
    db.ventas.toArray(),
    db.abonos.toArray(),
  ]);
  return clientes.map((cliente) => {
    const fiadas = ventas
      .filter((v) => v.clienteId === cliente.id && v.metodo === 'fiado' && !v.anulada)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    let porCubrir = abonos.filter((a) => a.clienteId === cliente.id).reduce((s, a) => s + a.monto, 0);
    let desde: string | null = null;
    let deuda = 0;
    for (const v of fiadas) {
      const cubierto = Math.min(v.total, porCubrir);
      porCubrir = redondear(porCubrir - cubierto);
      const resto = redondear(v.total - cubierto);
      if (resto > 0) {
        deuda += resto;
        desde ??= v.fecha;
      }
    }
    return { cliente, deuda: redondear(deuda), desde };
  });
}

// ---------- Caja: ventas del día ----------

export interface VentaConDetalle {
  venta: Venta;
  lineas: LineaVenta[];
  cliente?: Cliente;
}

/** Ventas de un día (hora local), más nuevas primero, con sus productos. Incluye las anuladas. */
export async function ventasDelDia(db: BodegaDB, dia: string): Promise<VentaConDetalle[]> {
  const ventas = (await db.ventas.toArray())
    .filter((v) => diaLocal(v.fecha) === dia)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const [lineas, clientes] = await Promise.all([db.lineas.toArray(), db.clientes.toArray()]);
  return ventas.map((venta) => ({
    venta,
    lineas: lineas.filter((l) => l.ventaId === venta.id),
    cliente: clientes.find((c) => c.id === venta.clienteId),
  }));
}

// ---------- Respaldo ----------

const TABLAS = ['productos', 'secciones', 'clientes', 'ventas', 'lineas', 'movimientos', 'abonos', 'conteos'] as const;

export interface Respaldo {
  app: 'caserita';
  version: 1;
  creadoEn: string;
  datos: Record<(typeof TABLAS)[number], unknown[]>;
}

export async function exportarRespaldo(db: BodegaDB): Promise<Respaldo> {
  const datos = {} as Respaldo['datos'];
  for (const t of TABLAS) datos[t] = await db.table(t).toArray();
  return { app: 'caserita', version: 1, creadoEn: ahora(), datos };
}

/** Reemplaza TODO lo que hay en el celular por el respaldo. Valida antes de borrar nada. */
export async function restaurarRespaldo(db: BodegaDB, bruto: unknown): Promise<number> {
  const r = bruto as Partial<Respaldo> | null;
  if (!r || r.app !== 'caserita' || r.version !== 1 || typeof r.datos !== 'object' || !r.datos) {
    throw new ErrorDeNegocio('Este archivo no es un respaldo de Caserita');
  }
  for (const t of TABLAS) {
    if (!Array.isArray(r.datos[t])) throw new ErrorDeNegocio('El respaldo está incompleto');
  }
  await db.transaction('rw', TABLAS.map((t) => db.table(t)), async () => {
    for (const t of TABLAS) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(r.datos![t]);
    }
  });
  return r.datos.productos.length;
}

// ---------- Accesos rápidos ----------

/**
 * Ids de los productos que más se vendieron en los últimos días (por número de ventas en que aparecen).
 * Sirve para llenar la pantalla de Vender con lo que el bodeguero realmente despacha.
 */
export async function masVendidos(db: BodegaDB, dias = 30, limite = 12): Promise<string[]> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const vigentes = new Set(
    (await db.ventas.toArray()).filter((v) => !v.anulada && v.fecha >= desde).map((v) => v.id),
  );
  const veces = new Map<string, number>();
  for (const linea of await db.lineas.toArray()) {
    if (!vigentes.has(linea.ventaId) || linea.productoId === ID_VARIOS) continue;
    veces.set(linea.productoId, (veces.get(linea.productoId) ?? 0) + 1);
  }
  return [...veces.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([id]) => id);
}
