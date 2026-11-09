import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BODEGA_ID, BodegaDB, ahora, nuevoId } from '../data/db';
import {
  actualizarProducto,
  aplicarConteo,
  crearCliente,
  crearSeccion,
  eliminarSeccion,
  iniciarConteo,
  movimientosDe,
  registrarConteo,
  renombrarSeccion,
  resultadoConteo,
  ultimosConteos,
} from './gestion';
import { registrarVenta } from './operaciones';

let db: BodegaDB;

async function producto(nombre: string, stock: number, seccionId?: string, costo = 2) {
  const id = nuevoId();
  await db.productos.add({
    id, bodegaId: BODEGA_ID, nombre, costo, precio: 5, stock, minimo: 5, seccionId, actualizadoEn: ahora(),
  });
  return id;
}

beforeEach(async () => {
  db = new BodegaDB(`test-${nuevoId()}`);
  await db.open();
});

describe('clientes y secciones', () => {
  it('no permite clientes ni secciones repetidos (sin importar mayúsculas)', async () => {
    await crearCliente(db, { nombre: 'Doña Rosa', telefono: ' 999 ' });
    await expect(crearCliente(db, { nombre: 'doña rosa' })).rejects.toThrow('Ya tienes');
    await expect(crearCliente(db, { nombre: '  ' })).rejects.toThrow('nombre');
    await crearSeccion(db, 'frutas');
    await expect(crearSeccion(db, 'Frutas')).rejects.toThrow('Ya existe');
    expect((await db.secciones.toArray())[0].nombre).toBe('Frutas');
  });

  it('renombrar y eliminar mueven los productos a otra sección', async () => {
    const a = await crearSeccion(db, 'Abarrotes');
    const b = await crearSeccion(db, 'Bebidas');
    const p = await producto('Arroz', 5, a.id);
    await renombrarSeccion(db, a.id, 'Víveres');
    expect((await db.secciones.get(a.id))!.nombre).toBe('Víveres');
    await expect(renombrarSeccion(db, a.id, 'bebidas')).rejects.toThrow('Ya existe');
    await eliminarSeccion(db, a.id, b.id);
    expect((await db.productos.get(p))!.seccionId).toBe(b.id);
    expect(await db.secciones.get(a.id)).toBeUndefined();
  });
});

describe('actualizarProducto', () => {
  it('valida y guarda precio, sección y aviso', async () => {
    const s = await crearSeccion(db, 'Snacks');
    const p = await producto('Galletas', 3);
    await actualizarProducto(db, p, { precio: 3.456, minimo: 8, seccionId: s.id });
    expect(await db.productos.get(p)).toMatchObject({ precio: 3.46, minimo: 8, seccionId: s.id });
    await actualizarProducto(db, p, { seccionId: null });
    expect((await db.productos.get(p))!.seccionId).toBeUndefined();
    await expect(actualizarProducto(db, p, { precio: 0 })).rejects.toThrow('precio');
    await expect(actualizarProducto(db, p, { minimo: 1.5 })).rejects.toThrow('entero');
  });

  it('el código de barras es único, se puede quitar y repetir el propio no falla', async () => {
    const a = await producto('Galletas', 3);
    const b = await producto('Fideos', 3);
    await actualizarProducto(db, a, { codigo: ' 7750123456781 ' });
    expect((await db.productos.get(a))!.codigo).toBe('7750123456781');
    await actualizarProducto(db, a, { codigo: '7750123456781' }); // el mismo producto: sin error
    await expect(actualizarProducto(db, b, { codigo: '7750123456781' })).rejects.toThrow('Galletas');
    await actualizarProducto(db, a, { codigo: null });
    expect((await db.productos.get(a))!.codigo).toBeUndefined();
    await actualizarProducto(db, b, { codigo: '7750123456781' }); // ya quedó libre
  });
});

