import Dexie, { type EntityTable } from 'dexie';
import type {
  Abono,
  Cliente,
  Conteo,
  LineaVenta,
  Movimiento,
  Producto,
  Seccion,
  Venta,
} from '../domain/types';

/** Hoy hay una sola bodega por instalación. Al replicar, cada una tiene su id. */
export const BODEGA_ID = 'local';

export class BodegaDB extends Dexie {
  productos!: EntityTable<Producto, 'id'>;
  secciones!: EntityTable<Seccion, 'id'>;
  clientes!: EntityTable<Cliente, 'id'>;
  ventas!: EntityTable<Venta, 'id'>;
  lineas!: EntityTable<LineaVenta, 'id'>;
  movimientos!: EntityTable<Movimiento, 'id'>;
  abonos!: EntityTable<Abono, 'id'>;
  conteos!: EntityTable<Conteo, 'id'>;

  constructor(nombre = 'mi-bodega') {
    super(nombre);
    this.version(1).stores({
      productos: 'id, codigo, nombre, seccionId',
      secciones: 'id, nombre',
      clientes: 'id, nombre',
      ventas: 'id, fecha, clienteId',
      lineas: 'id, ventaId, productoId',
      movimientos: 'id, productoId, fecha',
      abonos: 'id, clienteId, fecha',
    });
    // v2: conteos de inventario por sección
    this.version(2).stores({
      conteos: 'id, estado, seccionId',
    });
  }
}

export const db = new BodegaDB();

export const nuevoId = (): string => crypto.randomUUID();
export const ahora = (): string => new Date().toISOString();
