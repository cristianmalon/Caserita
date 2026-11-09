import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCarrito } from '../carrito';
import { db } from '../data/db';
import { ErrorDeNegocio, registrarVenta } from '../domain/operaciones';
import { soles } from '../formato';
import { Cabecera, Icono } from '../ui';

export function Cobrar() {
  const carrito = useCarrito();
  const navegar = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Tras cobrar, el carrito queda vacío: sin esta marca la pantalla se redirigiría a Vender.
  const terminado = useRef(false);
  const cliente = useLiveQuery(
    async () => (carrito.clienteId ? db.clientes.get(carrito.clienteId) : undefined),
    [carrito.clienteId],
  );

  if (carrito.items.length === 0) return terminado.current ? null : <Navigate to="/vender" replace />;

  const cobrarDigital = async () => {
    setGuardando(true);
    try {
      await registrarVenta(db, { items: carrito.items, metodo: 'digital', clienteId: carrito.clienteId ?? undefined });
      const total = carrito.total;
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
      <Cabecera titulo="Cobrar" volver="/vender" />

      <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {carrito.items.map((i) => (
          <ResumenLinea key={i.productoId} productoId={i.productoId} cantidad={i.cantidad} precio={i.precio} />
        ))}
        <div style={{ height: 2, background: 'var(--linea)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <b style={{ fontSize: 20 }}>Total</b>
          <b style={{ fontSize: 42, color: 'var(--verde)' }}>{soles(carrito.total)}</b>
        </div>
      </div>

      <Link to="/cliente" state={{ siguiente: '/cobrar' }} className="fila" style={{ minHeight: 56 }}>
        <Icono nombre="gente" />
        <span className="nombre">{cliente ? cliente.nombre : 'Cliente general'}</span>
        <span style={{ color: 'var(--verde)', fontWeight: 800, textDecoration: 'underline' }}>{cliente ? 'Cambiar' : 'Elegir'}</span>
      </Link>

      {error && <div className="error" role="alert">{error}</div>}

      <b style={{ fontSize: 18 }}>¿Cómo paga?</b>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Link className="boton pago-btn" to="/cobrar/efectivo">
          <Icono nombre="billete" tam={36} />
          Efectivo
        </Link>
        <button className="boton pago-btn" disabled={guardando} onClick={cobrarDigital} style={{ background: 'var(--azul-claro)', color: 'var(--azul-tinta)', boxShadow: '0 5px 0 #b7d3f5' }}>
          <Icono nombre="celular" tam={36} />
          Yape o transferencia
        </button>
        <Link className="boton pago-btn" to="/fiado" style={{ background: 'var(--ambar)', color: 'var(--ambar-tinta)', boxShadow: '0 5px 0 #f0c777' }}>
          <Icono nombre="cuaderno" tam={36} />
          Fiado
        </Link>
      </div>
    </main>
  );
}

function ResumenLinea({ productoId, cantidad, precio }: { productoId: string; cantidad: number; precio: number }) {
  const producto = useLiveQuery(() => db.productos.get(productoId), [productoId]);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
      <span>{cantidad} × {producto?.nombre ?? '…'}</span>
      <span>{soles(Math.round(cantidad * precio * 100) / 100)}</span>
    </div>
  );
}
