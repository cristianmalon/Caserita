import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCarrito } from '../carrito';
import { db } from '../data/db';
import { ErrorDeNegocio, crearProducto } from '../domain/operaciones';
import { SelectorSeccion } from '../componentes/SelectorSeccion';
import { Cabecera } from '../ui';

// Lo que se escribió en la búsqueda: si parece un código de barras (solo números), va al código.
const pareceCodigo = (s: string) => /^\d{6,}$/.test(s.trim());

const aNumero = (s: string) => Number(s.replace(',', '.'));

export function ProductoNuevo() {
  const { state } = useLocation() as { state: { consulta?: string } | null };
  const consulta = state?.consulta?.trim() ?? '';
  const navegar = useNavigate();
  const carrito = useCarrito();

  const [nombre, setNombre] = useState(pareceCodigo(consulta) ? '' : consulta);
  const [codigo] = useState(pareceCodigo(consulta) ? consulta : '');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('1');
  const [costo, setCosto] = useState('');
  const [seccionId, setSeccionId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Aviso útil: si el nombre ya existe, probablemente no hace falta crearlo de nuevo.
  const parecidos =
    useLiveQuery(
      async () => {
        const q = nombre.trim().toLowerCase();
        if (q.length < 3) return [];
        return (await db.productos.toArray()).filter((p) => p.nombre.toLowerCase().includes(q));
      },
      [nombre],
    ) ?? [];

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const producto = await crearProducto(db, {
        nombre,
        codigo,
        precio: aNumero(precio),
        stock: aNumero(stock),
        costo: costo ? aNumero(costo) : undefined,
        seccionId,
      });
      const problema = carrito.agregar(producto);
      navegar('/vender', { replace: true, state: problema ? { aviso: problema } : null });
    } catch (err) {
      setError(err instanceof ErrorDeNegocio ? err.message : 'No se pudo guardar el producto');
      setGuardando(false);
    }
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Producto nuevo" volver="/vender" />

      {codigo ? (
        <div className="aviso">
          Este código aún no está en tu lista
          <div style={{ fontSize: 15 }}>Código: {codigo}</div>
        </div>
      ) : (
        <div className="aviso">No tienes «{consulta || 'este producto'}» en tu lista. Agrégalo aquí.</div>
      )}

      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14, flexGrow: 1 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800, fontSize: 17 }}>
          Nombre
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!nombre} autoComplete="off" />
        </label>

        {parecidos.length > 0 && (
          <div className="tarjeta" role="status" style={{ fontSize: 15, fontWeight: 700 }}>
            Ya tienes algo parecido: {parecidos.slice(0, 3).map((p) => p.nombre).join(', ')}
          </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800, fontSize: 17 }}>
          Precio de venta
          <input
            className="campo"
            inputMode="decimal"
            placeholder="S/ 0.00"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            autoFocus={!!nombre}
            style={{ fontSize: 26, borderColor: 'var(--verde)', borderWidth: 3 }}
          />
        </label>

        <div className="dos">
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800, fontSize: 17 }}>
            ¿Cuántos tienes?
            <input className="campo" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800, fontSize: 17 }}>
            <span>Lo compré a <span style={{ fontWeight: 600, color: 'var(--suave)' }}>(opcional)</span></span>
            <input className="campo" inputMode="decimal" placeholder="S/" value={costo} onChange={(e) => setCosto(e.target.value)} />
          </label>
        </div>

        <SelectorSeccion valor={seccionId} onChange={setSeccionId} />

        {error && <div className="error" role="alert">{error}</div>}

        <div className="relleno" />
        <button className="boton" type="submit" disabled={guardando} style={{ minHeight: 68, fontSize: 22 }}>
          Guardar y agregar a la venta
        </button>
      </form>
    </main>
  );
}
