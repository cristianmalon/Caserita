import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { db } from '../data/db';
import { aplicarConteo, resultadoConteo } from '../domain/gestion';
import { ErrorDeNegocio } from '../domain/operaciones';
import { soles } from '../formato';
import { Cabecera } from '../ui';

export function ResultadoConteo() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const conteo = useLiveQuery(() => db.conteos.get(id).then((c) => c ?? null), [id]);
  const resultado = useLiveQuery(() => (conteo ? resultadoConteo(db, id) : undefined), [id, conteo]);
  const seccion = useLiveQuery(async () => (conteo?.seccionId ? db.secciones.get(conteo.seccionId) : undefined), [conteo?.seccionId]);
  const [error, setError] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  if (conteo === null || conteo?.estado === 'aplicado') return <Navigate to="/inventario" replace />;
  if (!conteo || !resultado) return <main className="pantalla"><Cabecera titulo="Resultado del conteo" volver="" /></main>;

  const n = resultado.diferencias.length;
  const nombre = seccion?.nombre ?? 'todo el inventario';

  const aplicar = async () => {
    setAplicando(true);
    try {
      const ajustes = await aplicarConteo(db, id);
      navegar('/inventario', { replace: true, state: { mensaje: ajustes === 0 ? 'Conteo guardado: todo coincidía' : `Conteo aplicado: ${ajustes} ${ajustes === 1 ? 'ajuste' : 'ajustes'}` } });
    } catch (e) {
      setError(e instanceof ErrorDeNegocio ? e.message : 'No se pudo aplicar el conteo');
      setAplicando(false);
    }
  };

  const cifra = (valor: number, texto: string, color?: string) => (
    <div>
      <div style={{ fontSize: 30, fontWeight: 800, color }}>{valor}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--suave)' }}>{texto}</div>
    </div>
  );

  return (
    <main className="pantalla">
      <Cabecera titulo="Resultado del conteo" volver={`/contar/${id}`} />
      <div style={{ marginTop: -8, fontSize: 14, fontWeight: 700, color: 'var(--suave)' }}>Conteo de {nombre}</div>

      <div className="tarjeta" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, textAlign: 'center' }}>
        {cifra(resultado.contados, 'contados')}
        {cifra(resultado.coinciden, 'coinciden', 'var(--verde)')}
        {cifra(n, n === 1 ? 'no coincide' : 'no coinciden', n > 0 ? '#a33a00' : undefined)}
      </div>

      {n > 0 ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Productos que no coinciden">
          <b style={{ fontSize: 17 }}>{n === 1 ? 'Este no coincide' : 'Estos no coinciden'}</b>
          {resultado.diferencias.map(({ producto, sistema, contado, diferencia }) => (
            <div key={producto.id} className="fila" style={{ minHeight: 64 }}>
              <span className="nombre">
                {producto.nombre}
                <span className="sub" style={{ display: 'block', fontSize: 14 }}>El sistema decía {sistema} · Contaste {contado}</span>
              </span>
              <span style={{ minWidth: 64, textAlign: 'center', padding: '6px 10px', borderRadius: 14, fontSize: 22, fontWeight: 800, background: diferencia < 0 ? 'var(--rojo-claro)' : 'var(--verde-claro)', color: diferencia < 0 ? 'var(--rojo-tinta)' : '#1e4d12' }} aria-label={diferencia < 0 ? `Faltan ${-diferencia}` : `Sobran ${diferencia}`}>
                {diferencia > 0 ? `+ ${diferencia}` : `− ${-diferencia}`}
              </span>
            </div>
          ))}
          <div className="aviso" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Diferencia a costo</span>
            <b style={{ fontSize: 24 }}>{resultado.diferenciaACosto < 0 ? `− ${soles(-resultado.diferenciaACosto)}` : soles(resultado.diferenciaACosto)}</b>
          </div>
        </section>
      ) : (
        <div className="tarjeta" style={{ background: 'var(--verde-claro)', color: '#1e4d12', fontWeight: 800, fontSize: 18 }}>Todo coincide. No hay nada que ajustar.</div>
      )}

      {resultado.sinContar > 0 && (
        <div className="tarjeta">
          <b>Faltan {resultado.sinContar} {resultado.sinContar === 1 ? 'producto' : 'productos'} por contar</b>
          <div className="sub">No se tocan: se quedan como están.</div>
        </div>
      )}

      {error && <div className="error" role="alert">{error}</div>}

      <div className="relleno" />

      <button className="boton" disabled={aplicando} onClick={aplicar} style={{ minHeight: 72, flexDirection: 'column', gap: 0, fontSize: 22 }}>
        {n > 0 ? `Aplicar ${n === 1 ? 'el ajuste' : `los ${n} ajustes`}` : 'Terminar conteo'}
        {n > 0 && <span style={{ fontSize: 14, fontWeight: 700 }}>El stock quedará como lo contaste</span>}
      </button>
      <button className="boton borde" onClick={() => navegar(`/contar/${id}`)} style={{ minHeight: 52, fontSize: 18, borderRadius: 18 }}>Seguir contando</button>
    </main>
  );
}
