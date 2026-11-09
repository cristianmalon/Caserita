import { BODEGA_ID, type BodegaDB, ahora, nuevoId } from './db';

/** Productos de ejemplo para probar la app sin cargar nada a mano. */
export async function cargarDatosDeEjemplo(db: BodegaDB) {
  const muestra: Array<[string, string, number, number, number]> = [
    ['Pan francés', '7750001', 0.2, 0.3, 40],
    ['Pan de molde', '7750142', 6.2, 8.5, 3],
    ['Leche 400 g', '7750210', 3.6, 4.5, 24],
    ['Arroz 1 kg', '7750320', 3.4, 4.2, 0],
    ['Aceite 1 L', '7750430', 7.8, 9, 2],
    ['Gaseosa 500 ml', '7750540', 1.7, 2.5, 18],
    ['Huevos (unidad)', '7750650', 0.4, 0.5, 60],
    ['Azúcar 1 kg', '7750760', 3.0, 4, 4],
  ];
  const fecha = ahora();
  await db.productos.bulkAdd(
    muestra.map(([nombre, codigo, costo, precio, stock]) => ({
      id: nuevoId(),
      bodegaId: BODEGA_ID,
      nombre,
      codigo,
      costo,
      precio,
      stock,
      minimo: 5,
      actualizadoEn: fecha,
    })),
  );
}
