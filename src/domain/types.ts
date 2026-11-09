// Modelo de datos. Todos los registros llevan `bodegaId` (hoy una sola bodega)
// e ids UUID, para poder sincronizar y replicar en más bodegas sin migrar.

export type Id = string;

/** Cómo se cuenta un producto: por unidades enteras o por peso (kg, hasta 3 decimales). */
export type Unidad = 'unidad' | 'kg';

export interface Seccion {
  id: Id;
  bodegaId: Id;
  nombre: string;
  color: string;
}

export interface Producto {
  id: Id;
  bodegaId: Id;
  nombre: string;
  codigo?: string; // código de barras
  seccionId?: Id;
  costo: number;
  precio: number;
  stock: number; // cache; la verdad está en `movimientos`
  minimo: number; // avisar cuando queden <= minimo
  unidad?: Unidad; // sin valor = por unidad
  favorito?: boolean; // aparece fijo en la pantalla de Vender
  sinStock?: boolean; // producto "Varios" de la venta rápida: no lleva inventario
  actualizadoEn: string;
}

export interface Cliente {
  id: Id;
  bodegaId: Id;
  nombre: string;
  telefono?: string;
}

export type MetodoPago = 'efectivo' | 'digital' | 'fiado';

export interface Venta {
  id: Id;
  bodegaId: Id;
  fecha: string; // ISO
  total: number;
  metodo: MetodoPago;
  clienteId?: Id;
  pagoCon?: number; // efectivo recibido
  vuelto?: number;
  anulada?: boolean;
}

export interface LineaVenta {
  id: Id;
  ventaId: Id;
  productoId: Id;
  nombre: string; // copia, por si luego cambia el nombre
  unidad?: Unidad;
  cantidad: number;
  precio: number; // precio al que se vendió (puede diferir del catálogo)
  costo: number;
}

export type TipoMovimiento = 'venta' | 'ingreso' | 'ajuste' | 'conteo' | 'anulacion';

export interface Movimiento {
  id: Id;
  bodegaId: Id;
  productoId: Id;
  tipo: TipoMovimiento;
  cantidad: number; // con signo: +entra, -sale
  ref?: Id; // venta, ingreso o conteo que lo originó
  fecha: string;
}

export interface Abono {
  id: Id;
  bodegaId: Id;
  clienteId: Id;
  monto: number;
  fecha: string;
}

/** Línea del carrito antes de cobrar. */
export interface ItemCarrito {
  productoId: Id;
  cantidad: number;
  precio: number; // editable al vender ("solo esta venta")
}

/** Una línea contada: cuánto había según el sistema en ese momento y cuánto contó la persona. */
export interface LineaConteo {
  contado: number;
  sistema: number;
}

/** Conteo de inventario por sección (o de todo si `seccionId` es null). Se guarda solo. */
export interface Conteo {
  id: Id;
  bodegaId: Id;
  seccionId: Id | null;
  estado: 'abierto' | 'aplicado';
  creadoEn: string;
  aplicadoEn?: string;
  lineas: Record<Id, LineaConteo>;
}
