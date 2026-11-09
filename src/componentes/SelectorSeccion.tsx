import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../data/db';
import { crearSeccion } from '../domain/gestion';
import { ErrorDeNegocio } from '../domain/operaciones';

/** Botones para elegir la sección de un producto, con alta de una nueva ahí mismo. */
export function SelectorSeccion({
  valor,
  onChange,
}: {
  valor: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const secciones = useLiveQuery(() => db.secciones.orderBy('nombre').toArray(), []) ?? [];
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Este selector vive dentro del formulario del producto: no puede tener su propio <form>
  // (el envío subiría al de afuera y guardaría el producto antes de tiempo).
  const crear = async () => {
    try {
      const nueva = await crearSeccion(db, nombre);
      onChange(nueva.id);
      setCreando(false);
      setNombre('');
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorDeNegocio ? err.message : 'No se pudo crear la sección');
    }
  };

  const chip = (activo: boolean): React.CSSProperties => ({
    minHeight: 48,
    padding: '0 18px',
    border: 0,
    borderRadius: 999,
    fontSize: 17,
    fontWeight: 800,
    background: activo ? 'var(--tinta)' : 'var(--blanco)',
    color: activo ? '#fff' : 'var(--tinta)',
    boxShadow: activo ? 'none' : '0 2px 0 var(--linea)',
  });

  return (
    <div role="group" aria-label="Sección" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>Sección</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" aria-pressed={valor === undefined} style={chip(valor === undefined)} onClick={() => onChange(undefined)}>
          Sin sección
        </button>
        {secciones.map((s) => (
          <button key={s.id} type="button" aria-pressed={valor === s.id} style={chip(valor === s.id)} onClick={() => onChange(s.id)}>
            {s.nombre}
          </button>
        ))}
        {!creando && (
          <button type="button" style={{ ...chip(false), background: 'transparent', boxShadow: 'none', border: '2px dashed #bfaf96', color: 'var(--suave)' }} onClick={() => setCreando(true)}>
            + Otra
          </button>
        )}
      </div>
      {creando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="sr-only" htmlFor="nueva-seccion">Nombre de la nueva sección</label>
          <input
            id="nueva-seccion"
            className="campo"
            placeholder="Ej: Frutas y verduras"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault(); // Enter no debe guardar el producto
              crear();
            }}
            autoFocus
            autoComplete="off"
          />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="dos">
            <button type="button" className="boton borde" style={{ minHeight: 48, fontSize: 17 }} onClick={() => { setCreando(false); setError(null); }}>Cancelar</button>
            <button type="button" className="boton" style={{ minHeight: 48, fontSize: 17 }} onClick={crear}>Crear sección</button>
          </div>
        </div>
      )}
    </div>
  );
}
