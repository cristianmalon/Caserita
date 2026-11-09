import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCarrito } from '../carrito';
import { db } from '../data/db';
import { soles } from '../formato';
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
  const [editando, setEditando] = useState<string | null>(null);
  const [precioNuevo, setPrecioNuevo] = useState('');

  const productos = useLiveQuery(() => db.productos.orderBy('nombre').toArray(), []) ?? [];
  const porId = new Map(productos.map((p) => [p.id, p]));

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

  // Enter con un código exacto (lector físico o escrito a mano) agrega directo.
  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    const exacto = productos.find((p) => p.codigo && p.codigo === consulta.trim());
    if (exacto) agregar(exacto.id);
    else if (resultados.length === 1) agregar(resultados[0].id);
  };

  const guardarPrecio = (id: string) => {
    const precio = Number(precioNuevo.replace(',', '.'));
    if (Number.isFinite(precio) && precio >= 0) carrito.fijarPrecio(id, precio);
    setEditando(null);
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Vender" volver="/" />

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

      {mensaje && <div className="error" role="alert">{mensaje}</div>}

      {q ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Resultados">
          {resultados.length === 0 && <div className="tarjeta" style={{ fontWeight: 700 }}>No encontramos «{consulta}».</div>}
          {resultados.map((p) => (
            <button key={p.id} className="fila" onClick={() => agregar(p.id)} disabled={p.stock <= 0} style={{ border: 0, textAlign: 'left', opacity: p.stock <= 0 ? 0.5 : 1 }}>
              <span className="nombre">
                {p.nombre}
                <span className="sub" style={{ display: 'block' }}>
                  {p.stock > 0 ? `Quedan ${p.stock}` : 'Agotado'}
                </span>
              </span>
              <b>{soles(p.precio)}</b>
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
            if (!p) return null;
            return (
              <div className="fila" key={item.productoId}>
                <div className="nombre">
                  {p.nombre}
                  {editando === item.productoId ? (
                    <span style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input
                        className="campo"
                        style={{ height: 44, fontSize: 18, width: 100 }}
                        inputMode="decimal"
                        value={precioNuevo}
                        onChange={(e) => setPrecioNuevo(e.target.value)}
                        aria-label={`Nuevo precio de ${p.nombre}`}
                        autoFocus
                      />
                      <button className="paso mas" style={{ width: 'auto', padding: '0 14px', fontSize: 16 }} onClick={() => guardarPrecio(item.productoId)}>
                        Listo
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditando(item.productoId);
                        setPrecioNuevo(String(item.precio));
                      }}
                      aria-label={`Cambiar precio de ${p.nombre}`}
                      style={{ display: 'block', border: 0, background: 'none', padding: '4px 0', color: 'var(--verde)', fontWeight: 700, fontSize: 15, textDecoration: 'underline' }}
                    >
                      {soles(item.precio)} c/u ✎
                    </button>
                  )}
                </div>
                <button className="paso menos" aria-label={`Quitar uno de ${p.nombre}`} onClick={() => carrito.cambiar(item.productoId, -1, p.stock)}>−</button>
                <b style={{ minWidth: 24, textAlign: 'center', fontSize: 20 }}>{item.cantidad}</b>
                <button className="paso mas" aria-label={`Agregar uno de ${p.nombre}`} onClick={() => carrito.cambiar(item.productoId, 1, p.stock)}>+</button>
              </div>
            );
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
