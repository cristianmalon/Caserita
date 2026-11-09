import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../data/db';
import { cargarDatosDeEjemplo } from '../data/demo';
import { deudaDeCliente, diaLocal, resumenDeCaja } from '../domain/operaciones';
import { soles } from '../formato';
import { Icono } from '../ui';

const saludo = (hora: number) =>
  hora < 12 ? 'Buen día' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

export function Inicio() {
  const { state } = useLocation() as { state: { mensaje?: string } | null };
  const ahora = new Date();
  const larga = ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const fecha = larga.charAt(0).toUpperCase() + larga.slice(1); // «lunes, 9 de noviembre» → «Lunes, 9 de noviembre»

  const datos = useLiveQuery(async () => {
    const [caja, productos, clientes] = await Promise.all([
      resumenDeCaja(db, diaLocal(new Date())),
      db.productos.filter((p) => !p.sinStock).toArray(),
      db.clientes.toArray(),
    ]);
    const deudas = await Promise.all(clientes.map((c) => deudaDeCliente(db, c.id)));
    return {
      vendidoHoy: caja.total,
      ventasHoy: caja.cantidadVentas,
      porAcabarse: productos.filter((p) => p.stock <= p.minimo).length,
      deudores: deudas.filter((d) => d > 0).length,
      hayProductos: productos.length > 0,
    };
  }, []);

  return (
    <main className="pantalla">
      <div className="marca">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        <div>
          <small>{fecha}</small>
          <h1>Caserita</h1>
        </div>
      </div>

      {state?.mensaje && (
        <div className="aviso" role="status" style={{ background: 'var(--verde-claro)', color: '#1e4d12' }}>
          {state.mensaje}
        </div>
      )}

      <div className="tarjeta">
        <div style={{ fontWeight: 700, color: 'var(--suave)' }}>{saludo(ahora.getHours())}. Hoy llevas vendido</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--verde)', lineHeight: 1.1 }}>
          {datos ? soles(datos.vendidoHoy) : '—'}
        </div>
        {datos && datos.ventasHoy > 0 && (
          <div style={{ fontWeight: 700, color: 'var(--suave)', fontSize: 15 }}>
            en {datos.ventasHoy} {datos.ventasHoy === 1 ? 'venta' : 'ventas'}
          </div>
        )}
      </div>

      {datos && !datos.hayProductos ? (
        <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <b style={{ fontSize: 18 }}>Aún no tienes productos</b>
          <span style={{ color: 'var(--suave)', fontWeight: 600 }}>Carga unos de ejemplo para probar una venta.</span>
          <button className="boton" onClick={() => cargarDatosDeEjemplo(db)}>
            Cargar productos de ejemplo
          </button>
        </div>
      ) : (
        <Link className="boton inicio-grande" to="/vender">
          <Icono nombre="carrito" tam={52} />
          Vender
        </Link>
      )}

      <div className="dos">
        <Link className="mosaico" to="/fiados" style={{ background: 'var(--azul-claro)', color: 'var(--azul-tinta)' }}>
          <Icono nombre="gente" tam={30} />
          <b>Fiados</b>
          <span>{!datos ? '…' : datos.deudores ? `${datos.deudores} ${datos.deudores === 1 ? 'cliente te debe' : 'clientes te deben'}` : 'Nadie te debe'}</span>
        </Link>
        <Link className="mosaico" to="/inventario" style={{ background: 'var(--ambar)', color: 'var(--ambar-tinta)' }}>
          <Icono nombre="alerta" tam={30} />
          <b>Por acabarse</b>
          <span>{datos ? `${datos.porAcabarse} ${datos.porAcabarse === 1 ? 'producto' : 'productos'}` : '…'}</span>
        </Link>
      </div>

      <div className="relleno" />

      <Link className="boton borde" to="/todo" style={{ minHeight: 60, fontSize: 18, borderRadius: 20 }}>
        <Icono nombre="cuadros" />
        Todo mi negocio
      </Link>
    </main>
  );
}
