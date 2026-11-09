import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BODEGA_ID, BodegaDB, ahora, nuevoId } from '../data/db';
import {
  ErrorDeNegocio,
  ID_VARIOS,
  ajustarStock,
  anularVenta,
  asegurarVarios,
  crearProducto,
  deudaDeCliente,
  diaLocal,
  ingresarMercaderia,
  redondear,
  registrarAbono,
  registrarVenta,
  resumenDeCaja,
  totalCarrito,
} from './operaciones';

let db: BodegaDB;

async function producto(nombre: string, precio: number, stock: number, costo = 1) {
  const id = nuevoId();
  await db.productos.add({
    id,
    bodegaId: BODEGA_ID,
    nombre,
    costo,
    precio,
    stock,
    minimo: 5,
    actualizadoEn: ahora(),
  });
  return id;
}

async function cliente(nombre: string) {
  const id = nuevoId();
  await db.clientes.add({ id, bodegaId: BODEGA_ID, nombre });
  return id;
}

beforeEach(async () => {
  db = new BodegaDB(`test-${nuevoId()}`);
  await db.open();
});

describe('dinero', () => {
  it('no arrastra errores de coma flotante', () => {
    expect(redondear(0.3 * 4)).toBe(1.2);
    expect(totalCarrito([{ productoId: 'a', cantidad: 4, precio: 0.3 }])).toBe(1.2);
  });
});

describe('registrarVenta', () => {
  it('descuenta stock y guarda líneas y movimientos', async () => {
    const pan = await producto('Pan', 0.3, 40);
    const venta = await registrarVenta(db, {
      items: [{ productoId: pan, cantidad: 4, precio: 0.3 }],
      metodo: 'efectivo',
      pagoCon: 5,
    });
    expect(venta.total).toBe(1.2);
    expect(venta.vuelto).toBe(3.8);
    expect((await db.productos.get(pan))!.stock).toBe(36);
    expect(await db.lineas.count()).toBe(1);
    const [mov] = await db.movimientos.toArray();
    expect(mov).toMatchObject({ tipo: 'venta', cantidad: -4, ref: venta.id });
  });

  it('usa el precio editado "solo esta venta" sin tocar el catálogo', async () => {
    const gaseosa = await producto('Gaseosa', 2.5, 10);
    await registrarVenta(db, {
      items: [{ productoId: gaseosa, cantidad: 1, precio: 3 }],
      metodo: 'digital',
    });
    expect((await db.productos.get(gaseosa))!.precio).toBe(2.5);
    expect((await db.lineas.toArray())[0].precio).toBe(3);
  });

  it('rechaza si no alcanza el stock y no deja nada a medias', async () => {
    const a = await producto('A', 1, 10);
    const b = await producto('B', 1, 1);
    await expect(
      registrarVenta(db, {
        items: [
          { productoId: a, cantidad: 2, precio: 1 },
          { productoId: b, cantidad: 5, precio: 1 },
        ],
        metodo: 'efectivo',
      }),
    ).rejects.toBeInstanceOf(ErrorDeNegocio);
    expect((await db.productos.get(a))!.stock).toBe(10);
    expect(await db.ventas.count()).toBe(0);
    expect(await db.lineas.count()).toBe(0);
  });

  it('exige cliente para fiar y efectivo suficiente', async () => {
    const a = await producto('A', 5, 10);
    await expect(
      registrarVenta(db, { items: [{ productoId: a, cantidad: 1, precio: 5 }], metodo: 'fiado' }),
    ).rejects.toThrow('cliente');
    await expect(
      registrarVenta(db, {
        items: [{ productoId: a, cantidad: 1, precio: 5 }],
        metodo: 'efectivo',
        pagoCon: 4,
      }),
    ).rejects.toThrow('menor');
  });
});

