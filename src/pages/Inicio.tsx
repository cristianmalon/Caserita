import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../data/db';
import { cargarDatosDeEjemplo } from '../data/demo';
import { deudaDeCliente, diaLocal, resumenDeCaja } from '../domain/operaciones';
import { soles } from '../formato';

export function Inicio() {
  const { state } = useLocation() as { state: { mensaje?: string } | null };

  const datos = useLiveQuery(async () => {
    const [caja, productos, clientes] = await Promise.all([
      resumenDeCaja(db, diaLocal(new Date())),
      db.productos.toArray(),
      db.clientes.toArray(),
    ]);
    const deudas = await Promise.all(clientes.map((c) => deudaDeCliente(db, c.id)));
    return {
      vendidoHoy: caja.total,
      porAcabarse: productos.filter((p) => p.stock <= p.minimo).length,
      deudores: deudas.filter((d) => d > 0).length,
      hayProductos: productos.length > 0,
    };
  }, []);

  return (
    <main className="pantalla">
      <div>
        <div style={{ fontWeight: 600, color: 'var(--suave)' }}>Hola, buen día</div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Caserita</h1>
      </div>

      {state?.mensaje && (
        <div className="aviso" role="status" style={{ background: 'var(--verde-claro)', color: '#1e4d12' }}>
          {state.mensaje}
        </div>
      )}

      <div className="tarjeta">
        <div style={{ fontWeight: 700, color: 'var(--suave)' }}>Hoy llevas vendido</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--verde)', lineHeight: 1.1 }}>
          {datos ? soles(datos.vendidoHoy) : '—'}
        </div>
      </div>

      {datos && !datos.hayProductos ? (
        <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <b style={{ fontSize: 18 }}>Aún no tienes productos</b>
          <button className="boton" onClick={() => cargarDatosDeEjemplo(db)}>
            Cargar productos de ejemplo
          </button>
        </div>
      ) : (
        <Link className="boton inicio-grande" to="/vender">
          Vender
        </Link>
      )}

      <div className="dos">
        <Link className="mosaico" to="/fiados" style={{ background: 'var(--azul-claro)', color: 'var(--azul-tinta)' }}>
          <b>Fiados</b>
          <span>
            {!datos ? '…' : datos.deudores ? `${datos.deudores} clientes te deben` : 'Nadie te debe'}
          </span>
        </Link>
        <Link className="mosaico" to="/inventario" style={{ background: 'var(--ambar)', color: 'var(--ambar-tinta)' }}>
          <b>Por acabarse</b>
          <span>{datos ? `${datos.porAcabarse} productos` : '…'}</span>
        </Link>
      </div>

      <div className="relleno" />

      <Link className="boton borde" to="/todo" style={{ minHeight: 60, fontSize: 18, borderRadius: 20 }}>
        Todo mi negocio
      </Link>
    </main>
  );
}
