import { type ReactNode, createContext, useContext, useMemo, useState } from 'react';
import { totalCarrito } from './domain/operaciones';
import type { ItemCarrito, Producto } from './domain/types';

interface Carrito {
  items: ItemCarrito[];
  total: number;
  clienteId: string | null; // cliente de la venta (opcional; obligatorio para fiar)
  seleccionarCliente: (id: string | null) => void;
  agregar: (producto: Producto) => string | null; // devuelve un mensaje si no se pudo
  cambiar: (productoId: string, delta: number, stockMaximo: number) => void;
  fijarPrecio: (productoId: string, precio: number) => void;
  vaciar: () => void;
}

const Contexto = createContext<Carrito | null>(null);

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);

  const valor = useMemo<Carrito>(
    () => ({
      items,
      total: totalCarrito(items),
      clienteId,
      seleccionarCliente: setClienteId,
      agregar: (producto) => {
        const actual = items.find((i) => i.productoId === producto.id);
        const cantidad = (actual?.cantidad ?? 0) + 1;
        if (cantidad > producto.stock) return `No alcanza el stock de ${producto.nombre}`;
        setItems(
          actual
            ? items.map((i) => (i.productoId === producto.id ? { ...i, cantidad } : i))
            : [...items, { productoId: producto.id, cantidad: 1, precio: producto.precio }],
        );
        return null;
      },
      cambiar: (productoId, delta, stockMaximo) =>
        setItems((prev) =>
          prev
            .map((i) =>
              i.productoId === productoId
                ? { ...i, cantidad: Math.min(i.cantidad + delta, stockMaximo) }
                : i,
            )
            .filter((i) => i.cantidad > 0),
        ),
      fijarPrecio: (productoId, precio) =>
        setItems((prev) => prev.map((i) => (i.productoId === productoId ? { ...i, precio } : i))),
      vaciar: () => {
        setItems([]);
        setClienteId(null);
      },
    }),
    [items, clienteId],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCarrito(): Carrito {
  const c = useContext(Contexto);
  if (!c) throw new Error('useCarrito fuera de CarritoProvider');
  return c;
}
