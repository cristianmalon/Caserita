# Caserita

App web (PWA) para llevar una bodega de barrio: vender escaneando o buscando, cobrar en efectivo con vuelto o por Yape, y (próximamente) fiados, inventario y conteo por sección.

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
