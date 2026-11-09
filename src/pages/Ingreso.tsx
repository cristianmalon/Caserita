import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Escaner } from '../componentes/Escaner';
import { db } from '../data/db';
import { ErrorDeNegocio, ingresarMercaderia, redondear, redondearCantidad } from '../domain/operaciones';
import { formatoCantidad, soles } from '../formato';
import { Cabecera, Icono } from '../ui';

interface Linea {
  productoId: string;
  cantidad: number;
  /** Texto mientras se teclea un peso (por kilo se permiten decimales). */
  texto?: string;
  costo: string;
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const aNumero = (s: string) => Number(s.replace(',', '.'));

/** Entrada de mercadería: suma stock y actualiza el costo de compra. */
export function Ingreso() {
  const { state } = useLocation() as { state: { productoId?: string } | null };
  const navegar = useNavigate();
  const productos = (useLiveQuery(() => db.productos.orderBy('nombre').toArray(), []) ?? []).filter((p) => !p.sinStock);
  const porId = new Map(productos.map((p) => [p.id, p]));

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [consulta, setConsulta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);

  const agregar = (productoId: string) => {
    const p = porId.get(productoId);
    if (!p) return;
    setLineas((prev) =>
      prev.some((l) => l.productoId === productoId)
        ? prev.map((l) => (l.productoId === productoId ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...prev, { productoId, cantidad: 1, costo: String(p.costo) }],
    );
    setConsulta('');
  };

  // Llegando desde el detalle de un producto, ya viene agregado.
  const inicial = state?.productoId;
  useEffect(() => {
    if (inicial && productos.length > 0) {
      setLineas((prev) => (prev.some((l) => l.productoId === inicial) ? prev : [...prev, { productoId: inicial, cantidad: 1, costo: String(porId.get(inicial)?.costo ?? 0) }]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial, productos.length > 0]);

  const q = normalizar(consulta);
  const resultados = q ? productos.filter((p) => normalizar(p.nombre).includes(q) || (p.codigo ?? '').includes(q)) : [];

  const total = redondear(lineas.reduce((s, l) => s + l.cantidad * (aNumero(l.costo) || 0), 0));

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      await ingresarMercaderia(db, lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, costo: aNumero(l.costo) || 0 })));
      navegar('/inventario', { replace: true, state: { mensaje: `Ingreso guardado: ${lineas.length} ${lineas.length === 1 ? 'producto' : 'productos'}` } });
    } catch (e) {
      setError(e instanceof ErrorDeNegocio ? e.message : 'No se pudo guardar el ingreso');
      setGuardando(false);
    }
  };

