import { useEffect, useRef, useState } from 'react';
import { useCarrito } from '../carrito';
import { redondearCantidad } from '../domain/operaciones';
import type { ItemCarrito, Producto } from '../domain/types';
import { formatoCantidad, soles } from '../formato';

const aNumero = (s: string) => Number(s.replace(',', '.'));

/** Una línea de la venta: cantidad con − y +, precio editable y, por peso, kilos o monto en soles. */
export function FilaCarrito({ item, producto: p }: { item: ItemCarrito; producto: Producto }) {
  const carrito = useCarrito();
  const porPeso = p.unidad === 'kg';
  const tope = p.sinStock ? Number.POSITIVE_INFINITY : p.stock;

  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [precioNuevo, setPrecioNuevo] = useState('');
  const [kilos, setKilos] = useState(String(item.cantidad));
  const [monto, setMonto] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const enfocado = useRef(false);

  // Si la cantidad cambia por los botones (no tecleando), el campo la refleja.
  useEffect(() => {
    if (!enfocado.current) setKilos(String(item.cantidad));
  }, [item.cantidad]);

  const guardarPrecio = () => {
    const precio = aNumero(precioNuevo);
    if (Number.isFinite(precio) && precio >= 0) carrito.fijarPrecio(item.productoId, precio);
    setEditandoPrecio(false);
  };

  const escribirKilos = (texto: string) => {
    setKilos(texto);
    const n = aNumero(texto);
    if (!Number.isFinite(n) || n <= 0) return;
    setAviso(carrito.fijarCantidad(item.productoId, n, tope));
  };

  // «S/ 2 de arroz»: el peso sale del monto y el precio por kilo.
  const aplicarMonto = () => {
    const m = aNumero(monto);
    if (!(m > 0) || !(item.precio > 0)) return;
    const peso = redondearCantidad(m / item.precio);
    const mensaje = carrito.fijarCantidad(item.productoId, peso, tope);
    setAviso(mensaje);
    if (!mensaje) {
      setKilos(String(peso));
      setMonto('');
    }
  };

  const paso = porPeso ? 0.25 : 1;

  return (
    <div className="fila" style={{ flexWrap: 'wrap' }}>
      <div className="nombre">
        {p.nombre}
        {editandoPrecio ? (
          <span style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input className="campo" style={{ height: 44, fontSize: 18, width: 100 }} inputMode="decimal" value={precioNuevo} onChange={(e) => setPrecioNuevo(e.target.value)} aria-label={`Nuevo precio de ${p.nombre}`} autoFocus />
            <button className="paso mas" style={{ width: 'auto', padding: '0 14px', fontSize: 16 }} onClick={guardarPrecio}>Listo</button>
          </span>
        ) : (
          <button
            onClick={() => {
              setEditandoPrecio(true);
              setPrecioNuevo(String(item.precio));
            }}
            aria-label={`Cambiar precio de ${p.nombre}`}
            style={{ display: 'block', border: 0, background: 'none', padding: '4px 0', color: 'var(--verde)', fontWeight: 700, fontSize: 15, textDecoration: 'underline' }}
          >
            {soles(item.precio)} {porPeso ? 'por kilo' : 'c/u'} ✎
          </button>
        )}
      </div>

      <button className="paso menos" aria-label={`Quitar ${porPeso ? 'un cuarto de kilo' : 'uno'} de ${p.nombre}`} onClick={() => carrito.cambiar(item.productoId, -paso, tope)}>−</button>
      {porPeso ? (
        <label style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span className="sr-only">Kilos de {p.nombre}</span>
          <input
            inputMode="decimal"
            value={kilos}
            onFocus={(e) => { enfocado.current = true; e.target.select(); }}
            onBlur={() => { enfocado.current = false; setKilos(String(item.cantidad)); }}
            onChange={(e) => escribirKilos(e.target.value)}
            style={{ width: 70, height: 44, border: '2px solid #d9cdb8', borderRadius: 12, textAlign: 'center', fontSize: 19, fontWeight: 800, background: 'var(--crema)' }}
          />
          <b style={{ fontSize: 15 }}>kg</b>
        </label>
      ) : (
        <b style={{ minWidth: 24, textAlign: 'center', fontSize: 20 }}>{formatoCantidad(item.cantidad)}</b>
      )}
      <button className="paso mas" aria-label={`Agregar ${porPeso ? 'un cuarto de kilo' : 'uno'} de ${p.nombre}`} onClick={() => carrito.cambiar(item.productoId, paso, tope)}>+</button>

      {porPeso && (
        <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--suave)' }}>
          <label htmlFor={`monto-${p.id}`}>O por monto: S/</label>
          <input
            id={`monto-${p.id}`}
            inputMode="decimal"
            placeholder="2.00"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aplicarMonto()}
            style={{ width: 80, height: 40, border: '2px solid #d9cdb8', borderRadius: 12, textAlign: 'center', fontSize: 17, fontWeight: 800, background: 'var(--crema)' }}
          />
          <button className="paso mas" style={{ width: 'auto', height: 40, padding: '0 14px', fontSize: 15 }} onClick={aplicarMonto}>Calcular</button>
        </div>
      )}
      {aviso && <div className="error" role="alert" style={{ flexBasis: '100%' }}>{aviso}</div>}
    </div>
  );
}
