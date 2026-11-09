import { BODEGA_ID, type BodegaDB, ahora, nuevoId } from '../data/db';
import type { ItemCarrito, MetodoPago, Venta } from './types';

/** Evita errores de coma flotante (0.3 * 4 = 1.2000000000000002). */
export const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const totalCarrito = (items: ItemCarrito[]): number =>
  redondear(items.reduce((suma, i) => suma + i.cantidad * i.precio, 0));

export class ErrorDeNegocio extends Error {}

/** Día local (AAAA-MM-DD) de una fecha ISO. La caja se cierra en hora del celular, no en UTC. */
export const diaLocal = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

export interface EntradaVenta {
  items: ItemCarrito[];
  metodo: MetodoPago;
  clienteId?: string;
  /** Efectivo recibido; solo para método "efectivo". */
  pagoCon?: number;
}

/** Registra la venta, sus líneas y descuenta stock, todo o nada. */
export async function registrarVenta(db: BodegaDB, entrada: EntradaVenta): Promise<Venta> {
  const { items, metodo, clienteId, pagoCon } = entrada;
  if (items.length === 0) throw new ErrorDeNegocio('La venta no tiene productos');
  if (items.some((i) => i.cantidad <= 0 || i.precio < 0)) {
    throw new ErrorDeNegocio('Cantidad o precio inválido');
  }
  if (metodo === 'fiado' && !clienteId) {
    throw new ErrorDeNegocio('Para fiar hay que elegir un cliente');
  }

  const total = totalCarrito(items);
  if (metodo === 'efectivo' && pagoCon !== undefined && pagoCon < total) {
    throw new ErrorDeNegocio('El efectivo recibido es menor al total');
  }

  return db.transaction('rw', [db.productos, db.ventas, db.lineas, db.movimientos], async () => {
    const fecha = ahora();
    const venta: Venta = {
      id: nuevoId(),
      bodegaId: BODEGA_ID,
      fecha,
      total,
      metodo,
      clienteId,
      ...(metodo === 'efectivo' && pagoCon !== undefined
        ? { pagoCon, vuelto: redondear(pagoCon - total) }
        : {}),
    };

    for (const item of items) {
      const producto = await db.productos.get(item.productoId);
      if (!producto) throw new ErrorDeNegocio('Producto no encontrado');
      if (producto.stock < item.cantidad) {
        throw new ErrorDeNegocio(`No alcanza el stock de ${producto.nombre}`);
      }
      await db.productos.update(producto.id, {
        stock: producto.stock - item.cantidad,
        actualizadoEn: fecha,
      });
      await db.lineas.add({
        id: nuevoId(),
        ventaId: venta.id,
        productoId: producto.id,
        nombre: producto.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        costo: producto.costo,
      });
      await db.movimientos.add({
        id: nuevoId(),
        bodegaId: BODEGA_ID,
        productoId: producto.id,
        tipo: 'venta',
        cantidad: -item.cantidad,
        ref: venta.id,
        fecha,
      });
    }

    await db.ventas.add(venta);
    return venta;
  });
}

/** Anula una venta: devuelve el stock y deja de contar en caja y en deudas. */
export async function anularVenta(db: BodegaDB, ventaId: string): Promise<void> {
  await db.transaction('rw', [db.productos, db.ventas, db.lineas, db.movimientos], async () => {
    const venta = await db.ventas.get(ventaId);
    if (!venta) throw new ErrorDeNegocio('Venta no encontrada');
    if (venta.anulada) throw new ErrorDeNegocio('La venta ya estaba anulada');

    const fecha = ahora();
    const lineas = await db.lineas.where('ventaId').equals(ventaId).toArray();
    for (const linea of lineas) {
      const producto = await db.productos.get(linea.productoId);
      if (producto) {
        await db.productos.update(producto.id, {
          stock: producto.stock + linea.cantidad,
          actualizadoEn: fecha,
        });
      }
      await db.movimientos.add({
        id: nuevoId(),
        bodegaId: BODEGA_ID,
        productoId: linea.productoId,
        tipo: 'anulacion',
        cantidad: linea.cantidad,
        ref: ventaId,
        fecha,
      });
    }
    await db.ventas.update(ventaId, { anulada: true });
  });
}

/** Lo que el cliente debe: ventas fiadas vigentes menos abonos. */
export async function deudaDeCliente(db: BodegaDB, clienteId: string): Promise<number> {
  const ventas = await db.ventas.where('clienteId').equals(clienteId).toArray();
  const fiado = ventas
    .filter((v) => v.metodo === 'fiado' && !v.anulada)
    .reduce((s, v) => s + v.total, 0);
  const abonos = await db.abonos.where('clienteId').equals(clienteId).toArray();
  const pagado = abonos.reduce((s, a) => s + a.monto, 0);
  return redondear(fiado - pagado);
}

export async function registrarAbono(db: BodegaDB, clienteId: string, monto: number) {
  if (monto <= 0) throw new ErrorDeNegocio('El abono debe ser mayor a cero');
  const deuda = await deudaDeCliente(db, clienteId);
  if (monto > deuda) throw new ErrorDeNegocio('El abono es mayor a lo que debe');
  await db.abonos.add({
    id: nuevoId(),
    bodegaId: BODEGA_ID,
    clienteId,
    monto: redondear(monto),
    fecha: ahora(),
  });
}

