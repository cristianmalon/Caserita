import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SelectorSeccion } from '../componentes/SelectorSeccion';
import { db } from '../data/db';
import { actualizarProducto, movimientosDe } from '../domain/gestion';
import { ErrorDeNegocio, ajustarStock, redondear } from '../domain/operaciones';
import { ETIQUETA_ESTADO, ETIQUETA_MOVIMIENTO, estadoDeStock, haceCuanto, soles } from '../formato';
import { Cabecera } from '../ui';

const aNumero = (s: string) => Number(s.replace(',', '.'));

export function ProductoDetalle() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  // undefined = cargando; null = no existe
  const producto = useLiveQuery(() => db.productos.get(id).then((p) => p ?? null), [id]);
  const movimientos = useLiveQuery(() => movimientosDe(db, id, 4), [id]) ?? [];

  const [cargado, setCargado] = useState(false);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [costo, setCosto] = useState('');
  const [minimo, setMinimo] = useState('5');
  const [stock, setStock] = useState(0);
  const [seccionId, setSeccionId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Se copian los datos una sola vez: si no, cada venta reescribiría lo que se está editando.
  useEffect(() => {
    if (producto && !cargado) {
      setNombre(producto.nombre);
      setPrecio(String(producto.precio));
      setCosto(String(producto.costo));
      setMinimo(String(producto.minimo));
      setStock(producto.stock);
      setSeccionId(producto.seccionId);
      setCargado(true);
    }
  }, [producto, cargado]);

  if (producto === undefined) return <main className="pantalla"><Cabecera titulo="Producto" volver="/inventario" /></main>;
  if (producto === null) {
    return (
      <main className="pantalla">
        <Cabecera titulo="Producto" volver="/inventario" />
        <div className="tarjeta">No encontramos este producto.</div>
      </main>
    );
  }
  const estado = estadoDeStock({ stock, minimo: Number(minimo) || 0 });
  const ganancia = redondear(aNumero(precio) - aNumero(costo));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await actualizarProducto(db, id, {
        nombre,
        precio: aNumero(precio),
        costo: costo === '' ? 0 : aNumero(costo),
        minimo: Number(minimo),
        seccionId: seccionId ?? null,
      });
      if (stock !== producto.stock) await ajustarStock(db, id, stock, 'ajuste');
      navegar('/inventario', { replace: true, state: { mensaje: `${nombre.trim()} guardado` } });
    } catch (err) {
      setError(err instanceof ErrorDeNegocio ? err.message : 'No se pudo guardar');
      setGuardando(false);
    }
  };

  const etiqueta = (texto: string, campo: React.ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 16, fontWeight: 800 }}>
      {texto}
      {campo}
    </label>
  );

  return (
    <main className="pantalla">
      <Cabecera titulo={producto.nombre} volver="/inventario" />
      {producto.codigo && <div style={{ marginTop: -8, fontWeight: 700, color: 'var(--suave)', fontSize: 14 }}>Código {producto.codigo}</div>}

      <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="tarjeta" style={{ background: estado === 'agotado' ? 'var(--rojo-claro)' : estado === 'poco' ? 'var(--ambar)' : 'var(--verde-claro)', color: estado === 'agotado' ? 'var(--rojo-tinta)' : estado === 'poco' ? 'var(--ambar-tinta)' : '#1e4d12', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Tienes</div>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }} aria-live="polite">{stock}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>unidades · {ETIQUETA_ESTADO[estado].toLowerCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Corregir cantidad">
            <button type="button" className="paso menos" style={{ width: 56, height: 56, background: '#fff' }} aria-label="Quitar una unidad" onClick={() => setStock((s) => Math.max(0, s - 1))}>−</button>
            <button type="button" className="paso mas" style={{ width: 56, height: 56, background: '#fff' }} aria-label="Agregar una unidad" onClick={() => setStock((s) => s + 1)}>+</button>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--suave)', marginTop: -6 }}>
          ¿Contaste y no coincide? Corrige aquí con − y +. Si llegó mercadería, usa{' '}
          <Link to="/ingreso" state={{ productoId: id }} style={{ color: 'var(--verde)', fontWeight: 800, textDecoration: 'underline' }}>Ingresar mercadería</Link>.
        </div>

        {etiqueta('Nombre', <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />)}

        <div className="dos">
          {etiqueta('Precio de venta', <input className="campo" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />)}
          {etiqueta('Lo compro a', <input className="campo" inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} />)}
        </div>

        {Number.isFinite(ganancia) && aNumero(precio) > 0 && (
          <div className="aviso" style={{ background: ganancia >= 0 ? 'var(--verde-claro)' : 'var(--rojo-claro)', color: ganancia >= 0 ? '#1e4d12' : 'var(--rojo-tinta)', fontSize: 17 }}>
            {ganancia >= 0 ? `Ganas ${soles(ganancia)} por cada uno` : `Pierdes ${soles(-ganancia)} por cada uno`}
          </div>
        )}

        <label className="tarjeta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 14px', minHeight: 60, fontSize: 17, fontWeight: 800 }}>
          Avisarme cuando queden
          <input inputMode="numeric" value={minimo} onChange={(e) => setMinimo(e.target.value)} aria-label="Avisar cuando queden" style={{ width: 72, height: 44, border: '2px solid #d9cdb8', borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: 800, background: 'var(--crema)' }} />
        </label>

        <SelectorSeccion valor={seccionId} onChange={setSeccionId} />

        <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b>Últimos movimientos</b>
          {movimientos.length === 0 && <span className="sub">Todavía no hay movimientos.</span>}
          {movimientos.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span style={{ color: 'var(--suave)' }}>{haceCuanto(m.fecha).replace(/^./, (c) => c.toUpperCase())} · {ETIQUETA_MOVIMIENTO[m.tipo] ?? m.tipo}</span>
              <b>{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</b>
            </div>
          ))}
        </div>

        {error && <div className="error" role="alert">{error}</div>}

        <button className="boton" type="submit" disabled={guardando} style={{ minHeight: 68, fontSize: 22 }}>Guardar cambios</button>
      </form>
    </main>
  );
}
