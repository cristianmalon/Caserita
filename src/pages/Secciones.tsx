import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { db } from '../data/db';
import { crearSeccion, eliminarSeccion, renombrarSeccion } from '../domain/gestion';
import { ErrorDeNegocio } from '../domain/operaciones';
import { Cabecera } from '../ui';

/** Crear, renombrar y eliminar secciones. Al eliminar, los productos pasan a otra sección. */
export function Secciones() {
  const secciones = useLiveQuery(() => db.secciones.orderBy('nombre').toArray(), []) ?? [];
  const productos = useLiveQuery(() => db.productos.toArray(), []) ?? [];
  const cuenta = (id: string) => productos.filter((p) => p.seccionId === id).length;
  const sinSeccion = productos.filter((p) => !p.seccionId).length;

  const [nueva, setNueva] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [destino, setDestino] = useState('');
  const [error, setError] = useState<string | null>(null);

  const manejar = async (accion: () => Promise<void>) => {
    setError(null);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ErrorDeNegocio ? e.message : 'No se pudo guardar');
    }
  };

  const crear = (e: FormEvent) => {
    e.preventDefault();
    manejar(async () => {
      await crearSeccion(db, nueva);
      setNueva('');
    });
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Mis secciones" volver="" />
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--suave)' }}>Agrupan tus productos para encontrarlos y contarlos más rápido.</div>

      {error && <div className="error" role="alert">{error}</div>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Secciones">
        {secciones.map((s) => (
          <div key={s.id} className="tarjeta" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span aria-hidden="true" style={{ flex: 'none', width: 14, height: 14, borderRadius: '50%', background: s.color }} />
              {editando === s.id ? (
                <form style={{ display: 'flex', gap: 8, flexGrow: 1 }} onSubmit={(e) => { e.preventDefault(); manejar(async () => { await renombrarSeccion(db, s.id, nombreEditado); setEditando(null); }); }}>
                  <label className="sr-only" htmlFor={`sec-${s.id}`}>Nuevo nombre</label>
                  <input id={`sec-${s.id}`} className="campo" style={{ height: 48 }} value={nombreEditado} onChange={(e) => setNombreEditado(e.target.value)} autoFocus />
                  <button type="submit" className="boton" style={{ minHeight: 48, fontSize: 16, padding: '0 14px', borderRadius: 14 }}>Listo</button>
                </form>
              ) : (
                <>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 19, fontWeight: 800 }}>{s.nombre}</div>
                    <div className="sub" style={{ fontSize: 14, fontWeight: 700 }}>{cuenta(s.id)} {cuenta(s.id) === 1 ? 'producto' : 'productos'}</div>
                  </div>
                  <button aria-label={`Cambiar nombre de ${s.nombre}`} className="atras" style={{ borderRadius: 14, background: '#f2e8d5', boxShadow: 'none', fontSize: 20, fontWeight: 800 }} onClick={() => { setEditando(s.id); setNombreEditado(s.nombre); setEliminando(null); setError(null); }}>
                    ✎
                  </button>
                  <button aria-label={`Eliminar ${s.nombre}`} className="atras" style={{ borderRadius: 14, background: 'var(--rojo-claro)', color: 'var(--rojo-tinta)', boxShadow: 'none', fontSize: 20, fontWeight: 800 }} onClick={() => { setEliminando(eliminando === s.id ? null : s.id); setDestino(''); setEditando(null); setError(null); }}>
                    ✕
                  </button>
                </>
              )}
            </div>

            {eliminando === s.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cuenta(s.id) > 0 ? (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800 }}>
                    {cuenta(s.id) === 1 ? '¿A qué sección pasa su producto?' : `¿A qué sección pasan sus ${cuenta(s.id)} productos?`}
                    <select className="campo" value={destino} onChange={(e) => setDestino(e.target.value)}>
                      <option value="">Sin sección</option>
                      {secciones.filter((o) => o.id !== s.id).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                  </label>
                ) : (
                  <b>Esta sección está vacía.</b>
                )}
                <div className="dos">
                  <button className="boton borde" style={{ minHeight: 52, fontSize: 17 }} onClick={() => setEliminando(null)}>Cancelar</button>
                  <button className="boton" style={{ minHeight: 52, fontSize: 17, background: 'var(--rojo-tinta)', boxShadow: 'none' }} onClick={() => manejar(async () => { await eliminarSeccion(db, s.id, destino || undefined); setEliminando(null); })}>
                    Eliminar sección
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {sinSeccion > 0 && (
          <div className="fila" style={{ boxShadow: 'none', background: 'transparent' }}>
            <span className="nombre sub">Sin sección: {sinSeccion} {sinSeccion === 1 ? 'producto' : 'productos'}</span>
          </div>
        )}
        {secciones.length === 0 && <div className="tarjeta" style={{ fontWeight: 700 }}>Aún no tienes secciones. Crea la primera abajo.</div>}
      </section>

      <div className="relleno" />

      <form onSubmit={crear} className="tarjeta" style={{ background: 'var(--verde-claro)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 18, fontWeight: 800, color: '#1e4d12' }}>
          Nueva sección
          <input className="campo" placeholder="Ej: Frutas y verduras" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="off" style={{ borderColor: 'var(--verde)', borderWidth: 3 }} />
        </label>
        <button className="boton" type="submit" style={{ minHeight: 60, fontSize: 21 }}>Crear sección</button>
      </form>
    </main>
  );
}
