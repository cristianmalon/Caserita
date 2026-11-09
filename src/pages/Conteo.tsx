import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { db } from '../data/db';
import { registrarConteo } from '../domain/gestion';
import { ErrorDeNegocio } from '../domain/operaciones';
import { Cabecera, Icono } from '../ui';

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Conteo a ciegas: mientras se cuenta NO se muestra lo que dice el sistema,
 * para que no influya en lo que la persona ve en el estante.
 */
export function Conteo() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const conteo = useLiveQuery(() => db.conteos.get(id).then((c) => c ?? null), [id]);
  const seccion = useLiveQuery(async () => (conteo?.seccionId ? db.secciones.get(conteo.seccionId) : undefined), [conteo?.seccionId]);
  const todos = useLiveQuery(() => db.productos.orderBy('nombre').toArray(), []) ?? [];

  const [consulta, setConsulta] = useState('');
  const [actual, setActual] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState('0');
  const [verFaltan, setVerFaltan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (conteo === undefined) return <main className="pantalla"><Cabecera titulo="Contar inventario" volver="/inventario" /></main>;
  if (conteo === null) return <Navigate to="/inventario" replace />;
  if (conteo.estado === 'aplicado') return <Navigate to="/inventario" replace />;

  const alcance = conteo.seccionId ? todos.filter((p) => p.seccionId === conteo.seccionId) : todos;
  const porId = new Map(alcance.map((p) => [p.id, p]));
  const contadosIds = Object.keys(conteo.lineas).filter((pid) => porId.has(pid));
  const faltan = alcance.filter((p) => !conteo.lineas[p.id]);
  const avance = alcance.length ? Math.round((contadosIds.length / alcance.length) * 100) : 0;

  const q = normalizar(consulta);
  const resultados = q ? alcance.filter((p) => normalizar(p.nombre).includes(q) || (p.codigo ?? '').includes(q)) : [];

  const elegir = (productoId: string) => {
    setActual(productoId);
    setCantidad(String(conteo.lineas[productoId]?.contado ?? 0));
    setConsulta('');
    setError(null);
  };

  const anotar = async () => {
    if (!actual) return;
    try {
      await registrarConteo(db, id, actual, Number(cantidad));
      setActual(null);
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorDeNegocio ? e.message : 'No se pudo anotar');
    }
  };

  const producto = actual ? porId.get(actual) : undefined;

  return (
    <main className="pantalla">
      <Cabecera titulo="Contar inventario" volver="/inventario" />
      <div style={{ marginTop: -8, fontSize: 14, fontWeight: 700, color: 'var(--suave)' }}>
        {seccion?.nombre ?? 'Todo el inventario'} · se guarda solo, puedes seguir otro día
      </div>

      <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800 }}>
          <span>Contados</span>
          <span>{contadosIds.length} de {alcance.length}</span>
        </div>
        <div role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del conteo" style={{ height: 12, borderRadius: 6, background: 'var(--linea)' }}>
          <div style={{ width: `${avance}%`, height: 12, borderRadius: 6, background: 'var(--verde)', transition: 'width 0.2s' }} />
        </div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {producto ? (
        <div className="tarjeta" style={{ background: 'var(--verde-claro)', border: '3px solid var(--verde)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <b style={{ fontSize: 24 }}>{producto.nombre}</b>
          <span style={{ fontWeight: 800 }}>¿Cuántas hay?</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <button className="paso menos" style={{ width: 60, height: 60, background: '#fff', fontSize: 32 }} aria-label="Quitar una" onClick={() => setCantidad(String(Math.max(0, (Number(cantidad) || 0) - 1)))}>−</button>
            <label className="sr-only" htmlFor="cantidad">Cantidad contada</label>
            <input id="cantidad" inputMode="numeric" value={cantidad} onFocus={(e) => e.target.select()} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))} style={{ width: 110, height: 60, textAlign: 'center', fontSize: 38, fontWeight: 800, border: '2px solid #d9cdb8', borderRadius: 16, background: '#fff' }} />
            <button className="paso mas" style={{ width: 60, height: 60, background: 'var(--verde)', color: '#fff', fontSize: 32 }} aria-label="Agregar una" onClick={() => setCantidad(String((Number(cantidad) || 0) + 1))}>+</button>
          </div>
          <div className="dos">
            <button className="boton borde" style={{ minHeight: 56, fontSize: 18 }} onClick={() => setActual(null)}>Cancelar</button>
            <button className="boton" style={{ minHeight: 56, fontSize: 18 }} onClick={anotar}>Anotar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="campo-con-icono">
            <Icono nombre="lupa" />
            <label className="sr-only" htmlFor="buscar-conteo">Buscar producto o escribir código</label>
            <input
              id="buscar-conteo"
              className="campo"
              placeholder="Buscar o escribir código"
              value={consulta}
              autoComplete="off"
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const exacto = alcance.find((p) => p.codigo && p.codigo === consulta.trim());
                if (exacto) elegir(exacto.id);
                else if (resultados.length === 1) elegir(resultados[0].id);
              }}
            />
          </div>

          {q ? (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Resultados">
              {resultados.length === 0 && <div className="tarjeta" style={{ fontWeight: 700 }}>No hay «{consulta}» en esta sección.</div>}
              {resultados.map((p) => (
                <button key={p.id} className="fila" onClick={() => elegir(p.id)} style={{ border: 0, textAlign: 'left' }}>
                  <span className="nombre">{p.nombre}</span>
                  {conteo.lineas[p.id] && <span className="etiqueta bien">Contado</span>}
                </button>
              ))}
            </section>
          ) : (
            <>
              <button className="boton claro" style={{ minHeight: 52, fontSize: 17, borderRadius: 16 }} aria-expanded={verFaltan} onClick={() => setVerFaltan((v) => !v)}>
                {faltan.length === 0 ? 'Ya contaste todo' : `Faltan por contar: ${faltan.length}`}
              </button>
              {verFaltan && faltan.length > 0 && (
                <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="Falta contar">
                  {faltan.map((p) => (
                    <button key={p.id} className="fila" onClick={() => elegir(p.id)} style={{ border: 0, textAlign: 'left', minHeight: 48 }}>
                      <span className="nombre">{p.nombre}</span>
                    </button>
                  ))}
                </section>
              )}

              {contadosIds.length > 0 && (
                <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="Ya contados">
                  <b style={{ fontSize: 16 }}>Ya contados</b>
                  {contadosIds.map((pid) => (
                    <button key={pid} className="fila" onClick={() => elegir(pid)} style={{ border: 0, textAlign: 'left', minHeight: 48 }}>
                      <span className="nombre">{porId.get(pid)!.nombre}</span>
                      <b style={{ fontSize: 19 }}>{conteo.lineas[pid].contado}</b>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}

      <div className="relleno" />

      {!producto && (
        <button className="boton" disabled={contadosIds.length === 0} onClick={() => navegar(`/contar/${id}/resultado`)} style={{ minHeight: 68, fontSize: 21 }}>
          Terminar y ver resultado
        </button>
      )}
      {!producto && contadosIds.length === 0 && (
        <Link to="/inventario" style={{ textAlign: 'center', fontWeight: 800, color: 'var(--suave)', textDecoration: 'underline' }}>Salir sin contar</Link>
      )}
    </main>
  );
}