describe('conteo por sección', () => {
  it('compara contra lo que decía el sistema, solo dentro de la sección', async () => {
    const abarrotes = await crearSeccion(db, 'Abarrotes');
    const leche = await producto('Leche', 24, abarrotes.id, 3.6);
    const azucar = await producto('Azúcar', 4, abarrotes.id, 4);
    const aceite = await producto('Aceite', 2, abarrotes.id, 7.8);
    await producto('Gaseosa', 18); // otra sección: no entra

    const conteo = await iniciarConteo(db, abarrotes.id);
    await registrarConteo(db, conteo.id, leche, 22);
    await registrarConteo(db, conteo.id, azucar, 3);
    await registrarConteo(db, conteo.id, aceite, 3);

    const r = await resultadoConteo(db, conteo.id);
    expect(r).toMatchObject({ total: 3, contados: 3, sinContar: 0, coinciden: 0 });
    expect(r.diferencias.map((d) => d.diferencia).sort()).toEqual([-1, -2, 1].sort());
    expect(r.diferenciaACosto).toBe(-3.4); // -2*3.6 -1*4 +1*7.8
  });

  it('retoma el conteo abierto y conserva el "sistema" de la primera vez', async () => {
    const p = await producto('Leche', 10);
    const c1 = await iniciarConteo(db, null);
    await registrarConteo(db, c1.id, p, 8);
    expect((await iniciarConteo(db, null)).id).toBe(c1.id);
    await registrarConteo(db, c1.id, p, 9); // corrige: sigue comparando contra 10
    expect((await db.conteos.get(c1.id))!.lineas[p]).toEqual({ contado: 9, sistema: 10 });
  });

  it('aplicar suma la diferencia al stock de ahora, sin pisar ventas hechas mientras se contaba', async () => {
    const p = await producto('Leche', 10);
    const c = await iniciarConteo(db, null);
    await registrarConteo(db, c.id, p, 8); // faltan 2
    await registrarVenta(db, { items: [{ productoId: p, cantidad: 3, precio: 5 }], metodo: 'digital' });
    // stock real ahora: 7. Faltan 2 más => 5 (no 8, que pisaría la venta)
    expect(await aplicarConteo(db, c.id)).toBe(1);
    expect((await db.productos.get(p))!.stock).toBe(5);
    const movs = await movimientosDe(db, p);
    expect(movs.find((m) => m.tipo === 'conteo')).toMatchObject({ cantidad: -2, ref: c.id });
    await expect(aplicarConteo(db, c.id)).rejects.toThrow('ya se aplicó');
    await expect(registrarConteo(db, c.id, p, 1)).rejects.toThrow('terminó');
  });

  it('registra cuándo se contó cada sección', async () => {
    const s = await crearSeccion(db, 'Bebidas');
    const c = await iniciarConteo(db, s.id);
    expect((await ultimosConteos(db)).has(s.id)).toBe(false);
    await aplicarConteo(db, c.id);
    expect((await ultimosConteos(db)).has(s.id)).toBe(true);
  });

  it('rechaza cantidades inválidas', async () => {
    const p = await producto('Leche', 10);
    const c = await iniciarConteo(db, null);
    await expect(registrarConteo(db, c.id, p, -1)).rejects.toThrow('no es válida');
    await expect(registrarConteo(db, c.id, p, 1.5)).rejects.toThrow('entero');
  });
});

import { registrarAbono } from './operaciones';
import { resumenDeDeudas } from './gestion';

