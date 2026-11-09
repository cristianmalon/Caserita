import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCarrito } from '../carrito';
import { db } from '../data/db';
import { ErrorDeNegocio, redondear, registrarVenta } from '../domain/operaciones';
import { soles } from '../formato';
import { Cabecera } from '../ui';

const BILLETES = [10, 20, 50, 100, 200];

export function Efectivo() {
  const carrito = useCarrito();
  const navegar = useNavigate();
  const [pagoCon, setPagoCon] = useState<number | null>(null);
  const [otro, setOtro] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Tras cobrar, el carrito queda vacío: sin esta marca la pantalla se redirigiría a Vender.
  const terminado = useRef(false);

  if (carrito.items.length === 0) return terminado.current ? null : <Navigate to="/vender" replace />;

  const total = carrito.total;
  const opciones = [total, ...BILLETES.filter((b) => b > total)].slice(0, 5);
  const vuelto = pagoCon === null ? null : redondear(pagoCon - total);
  const puedeCobrar = pagoCon !== null && pagoCon >= total && !guardando;

  const cobrar = async () => {
    if (pagoCon === null) return;
    setGuardando(true);
    try {
      await registrarVenta(db, { items: carrito.items, metodo: 'efectivo', pagoCon });
      terminado.current = true;
      navegar('/', { replace: true, state: { mensaje: `Venta registrada: ${soles(total)}` } });
      carrito.vaciar();
    } catch (e) {
      setError(e instanceof ErrorDeNegocio ? e.message : 'No se pudo guardar la venta');
      setGuardando(false);
    }
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Efectivo" volver="/cobrar" />

      <div className="tarjeta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b style={{ fontSize: 20 }}>Total a cobrar</b>
        <b style={{ fontSize: 36 }}>{soles(total)}</b>
      </div>

      <b style={{ fontSize: 18 }}>¿Con cuánto paga?</b>
      <div className="billetes">
        {opciones.map((valor, i) => (
          <button
            key={valor}
            className="billete"
            aria-pressed={!otro && pagoCon === valor}
            onClick={() => {
              setOtro(false);
              setPagoCon(valor);
            }}
          >
            {i === 0 ? `Exacto ${soles(valor)}` : `S/ ${valor}`}
          </button>
        ))}
        <button className="billete" aria-pressed={otro} onClick={() => { setOtro(true); setPagoCon(null); }}>
          Otro monto
        </button>
      </div>

      {otro && (
        <>
          <label className="sr-only" htmlFor="otro">Monto recibido</label>
          <input
            id="otro"
            className="campo"
            inputMode="decimal"
            placeholder="S/ 0.00"
            value={texto}
            autoFocus
            onChange={(e) => {
              setTexto(e.target.value);
              const n = Number(e.target.value.replace(',', '.'));
              setPagoCon(Number.isFinite(n) && n > 0 ? n : null);
            }}
          />
        </>
      )}

      {error && <div className="error" role="alert">{error}</div>}

      <div
        className="tarjeta"
        role="status"
        style={{
          background: vuelto !== null && vuelto < 0 ? 'var(--rojo-claro)' : 'var(--verde-claro)',
          color: vuelto !== null && vuelto < 0 ? 'var(--rojo-tinta)' : '#1e4d12',
          textAlign: 'center',
        }}
      >
        {vuelto === null ? (
          <b style={{ fontSize: 18 }}>Elige con cuánto paga</b>
        ) : vuelto < 0 ? (
          <b style={{ fontSize: 20 }}>Falta {soles(-vuelto)}</b>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Dale de vuelto</div>
            <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1 }}>{soles(vuelto)}</div>
          </>
        )}
      </div>

      <div className="relleno" />
      <button className="boton" disabled={!puedeCobrar} onClick={cobrar} style={{ minHeight: 72, fontSize: 24 }}>
        Listo, cobrado
      </button>
    </main>
  );
}