describe('fiados', () => {
  it('la deuda es lo fiado menos los abonos', async () => {
    const a = await producto('A', 10, 10);
    const rosa = await cliente('Rosa');
    await registrarVenta(db, {
      items: [{ productoId: a, cantidad: 3, precio: 10 }],
      metodo: 'fiado',
      clienteId: rosa,
    });
    expect(await deudaDeCliente(db, rosa)).toBe(30);
    await registrarAbono(db, rosa, 12.5);
    expect(await deudaDeCliente(db, rosa)).toBe(17.5);
    await expect(registrarAbono(db, rosa, 100)).rejects.toThrow('mayor');
  });
});

describe('anularVenta', () => {
  it('devuelve el stock y quita la venta de caja y deuda', async () => {
    const a = await producto('A', 10, 10);
    const rosa = await cliente('Rosa');
    const venta = await registrarVenta(db, {
      items: [{ productoId: a, cantidad: 2, precio: 10 }],
      metodo: 'fiado',
      clienteId: rosa,
    });
    await anularVenta(db, venta.id);
    expect((await db.productos.get(a))!.stock).toBe(10);
    expect(await deudaDeCliente(db, rosa)).toBe(0);
    expect((await resumenDeCaja(db, diaLocal(new Date()))).total).toBe(0);
    await expect(anularVenta(db, venta.id)).rejects.toThrow('anulada');
  });
});

describe('inventario', () => {
  it('ingresar mercadería suma stock y actualiza el costo', async () => {
    const a = await producto('A', 10, 3, 6.2);
    await ingresarMercaderia(db, [{ productoId: a, cantidad: 12, costo: 6.5 }]);
    const p = (await db.productos.get(a))!;
    expect(p.stock).toBe(15);
    expect(p.costo).toBe(6.5);
  });

  it('ajustar por conteo registra solo la diferencia', async () => {
    const a = await producto('A', 10, 24);
    await ajustarStock(db, a, 22, 'conteo', 'conteo-1');
    expect((await db.productos.get(a))!.stock).toBe(22);
    expect((await db.movimientos.toArray())[0]).toMatchObject({ tipo: 'conteo', cantidad: -2 });
    await ajustarStock(db, a, 22, 'conteo'); // sin diferencia: no crea movimiento
    expect(await db.movimientos.count()).toBe(1);
  });
});

describe('resumenDeCaja', () => {
  it('separa efectivo, digital y fiado y suma cobros de fiados', async () => {
    const a = await producto('A', 10, 50);
    const rosa = await cliente('Rosa');
    const v = (metodo: 'efectivo' | 'digital' | 'fiado', cantidad: number) =>
      registrarVenta(db, {
        items: [{ productoId: a, cantidad, precio: 10 }],
        metodo,
        clienteId: metodo === 'fiado' ? rosa : undefined,
      });
    await v('efectivo', 2);
    await v('digital', 1);
    await v('fiado', 3);
    await registrarAbono(db, rosa, 5);
    const r = await resumenDeCaja(db, diaLocal(new Date()));
    expect(r).toMatchObject({
      total: 60,
      efectivo: 20,
      digital: 10,
      fiado: 30,
      cobrosDeFiados: 5,
      efectivoEnCaja: 25,
      cantidadVentas: 3,
    });
  });
});

describe('crearProducto', () => {
  it('guarda el producto y registra el stock inicial como ingreso', async () => {
    const p = await crearProducto(db, { nombre: ' Galletas ', codigo: '7750123', precio: 3.5, stock: 12 });
    expect(p.nombre).toBe('Galletas');
    expect((await db.productos.get(p.id))!.stock).toBe(12);
    expect(await db.movimientos.toArray()).toMatchObject([{ tipo: 'ingreso', cantidad: 12 }]);
  });

  it('rechaza datos incompletos y códigos repetidos', async () => {
    await expect(crearProducto(db, { nombre: ' ', precio: 1, stock: 1 })).rejects.toThrow('nombre');
    await expect(crearProducto(db, { nombre: 'A', precio: 0, stock: 1 })).rejects.toThrow('precio');
    await expect(crearProducto(db, { nombre: 'A', precio: 1, stock: 1.5 })).rejects.toThrow('entero');
    await crearProducto(db, { nombre: 'A', codigo: '123', precio: 1, stock: 1 });
    await expect(
      crearProducto(db, { nombre: 'B', codigo: '123', precio: 1, stock: 1 }),
    ).rejects.toThrow('código');
  });
});