  const alLeerCodigo = (codigo: string): string => {
    const p = productos.find((x) => x.codigo === codigo);
    if (!p) return `No está el código ${codigo}. Créalo desde Vender.`;
    agregar(p.id);
    return `Agregado: ${p.nombre}`;
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Ingresar mercadería" volver="" />

      {escaneando && <Escaner alLeer={alLeerCodigo} alCerrar={() => setEscaneando(false)} />}

      <div className="fila-busqueda">
      <div className="campo-con-icono">
        <Icono nombre="lupa" />
        <label className="sr-only" htmlFor="buscar-ingreso">Buscar producto o escribir código</label>
        <input
          id="buscar-ingreso"
          className="campo"
          placeholder="Buscar o escribir código"
          value={consulta}
          autoComplete="off"
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const exacto = productos.find((p) => p.codigo && p.codigo === consulta.trim());
            if (exacto) agregar(exacto.id);
            else if (resultados.length === 1) agregar(resultados[0].id);
          }}
        />
      </div>
      <button type="button" className="boton-escaner" aria-label={escaneando ? 'Cerrar el escáner' : 'Escanear código de barras'} aria-pressed={escaneando} onClick={() => setEscaneando((v) => !v)}>
        <Icono nombre="escaner" tam={28} />
      </button>
    </div>

      {q ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Resultados">
          {resultados.length === 0 && <div className="tarjeta" style={{ fontWeight: 700 }}>No encontramos «{consulta}». Crea el producto desde Vender.</div>}
          {resultados.map((p) => (
            <button key={p.id} className="fila" onClick={() => agregar(p.id)} style={{ border: 0, textAlign: 'left' }}>
              <span className="nombre">{p.nombre}<span className="sub" style={{ display: 'block' }}>Hay {formatoCantidad(p.stock, p.unidad)}</span></span>
              <b>+</b>
            </button>
          ))}
        </section>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Productos que ingresan">
          {lineas.length === 0 && (
            <div className="vacio">
              <div className="circulo"><Icono nombre="caja" tam={34} /></div>
              Busca los productos que llegaron.<br />Les sumamos el stock y actualizamos lo que pagaste.
            </div>
          )}
          {lineas.map((l) => {
            const p = porId.get(l.productoId);
            if (!p) return null;
            return (
              <div key={l.productoId} className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <b style={{ fontSize: 19 }}>{p.nombre}</b>
                  <span className="sub">Hay {formatoCantidad(p.stock, p.unidad)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className="paso menos" aria-label={`Quitar ${p.unidad === 'kg' ? 'medio kilo' : 'una'} de ${p.nombre}`} onClick={() => setLineas((prev) => prev.flatMap((x) => (x.productoId === l.productoId ? (x.cantidad > (p.unidad === 'kg' ? 0.5 : 1) ? [{ ...x, texto: undefined, cantidad: redondearCantidad(x.cantidad - (p.unidad === 'kg' ? 0.5 : 1)) }] : []) : [x])))}>−</button>
                    {p.unidad === 'kg' ? (
                      <label style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span className="sr-only">Kilos de {p.nombre}</span>
                        <input
                          inputMode="decimal"
                          value={l.texto ?? String(l.cantidad)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => setLineas((prev) => prev.map((x) => (x.productoId === l.productoId ? { ...x, texto: undefined } : x)))}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(',', '.'));
                            setLineas((prev) => prev.map((x) => (x.productoId === l.productoId ? { ...x, texto: e.target.value, cantidad: Number.isFinite(n) && n > 0 ? redondearCantidad(n) : x.cantidad } : x)));
                          }}
                          style={{ width: 72, height: 44, border: '2px solid #d9cdb8', borderRadius: 12, textAlign: 'center', fontSize: 20, fontWeight: 800, background: 'var(--crema)' }}
                        />
                        <b style={{ fontSize: 15 }}>kg</b>
                      </label>
                    ) : (
                      <b style={{ minWidth: 36, textAlign: 'center', fontSize: 24 }}>{l.cantidad}</b>
                    )}
                    <button className="paso mas" aria-label={`Agregar ${p.unidad === 'kg' ? 'medio kilo' : 'una'} de ${p.nombre}`} onClick={() => setLineas((prev) => prev.map((x) => (x.productoId === l.productoId ? { ...x, texto: undefined, cantidad: redondearCantidad(x.cantidad + (p.unidad === 'kg' ? 0.5 : 1)) } : x)))}>+</button>
                  </div>
                  <label style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--suave)' }}>
                    Costo c/u
                    <input inputMode="decimal" value={l.costo} onChange={(e) => setLineas((prev) => prev.map((x) => (x.productoId === l.productoId ? { ...x, costo: e.target.value } : x)))} style={{ width: 92, height: 44, border: '2px solid #d9cdb8', borderRadius: 12, padding: '0 10px', fontSize: 19, fontWeight: 800, textAlign: 'right', background: 'var(--crema)' }} />
                  </label>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {error && <div className="error" role="alert">{error}</div>}

      <div className="relleno" />

      {lineas.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
            <b style={{ fontSize: 18 }}>Total de la compra</b>
            <b style={{ fontSize: 30 }}>{soles(total)}</b>
          </div>
          <button className="boton" disabled={guardando} onClick={guardar} style={{ minHeight: 68, fontSize: 22 }}>Guardar ingreso</button>
        </>
      )}
    </main>
  );
}