export interface LineaIngreso {
  productoId: string;
  cantidad: number;
  costo: number;
}

/** Entrada de mercadería: suma stock y actualiza el costo de compra. */
export async function ingresarMercaderia(db: BodegaDB, lineas: LineaIngreso[]) {
  if (lineas.length === 0) throw new ErrorDeNegocio('No hay productos para ingresar');
  if (lineas.some((l) => l.cantidad <= 0 || l.costo < 0)) {
    throw new ErrorDeNegocio('Cantidad o costo inválido');
  }
  const ingresoId = nuevoId();
  await db.transaction('rw', [db.productos, db.movimientos], async () => {
    const fecha = ahora();
    for (const l of lineas) {
      const producto = await db.productos.get(l.productoId);
      if (!producto) throw new ErrorDeNegocio('Producto no encontrado');
      await db.productos.update(producto.id, {
        stock: producto.stock + l.cantidad,
        costo: l.costo,
        actualizadoEn: fecha,
      });
      await db.movimientos.add({
        id: nuevoId(),
        bodegaId: BODEGA_ID,
        productoId: producto.id,
        tipo: 'ingreso',
        cantidad: l.cantidad,
        ref: ingresoId,
        fecha,
      });
    }
  });
}

/** Deja el stock en lo contado y registra la diferencia como movimiento. */
export async function ajustarStock(
  db: BodegaDB,
  productoId: string,
  contado: number,
  tipo: 'ajuste' | 'conteo' = 'ajuste',
  ref?: string,
) {
  if (contado < 0 || !Number.isFinite(contado)) throw new ErrorDeNegocio('Cantidad inválida');
  await db.transaction('rw', [db.productos, db.movimientos], async () => {
    const producto = await db.productos.get(productoId);
    if (!producto) throw new ErrorDeNegocio('Producto no encontrado');
    const diferencia = contado - producto.stock;
    if (diferencia === 0) return;
    const fecha = ahora();
    await db.productos.update(productoId, { stock: contado, actualizadoEn: fecha });
    await db.movimientos.add({
      id: nuevoId(),
      bodegaId: BODEGA_ID,
      productoId,
      tipo,
      cantidad: diferencia,
      ref,
      fecha,
    });
  });
}

/** Resumen de caja de un día (fecha local en formato AAAA-MM-DD). */
export async function resumenDeCaja(db: BodegaDB, dia: string) {
  const ventas = (await db.ventas.toArray()).filter(
    (v) => !v.anulada && diaLocal(v.fecha) === dia,
  );
  const suma = (m: MetodoPago) =>
    redondear(ventas.filter((v) => v.metodo === m).reduce((s, v) => s + v.total, 0));
  const idsVigentes = new Set(ventas.map((v) => v.id));
  const lineas = (await db.lineas.toArray()).filter((l) => idsVigentes.has(l.ventaId));
  const ganancia = redondear(lineas.reduce((s, l) => s + l.cantidad * (l.precio - l.costo), 0));
  const abonos = (await db.abonos.toArray()).filter((a) => diaLocal(a.fecha) === dia);
  const cobrosDeFiados = redondear(abonos.reduce((s, a) => s + a.monto, 0));
  const efectivo = suma('efectivo');
  return {
    total: redondear(ventas.reduce((s, v) => s + v.total, 0)),
    efectivo,
    digital: suma('digital'),
    fiado: suma('fiado'),
    cobrosDeFiados,
    efectivoEnCaja: redondear(efectivo + cobrosDeFiados),
    ganancia,
    cantidadVentas: ventas.length,
  };
}

export interface DatosProducto {
  nombre: string;
  codigo?: string;
  precio: number;
  costo?: number;
  stock: number;
  minimo?: number;
  seccionId?: string;
}

/** Crea un producto nuevo. El stock inicial queda registrado como un ingreso. */
export async function crearProducto(db: BodegaDB, datos: DatosProducto) {
  const limpio = datos.nombre.trim();
  const nombre = limpio.charAt(0).toUpperCase() + limpio.slice(1);
  const codigo = datos.codigo?.trim() || undefined;
  if (!nombre) throw new ErrorDeNegocio('Escribe el nombre del producto');
  if (!(datos.precio > 0)) throw new ErrorDeNegocio('Escribe el precio de venta');
  if (datos.stock < 0 || !Number.isInteger(datos.stock)) {
    throw new ErrorDeNegocio('La cantidad debe ser un número entero');
  }
  if (codigo && (await db.productos.where('codigo').equals(codigo).count()) > 0) {
    throw new ErrorDeNegocio('Ya existe un producto con ese código');
  }

  const producto = {
    id: nuevoId(),
    bodegaId: BODEGA_ID,
    nombre,
    codigo,
    costo: redondear(datos.costo ?? 0),
    precio: redondear(datos.precio),
    stock: datos.stock,
    minimo: datos.minimo ?? 5,
    seccionId: datos.seccionId,
    actualizadoEn: ahora(),
  };

  await db.transaction('rw', [db.productos, db.movimientos], async () => {
    await db.productos.add(producto);
    if (producto.stock > 0) {
      await db.movimientos.add({
        id: nuevoId(),
        bodegaId: BODEGA_ID,
        productoId: producto.id,
        tipo: 'ingreso',
        cantidad: producto.stock,
        fecha: producto.actualizadoEn,
      });
    }
  });
  return producto;
}
