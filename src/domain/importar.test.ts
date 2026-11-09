import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BodegaDB, nuevoId } from '../data/db';
import { crearProducto } from './operaciones';
import { clasificarProductos, importarProductos, interpretarProductos, leerCsv, leerNumero, plantillaCsv } from './importar';

let db: BodegaDB;
beforeEach(async () => {
  db = new BodegaDB(`test-${nuevoId()}`);
  await db.open();
});

describe('leerCsv', () => {
  it('detecta coma, punto y coma y tabulación (pegado desde Excel)', () => {
    expect(leerCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    expect(leerCsv('a;b;c\r\n1;2,5;3')).toEqual([['a', 'b', 'c'], ['1', '2,5', '3']]);
    expect(leerCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('respeta comillas, comillas dobles, saltos de línea internos, BOM y líneas vacías', () => {
    const texto = '﻿nombre,nota\n"Pan, de molde","dice ""hola"""\n\n"Dos\nlíneas",x\n';
    expect(leerCsv(texto)).toEqual([['nombre', 'nota'], ['Pan, de molde', 'dice "hola"'], ['Dos\nlíneas', 'x']]);
  });
});

describe('leerNumero', () => {
  it('entiende los formatos de precio más comunes', () => {
    expect(leerNumero('3.50')).toBe(3.5);
    expect(leerNumero('3,50')).toBe(3.5);
    expect(leerNumero('S/ 3,50')).toBe(3.5);
    expect(leerNumero('1,234.50')).toBe(1234.5);
    expect(leerNumero('1.234,50')).toBe(1234.5);
    expect(leerNumero('1,234,567')).toBe(1234567);
    expect(leerNumero('12')).toBe(12);
    expect(Number.isNaN(leerNumero('abc'))).toBe(true);
    expect(Number.isNaN(leerNumero(''))).toBe(true);
  });
});

describe('interpretarProductos', () => {
  it('reconoce títulos con otros nombres, tildes y mayúsculas', () => {
    const filas = leerCsv('Producto;Precio de Venta;Precio de compra;Cantidad;Código de barras;Categoría;Unidad\nLeche;4,50;3,60;24;775;Abarrotes;unidad\nArroz;4.2;3.4;20,5;;Abarrotes;Kilos');
    const r = interpretarProductos(filas);
    expect(r.errores).toEqual([]);
    expect(r.validas[0]).toMatchObject({ fila: 2, nombre: 'Leche', precio: 4.5, costo: 3.6, stock: 24, codigo: '775', seccion: 'Abarrotes', unidad: 'unidad' });
    expect(r.validas[1]).toMatchObject({ nombre: 'Arroz', stock: 20.5, unidad: 'kg', codigo: undefined });
  });

  it('señala cada fila mala con su número y motivo, y deja pasar las buenas', () => {
    const r = interpretarProductos(leerCsv('nombre,precio,stock,codigo\nBueno,2,5,111\n,3,1,\nSin precio,,1,\nPrecio malo,abc,1,\nDecimal,2,1.5,\nRepetido,2,1,111'));
    expect(r.validas.map((v) => v.nombre)).toEqual(['Bueno']);
    expect(r.errores).toEqual([
      { fila: 3, motivo: 'falta el nombre' },
      { fila: 4, motivo: 'el precio no es válido' },
      { fila: 5, motivo: 'el precio no es válido' },
      { fila: 6, motivo: 'el stock debe ser un número entero' },
      { fila: 7, motivo: 'el código 111 ya está en la fila 2' },
    ]);
  });

  it('pide las columnas indispensables', () => {
    expect(() => interpretarProductos([])).toThrow('vacío');
    expect(() => interpretarProductos(leerCsv('precio,stock\n1,1'))).toThrow('«nombre»');
    expect(() => interpretarProductos(leerCsv('nombre,stock\nA,1'))).toThrow('«precio»');
  });

  it('la plantilla descargable es válida', () => {
    const r = interpretarProductos(leerCsv(plantillaCsv()));
    expect(r.errores).toEqual([]);
    expect(r.validas).toHaveLength(3);
    expect(r.validas.find((v) => v.nombre === 'Arroz suelto')).toMatchObject({ unidad: 'kg', stock: 20 });
  });
});

describe('importarProductos', () => {
  const leer = (csv: string) => interpretarProductos(leerCsv(csv)).validas;

  it('crea productos, secciones nuevas y el stock inicial como ingreso', async () => {
    const r = await importarProductos(db, leer(plantillaCsv()));
    expect(r).toMatchObject({ creados: 3, seccionesNuevas: 2 });
    expect(await db.productos.count()).toBe(3);
    expect((await db.secciones.toArray()).map((s) => s.nombre).sort()).toEqual(['Abarrotes', 'Bebidas']);
    expect(await db.movimientos.count()).toBe(3);
    const arroz = (await db.productos.toArray()).find((p) => p.nombre === 'Arroz suelto')!;
    expect(arroz).toMatchObject({ unidad: 'kg', stock: 20 });
    const leche = (await db.productos.toArray()).find((p) => p.nombre === 'Leche 400 g')!;
    expect((await db.secciones.get(leche.seccionId!))!.nombre).toBe('Abarrotes');
  });

  it('no toca lo que ya tienes: omite el mismo código o el mismo nombre', async () => {
    await crearProducto(db, { nombre: 'Leche 400 g', precio: 9, stock: 1, codigo: '7750210001234' });
    const existenteArroz = await crearProducto(db, { nombre: 'ARROZ  suelto', precio: 9, stock: 1 });
    const r = await importarProductos(db, leer(plantillaCsv()));
    expect(r.creados).toBe(1); // solo la gaseosa
    expect(r.repetidos.map((x) => x.nombre).sort()).toEqual(['Arroz suelto', 'Leche 400 g']);
    expect((await db.productos.get(existenteArroz.id))!.precio).toBe(9); // sin cambios
  });

  it('reutiliza secciones existentes (sin importar mayúsculas) y no duplica nombres dentro del archivo', async () => {
    await db.secciones.add({ id: 's1', bodegaId: 'local', nombre: 'Abarrotes', color: '#000' });
    const r = await importarProductos(db, leer('nombre,precio,seccion\nA,1,ABARROTES\nA,2,abarrotes\nB,3,Frutas'));
    expect(r).toMatchObject({ creados: 2, seccionesNuevas: 1 });
    expect(r.repetidos).toHaveLength(1);
    expect(await db.secciones.count()).toBe(2);
  });

  it('clasificar no escribe nada', async () => {
    await clasificarProductos(db, leer(plantillaCsv()));
    expect(await db.productos.count()).toBe(0);
  });
});