describe('productos por peso', () => {
  async function arroz(stock = 20) {
    const p = await crearProducto(db, { nombre: 'Arroz suelto', precio: 4.2, costo: 3.4, stock, unidad: 'kg' });
    return p.id;
  }

  it('vende fracciones de kilo, descuenta con exactitud y redondea el total por línea', async () => {
    const a = await arroz();
    const v = await registrarVenta(db, { items: [{ productoId: a, cantidad: 0.75, precio: 4.2 }], metodo: 'efectivo' });
    expect(v.total).toBe(3.15);
    expect((await db.productos.get(a))!.stock).toBe(19.25);
    expect((await db.lineas.toArray())[0]).toMatchObject({ unidad: 'kg', cantidad: 0.75 });
    // 0.1 + 0.2 no debe dejar basura de coma flotante
    await registrarVenta(db, { items: [{ productoId: a, cantidad: 0.1, precio: 4.2 }], metodo: 'efectivo' });
    await registrarVenta(db, { items: [{ productoId: a, cantidad: 0.2, precio: 4.2 }], metodo: 'efectivo' });
    expect((await db.productos.get(a))!.stock).toBe(18.95);
  });

  it('rechaza decimales en productos por unidad y más de 3 decimales por kilo', async () => {
    const a = await arroz();
    const leche = await crearProducto(db, { nombre: 'Leche', precio: 4, stock: 5 });
    await expect(registrarVenta(db, { items: [{ productoId: leche.id, cantidad: 1.5, precio: 4 }], metodo: 'efectivo' })).rejects.toThrow('entero');
    await expect(registrarVenta(db, { items: [{ productoId: a, cantidad: 0.1234, precio: 4.2 }], metodo: 'efectivo' })).rejects.toThrow('3 decimales');
    await expect(crearProducto(db, { nombre: 'Frijol', precio: 5, stock: 1.5 })).rejects.toThrow('entero');
    expect(await db.ventas.count()).toBe(0);
  });

  it('el total por línea redondeada coincide con lo que se muestra', () => {
    // 3 líneas de 0.333 kg a S/ 1.00: 0.33 cada una => 0.99 (no 1.00)
    const item = { productoId: 'x', cantidad: 0.333, precio: 1 };
    expect(totalCarrito([item, item, item])).toBe(0.99);
  });

  it('ingreso, ajuste y anulación conservan los decimales', async () => {
    const a = await arroz(10);
    await ingresarMercaderia(db, [{ productoId: a, cantidad: 12.5, costo: 3.5 }]);
    expect((await db.productos.get(a))!.stock).toBe(22.5);
    await ajustarStock(db, a, 22.125);
    expect((await db.productos.get(a))!.stock).toBe(22.125);
    const v = await registrarVenta(db, { items: [{ productoId: a, cantidad: 2.125, precio: 4.2 }], metodo: 'digital' });
    await anularVenta(db, v.id);
    expect((await db.productos.get(a))!.stock).toBe(22.125);
  });
});

describe('venta rápida («Varios»)', () => {
  it('se vende sin inventario, no entra a movimientos y no infla la ganancia', async () => {
    const varios = await asegurarVarios(db);
    expect(await asegurarVarios(db)).toEqual(varios); // idempotente
    expect(await db.productos.count()).toBe(1);

    const v = await registrarVenta(db, { items: [{ productoId: ID_VARIOS, cantidad: 1, precio: 5 }], metodo: 'efectivo' });
    expect(v.total).toBe(5);
    expect(await db.movimientos.count()).toBe(0);
    expect((await db.productos.get(ID_VARIOS))!.stock).toBe(0);
    const r = await resumenDeCaja(db, diaLocal(new Date()));
    expect(r).toMatchObject({ total: 5, ganancia: 0 });

    await anularVenta(db, v.id); // anular tampoco toca inventario
    expect(await db.movimientos.count()).toBe(0);
  });
});
