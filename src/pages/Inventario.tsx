import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Escaner } from '../componentes/Escaner';
import { db } from '../data/db';
import { ETIQUETA_ESTADO, estadoDeStock, formatoCantidad, nombreUnidades } from '../formato';
import { Cabecera, Icono } from '../ui';

type Filtro = 'todos' | 'pocos' | 'agotados';

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const ORDEN = { agotado: 0, poco: 1, bien: 2 } as const;

export function Inventario() {
  const { state } = useLocation() as { state: { mensaje?: string } | null };
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [consulta, setConsulta] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const navegar = useNavigate();

  const productos = useLiveQuery(() => db.productos.toArray(), []);
  const secciones = useLiveQuery(() => db.secciones.toArray(), []) ?? [];
  const nombreSeccion = new Map(secciones.map((s) => [s.id, s.nombre]));

  const todos = (productos ?? []).filter((p) => !p.sinStock);
  const agotados = todos.filter((p) => estadoDeStock(p) === 'agotado');
  const pocos = todos.filter((p) => estadoDeStock(p) === 'poco');

  const q = normalizar(consulta);
  const visibles = todos
    .filter((p) => (filtro === 'todos' ? true : filtro === 'agotados' ? p.stock <= 0 : estadoDeStock(p) === 'poco'))
    .filter((p) => !q || normalizar(p.nombre).includes(q) || (p.codigo ?? '').includes(q))
    .sort((a, b) => ORDEN[estadoDeStock(a)] - ORDEN[estadoDeStock(b)] || a.nombre.localeCompare(b.nombre, 'es'));

  // Escanear un producto lleva directo a su ficha.
  const alLeerCodigo = (codigo: string): string => {
    const p = todos.find((x) => x.codigo === codigo);
    if (!p) return `No está el código ${codigo}`;
    navegar(`/producto/${p.id}`);
    return p.nombre;
  };

  const chip = (id: Filtro, texto: string, n: number) => (
    <button key={id} aria-pressed={filtro === id} onClick={() => setFiltro(id)} style={{ flex: 1, minHeight: 48, border: 0, borderRadius: 999, fontSize: 16, fontWeight: 800, background: filtro === id ? 'var(--tinta)' : 'var(--blanco)', color: filtro === id ? '#fff' : 'var(--tinta)', boxShadow: filtro === id ? 'none' : '0 2px 0 var(--linea)' }}>
      {texto} {n}
    </button>
  );

  return (
    <main className="pantalla">
      <Cabecera titulo="Inventario" volver="/" />

      {state?.mensaje && (
        <div className="aviso" role="status" style={{ background: 'var(--verde-claro)', color: '#1e4d12' }}>{state.mensaje}</div>
      )}

      {escaneando && <Escaner alLeer={alLeerCodigo} alCerrar={() => setEscaneando(false)} />}

      <div className="fila-busqueda">
      <div className="campo-con-icono">
        <Icono nombre="lupa" />
        <label className="sr-only" htmlFor="buscar-inv">Buscar producto</label>
        <input id="buscar-inv" className="campo" placeholder="Buscar producto o código" value={consulta} onChange={(e) => setConsulta(e.target.value)} autoComplete="off" />
      </div>
      <button type="button" className="boton-escaner" aria-label={escaneando ? 'Cerrar el escáner' : 'Escanear código de barras'} aria-pressed={escaneando} onClick={() => setEscaneando((v) => !v)}>
        <Icono nombre="escaner" tam={28} />
      </button>
    </div>

      <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Filtrar por estado">
        {chip('todos', 'Todos', todos.length)}
        {chip('pocos', 'Pocos', pocos.length)}
        {chip('agotados', 'Agotados', agotados.length)}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Productos">
        {productos && visibles.length === 0 && (
          <div className="tarjeta" style={{ fontWeight: 700 }}>
            {todos.length === 0 ? 'Aún no tienes productos. Agrégalos desde Vender o cargando los de ejemplo en Inicio.' : 'No hay productos con ese filtro.'}
          </div>
        )}
        {visibles.map((p) => {
          const estado = estadoDeStock(p);
          return (
            <Link key={p.id} to={`/producto/${p.id}`} className="fila" style={{ minHeight: 64 }}>
              <span className="nombre">
                {p.nombre}
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                  <span className={`etiqueta ${estado}`}>{ETIQUETA_ESTADO[estado]}</span>
                  {p.seccionId && nombreSeccion.get(p.seccionId) && <span className="sub">{nombreSeccion.get(p.seccionId)}</span>}
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{formatoCantidad(p.stock)}</span>
                <span className="sub" style={{ fontSize: 13, fontWeight: 700 }}>{nombreUnidades(p.unidad)}</span>
              </span>
            </Link>
          );
        })}
      </section>

      <div className="relleno" />

      <div style={{ display: 'flex', gap: 10 }}>
        <Link className="boton" to="/ingreso" style={{ flex: 1, minHeight: 68, fontSize: 19 }}>
          <Icono nombre="caja" /> Ingresar
        </Link>
        <Link className="boton claro" to="/contar" style={{ flex: 1, minHeight: 68, fontSize: 19, border: '2px solid var(--tinta)', boxShadow: 'none' }}>
          <Icono nombre="cuadros" /> Contar
        </Link>
      </div>
    </main>
  );
}
