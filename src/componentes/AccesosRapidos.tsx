import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { db } from '../data/db';
import { masVendidos } from '../domain/gestion';
import type { Producto } from '../domain/types';
import { soles } from '../formato';

interface Props {
  productos: Producto[]; // visibles (sin «Varios»)
  limite: number;
  alAgregar: (id: string) => void;
  alVentaRapida: (monto: number) => void;
}

/**
 * Lo que se vende todo el día sin escribir: primero los favoritos (marcados a mano),
 * luego lo más vendido del último mes. Y la venta rápida para lo que no está en el catálogo.
 */
export function AccesosRapidos({ productos, limite, alAgregar, alVentaRapida }: Props) {
  const ids = useLiveQuery(() => masVendidos(db, 30, 12), []) ?? [];
  const [abierta, setAbierta] = useState(false);
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const favoritos = productos.filter((p) => p.favorito).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const porId = new Map(productos.map((p) => [p.id, p]));
  const masVendidosVisibles = ids.map((id) => porId.get(id)).filter((p): p is Producto => !!p && !p.favorito);
  const tiles = [...favoritos, ...masVendidosVisibles].slice(0, limite);

  const agregarRapido = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(monto.replace(',', '.'));
    if (!(n > 0)) {
      setError('Escribe cuánto es');
      return;
    }
    alVentaRapida(n);
    setMonto('');
    setError(null);
    setAbierta(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tiles.length > 0 && (
        <section aria-label="Lo que más vendes" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ fontSize: 15, color: 'var(--suave)' }}>Lo que más vendes</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {tiles.map((p) => (
              <button
                key={p.id}
                className="fila"
                onClick={() => alAgregar(p.id)}
                disabled={p.stock <= 0}
                aria-label={`Agregar ${p.nombre}`}
                style={{ border: 0, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, minHeight: 72, padding: 10, textAlign: 'left', opacity: p.stock <= 0 ? 0.45 : 1 }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {p.favorito ? '★ ' : ''}{p.nombre}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--verde)' }}>{soles(p.precio)}{p.unidad === 'kg' ? '/kg' : ''}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {abierta ? (
        <form onSubmit={agregarRapido} className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
          <label htmlFor="monto-rapido" style={{ fontWeight: 800 }}>Venta rápida: ¿cuánto es?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="monto-rapido" className="campo" inputMode="decimal" placeholder="S/ 0.00" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus autoComplete="off" />
            <button type="submit" className="boton" style={{ minHeight: 56, padding: '0 20px', fontSize: 18, borderRadius: 16 }}>Agregar</button>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="button" onClick={() => { setAbierta(false); setError(null); }} style={{ border: 0, background: 'none', color: 'var(--suave)', fontWeight: 800, textDecoration: 'underline', padding: 8 }}>Cancelar</button>
        </form>
      ) : (
        <button className="boton borde" onClick={() => setAbierta(true)} style={{ minHeight: 52, fontSize: 17, borderRadius: 16, borderStyle: 'dashed', borderColor: '#bfaf96', color: 'var(--suave)' }}>
          + Venta rápida (algo que no está en tu lista)
        </button>
      )}
    </div>
  );
}
