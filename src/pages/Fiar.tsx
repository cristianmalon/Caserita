import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCarrito } from '../carrito';
import { db } from '../data/db';
import { resumenDeDeudas } from '../domain/gestion';
import { ErrorDeNegocio, redondear, registrarVenta } from '../domain/operaciones';
import { soles } from '../formato';
import { Cabecera } from '../ui';

/** Confirma una venta a fiado: muestra a quién y cuánto quedará debiendo. */
export function Fiar() {
  const carrito = useCarrito();
  const navegar = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const terminado = useRef(false);

  const deudas = useLiveQuery(() => resumenDeDeudas(db), []);

  if (carrito.items.length === 0) return terminado.current ? null : <Navigate to="/vender" replace />;
  if (!carrito.clienteId) return <Navigate to="/cliente" replace state={{ siguiente: '/fiado' }} />;

  const actual = deudas?.find((d) => d.cliente.id === carrito.clienteId);
  const cliente = actual?.cliente;
  const yaDebia = actual?.deuda ?? 0;

  const confirmar = async () => {
    if (!carrito.clienteId) return;
    setGuardando(true);
    try {
      await registrarVenta(db, { items: carrito.items, metodo: 'fiado', clienteId: carrito.clienteId });
      const mensaje = `Fiado a ${cliente?.nombre ?? 'tu cliente'}: ${soles(carrito.total)}`;
      terminado.current = true;
      navegar('/', { replace: true, state: { mensaje } });
      carrito.vaciar();
    } catch (e) {
      setError(e instanceof ErrorDeNegocio ? e.message : 'No se pudo guardar el fiado');
      setGuardando(false);
    }
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Fiar esta venta" volver="/cobrar" />

      <div className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div aria-hidden="true" style={{ flex: 'none', width: 52, height: 52, borderRadius: '50%', background: 'var(--ambar)', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cliente?.nombre.charAt(0).toUpperCase() ?? '…'}
        </div>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{cliente?.nombre ?? '…'}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--suave)' }}>Cliente de la bodega</div>
        </div>
        <Link to="/cliente" state={{ siguiente: '/fiado' }} style={{ color: 'var(--verde)', fontWeight: 800, textDecoration: 'underline', padding: '12px 4px' }}>Cambiar</Link>
      </div>

      <div className="tarjeta" style={{ background: 'var(--azul-claro)', color: 'var(--azul-tinta)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Fila etiqueta="Ya debía" valor={soles(yaDebia)} />
        <Fila etiqueta="Esta venta" valor={`+ ${soles(carrito.total)}`} />
        <div style={{ height: 2, background: '#9dbde8' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <b style={{ fontSize: 20 }}>Quedará debiendo</b>
          <b style={{ fontSize: 36 }}>{soles(redondear(yaDebia + carrito.total))}</b>
        </div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      <div className="relleno" />
      <button className="boton" disabled={guardando || !cliente} onClick={confirmar} style={{ minHeight: 72, fontSize: 24 }}>
        Confirmar fiado
      </button>
    </main>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
      <span>{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}
