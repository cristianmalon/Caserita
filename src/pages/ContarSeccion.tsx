import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { iniciarConteo, ultimosConteos } from '../domain/gestion';
import { haceCuanto } from '../formato';
import { Cabecera, Icono } from '../ui';

/** Primer paso del conteo: elegir qué sección contar (o todo el inventario). */
export function ContarSeccion() {
  const navegar = useNavigate();
  const datos = useLiveQuery(async () => {
    const [secciones, productos, ultimos, abiertos] = await Promise.all([
      db.secciones.toArray(),
      db.productos.toArray(),
      ultimosConteos(db),
      db.conteos.where('estado').equals('abierto').toArray(),
    ]);
    return { secciones, productos, ultimos, abiertos };
  }, []);

  if (!datos) return <main className="pantalla"><Cabecera titulo="¿Qué quieres contar?" volver="" /></main>;
  const { secciones, productos, ultimos, abiertos } = datos;

  const opciones = [
    ...secciones.map((s) => ({ clave: s.id as string | null, nombre: s.nombre, n: productos.filter((p) => p.seccionId === s.id).length })),
  ]
    .filter((o) => o.n > 0)
    // Lo que nunca se contó, primero; luego lo más antiguo.
    .sort((a, b) => (ultimos.get(a.clave ?? '') ?? '').localeCompare(ultimos.get(b.clave ?? '') ?? '') || a.nombre.localeCompare(b.nombre, 'es'));
  const todo = { clave: null as string | null, nombre: 'Todo el inventario', n: productos.length };

  const abrir = async (clave: string | null) => {
    const conteo = await iniciarConteo(db, clave);
    navegar(`/contar/${conteo.id}`);
  };

  const fila = (o: { clave: string | null; nombre: string; n: number }, esTodo: boolean, indice: number) => {
    const ultimo = ultimos.get(o.clave ?? '');
    const enCurso = abiertos.find((c) => c.seccionId === o.clave);
    const nunca = !ultimo;
    const destacar = !esTodo && indice === 0 && nunca;
    return (
      <button
        key={o.clave ?? 'todo'}
        className="fila"
        onClick={() => abrir(o.clave)}
        style={{ border: destacar ? '3px solid #f2a33a' : '3px solid transparent', minHeight: 74, textAlign: 'left', background: esTodo ? 'var(--tinta)' : destacar ? 'var(--ambar)' : 'var(--blanco)', color: esTodo ? '#fff' : destacar ? 'var(--ambar-tinta)' : 'var(--tinta)', padding: '10px 16px' }}
      >
        <span className="nombre" style={{ fontSize: 20 }}>
          {o.nombre}
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, opacity: 0.85 }}>
            {o.n} {o.n === 1 ? 'producto' : 'productos'} · {enCurso ? `conteo en curso (${Object.keys(enCurso.lineas).length} contados)` : nunca ? 'nunca contada' : `contada ${haceCuanto(ultimo)}`}
          </span>
        </span>
        <span aria-hidden="true" style={{ fontSize: 24, fontWeight: 800 }}>›</span>
      </button>
    );
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="¿Qué quieres contar?" volver="" />
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--suave)' }}>Contar por partes es más rápido. Empieza por lo que hace más tiempo no cuentas.</div>

      {productos.length === 0 ? (
        <div className="vacio"><div className="circulo"><Icono nombre="caja" tam={34} /></div>Aún no tienes productos para contar.</div>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Secciones para contar">
          {opciones.map((o, i) => fila(o, false, i))}
          {opciones.length === 0 && (
            <div className="tarjeta" style={{ fontWeight: 700 }}>Aún no hay secciones con productos. Puedes contar todo el inventario, o crear secciones desde «Todo mi negocio».</div>
          )}
          {fila(todo, true, 99)}
        </section>
      )}
    </main>
  );
}
