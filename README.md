# Caserita

App web (PWA) para llevar una bodega de barrio: vender escaneando con la cámara o buscando, cobrar en efectivo con vuelto o por Yape, fiados con abonos y recordatorio por WhatsApp, inventario con ingreso de mercadería, conteo por sección a ciegas, caja del día con anulación de ventas, productos por peso, favoritos y venta rápida, importación de productos desde Excel/CSV, y respaldo de los datos con aviso.

Los datos se guardan en el celular (IndexedDB), así que funciona sin internet. Cada registro lleva `bodegaId` e ids únicos para poder sincronizar y replicar en más bodegas más adelante.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # pruebas de la lógica de negocio (vitest)
npm run build    # genera dist/ (PWA con service worker)
```

## Estructura

- `src/domain/` lógica de negocio sin pantallas (ventas, fiados, stock, caja) y sus pruebas
- `src/data/` base de datos local (Dexie) y datos de ejemplo
- `src/pages/` pantallas
- `src/carrito.tsx` estado del carrito de la venta

## Publicar en Cloudflare Pages

Conectar este repositorio con: comando de compilación `npm run build`, carpeta de salida `dist`, carpeta raíz `/`.