describe('resumenDeDeudas', () => {
  it('los abonos cubren primero lo más antiguo y "desde" apunta a lo que sigue pendiente', async () => {
    const rosa = await crearCliente(db, { nombre: 'Rosa' });
    const sinDeuda = await crearCliente(db, { nombre: 'Pedro' });
    const p = await producto('Arroz', 50);
    const fiar = (cantidad: number, fecha: string) =>
      registrarVenta(db, { items: [{ productoId: p, cantidad, precio: 10 }], metodo: 'fiado', clienteId: rosa.id })
        .then((v) => db.ventas.update(v.id, { fecha }));
    await fiar(2, '2026-11-01T10:00:00.000Z'); // 20
    await fiar(3, '2026-11-05T10:00:00.000Z'); // 30
    await registrarAbono(db, rosa.id, 25); // cubre los 20 y 5 de los 30

    const r = await resumenDeDeudas(db);
    const de = (id: string) => r.find((x) => x.cliente.id === id)!;
    expect(de(rosa.id)).toMatchObject({ deuda: 25, desde: '2026-11-05T10:00:00.000Z' });
    expect(de(sinDeuda.id)).toMatchObject({ deuda: 0, desde: null });
  });
});

import { anularVenta, resumenDeCaja, diaLocal } from './operaciones';
import { exportarRespaldo, restaurarRespaldo, ventasDelDia } from './gestion';

describe('caja del día', () => {
  it('calcula la ganancia y excluye las ventas anuladas; el detalle sí las incluye', async () => {
    const rosa = await crearCliente(db, { nombre: 'Rosa' });
    const a = await producto('Leche', 20, undefined, 3); // precio 5, costo 3 => 2 por unidad
    const v1 = await registrarVenta(db, { items: [{ productoId: a, cantidad: 4, precio: 5 }], metodo: 'efectivo' });
    const v2 = await registrarVenta(db, { items: [{ productoId: a, cantidad: 2, precio: 4 }], metodo: 'fiado', clienteId: rosa.id }); // precio rebajado: 1 por unidad
    const hoy = diaLocal(new Date());
    expect((await resumenDeCaja(db, hoy)).ganancia).toBe(10); // 4*2 + 2*1
    await anularVenta(db, v2.id);
    expect((await resumenDeCaja(db, hoy)).ganancia).toBe(8);

    const lista = await ventasDelDia(db, hoy);
    expect(lista).toHaveLength(2);
    expect(lista.find((x) => x.venta.id === v2.id)).toMatchObject({ venta: { anulada: true }, cliente: { nombre: 'Rosa' } });
    expect(lista.find((x) => x.venta.id === v1.id)!.lineas).toHaveLength(1);
    expect(await ventasDelDia(db, '2000-01-01')).toEqual([]);
  });
});

describe('respaldo', () => {
  it('exporta y restaura todo en otra base, y rechaza archivos que no son respaldos', async () => {
    const s = await crearSeccion(db, 'Abarrotes');
    const p = await producto('Arroz', 10, s.id);
    const rosa = await crearCliente(db, { nombre: 'Rosa' });
    await registrarVenta(db, { items: [{ productoId: p, cantidad: 2, precio: 5 }], metodo: 'fiado', clienteId: rosa.id });
    const copia = JSON.parse(JSON.stringify(await exportarRespaldo(db)));

    const otra = new BodegaDB(`test-${nuevoId()}`);
    await otra.open();
    await otra.productos.add({ id: 'viejo', bodegaId: BODEGA_ID, nombre: 'Se borra', costo: 1, precio: 2, stock: 1, minimo: 5, actualizadoEn: ahora() });
    expect(await restaurarRespaldo(otra, copia)).toBe(1);
    expect(await otra.productos.get('viejo')).toBeUndefined();
    expect((await otra.productos.get(p))!.stock).toBe(8);
    expect(await otra.ventas.count()).toBe(1);
    expect(await otra.lineas.count()).toBe(1);

    await expect(restaurarRespaldo(otra, { hola: 1 })).rejects.toThrow('no es un respaldo');
    await expect(restaurarRespaldo(otra, { app: 'caserita', version: 1, datos: { productos: [] } })).rejects.toThrow('incompleto');
    expect((await otra.productos.get(p))!.stock).toBe(8); // un archivo inválido no borra nada
  });
});
