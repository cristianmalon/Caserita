import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCarrito } from '../carrito';
import { Escaner } from '../componentes/Escaner';
import { FilaCarrito } from '../componentes/FilaCarrito';
import { db } from '../data/db';
import { formatoCantidad, soles } from '../formato';
import { Cabecera, Icono } from '../ui';

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function Vender() {
  const carrito = useCarrito();
  const [consulta, setConsulta] = useState('');
  const navegar = useNavigate();
  const { state } = useLocation() as { state: { aviso?: string } | null };
  // Si el producto recién creado no pudo agregarse (ej. stock 0), se avisa aquí.
  const [mensaje, setMensaje] = useState<string | null>(state?.aviso ?? null);
  const [escaneando, setEscaneando] = useState(false);
  const [desconocido, setDesconocido] = useState<string | null>(null);

  const todosLosProductos = useLiveQuery(() => db.productos.orderBy('nombre').toArray(), []) ?? [];
  const porId = new Map(todosLosProductos.map((p) => [p.id, p]));
  // «Varios» (venta rápida) no se busca ni se escanea: solo vive en el carrito.
  const productos = todosLosProductos.filter((p) => !p.sinStock);

  const q = normalizar(consulta);
  const resultados = q
    ? productos.filter((p) => normalizar(p.nombre).includes(q) || (p.codigo ?? '').includes(q))
    : [];

  const agregar = (id: string) => {
    const p = porId.get(id);
    if (!p) return;
    setMensaje(carrito.agregar(p));
    setConsulta('');
  };

  // Cada código leído por la cámara se agrega a la venta; si no existe, se ofrece crearlo.
  const alLeerCodigo = (codigo: string): string => {
    const p = productos.find((x) => x.codigo === codigo);
    if (!p) {
      setDesconocido(codigo);
      return `No está el código ${codigo}`;
    }
    setDesconocido(null);
    const problema = carrito.agregar(p);
    setMensaje(problema);
    return problema ?? `Agregado: ${p.nombre}`;
  };

  // Enter con un código exacto (lector físico o escrito a mano) agrega directo.
  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    const exacto = productos.find((p) => p.codigo && p.codigo === consulta.trim());
    if (exacto) agregar(exacto.id);
    else if (resultados.length === 1) agregar(resultados[0].id);
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Vender" volver="/" />

      {escaneando && <Escaner alLeer={alLeerCodigo} alCerrar={() => setEscaneando(false)} />}

      <div className="fila-busqueda">
        <form onSubmit={alEnviar} className="campo-con-icono">
          <Icono nombre="lupa" />
          <label className="sr-only" htmlFor="buscar">Buscar producto o escribir código</label>
          <input
            id="buscar"
            className="campo"
            placeholder="Buscar o escribir código"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setMensaje(null);
            }}
            autoComplete="off"
            inputMode="search"
          />
        </form>
        <button type="button" className="boton-escaner" aria-label={escaneando ? 'Cerrar el escáner' : 'Escanear código de barras'} aria-pressed={escaneando} onClick={() => setEscaneando((v) => !v)}>
          <Icono nombre="escaner" tam={28} />
        </button>
      </div>

      {mensaje && <div className="error" role="alert">{mensaje}</div>}

      {desconocido && (
        <button className="boton" style={{ minHeight: 60, fontSize: 18, borderRadius: 18 }} onClick={() => navegar('/producto/nuevo', { state: { consulta: desconocido } })}>
          Agregar el código {desconocido} como producto nuevo
        </button>
      )}

      {q ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Resultados">
          {resultados.length === 0 && <div className="tarjeta" style={{ fontWeight: 700 }}>No encontramos «{consulta}».</div>}
          {resultados.map((p) => (
            <button key={p.id} className="fila" onClick={() => agregar(p.id)} disabled={p.stock <= 0} style={{ border: 0, textAlign: 'left', opacity: p.stock <= 0 ? 0.5 : 1 }}>
              <span className="nombre">
                {p.nombre}
                <span className="sub" style={{ display: 'block' }}>
                  {p.stock > 0 ? `Quedan ${formatoCantidad(p.stock, p.unidad)}` : 'Agotado'}
                </span>
              </span>
              <b>{soles(p.precio)}{p.unidad === 'kg' ? ' /kg' : ''}</b>
            </button>
          ))}
          <button
            className={resultados.length === 0 ? 'boton' : 'boton borde'}
            style={{ minHeight: 60, fontSize: 18, borderRadius: 18 }}
            onClick={() => navegar('/producto/nuevo', { state: { consulta } })}
          >
            {resultados.length === 0 ? `Agregar «${consulta.trim()}» como producto nuevo` : '¿No aparece? Agregar producto nuevo'}
          </button>
        </section>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Productos de la venta">
          {carrito.items.length === 0 && (
            <div className="vacio">
              <div className="circulo"><Icono nombre="carrito" tam={34} /></div>
              Tu venta está vacía.<br />Escribe el nombre o el código de un producto para empezar.
            </div>
          )}
          {carrito.items.map((item) => {
            const p = porId.get(item.productoId);
            return p ? <FilaCarrito key={item.productoId} item={item} producto={p} /> : null;
          })}
        </section>
      )}

      <div className="relleno" />

      {carrito.items.length > 0 && (
        <Link className="boton" to="/cobrar" style={{ justifyContent: 'space-between', padding: '0 24px', minHeight: 76 }}>
          <span>Cobrar</span>
          <span style={{ fontSize: 28 }}>{soles(carrito.total)}</span>
        </Link>
      )}
    </main>
  );
}
