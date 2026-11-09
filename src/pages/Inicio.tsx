import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../data/db';
import { cargarDatosDeEjemplo } from '../data/demo';
import { deudaDeCliente, diaLocal, resumenDeCaja } from '../domain/operaciones';
import { soles } from '../formato';
import { fechaPrimerUso, fechaUltimoRespaldo, necesitaRespaldo } from '../respaldo';
import { Icono } from '../ui';

const saludo = (hora: number) =>
  hora < 12 ? 'Buen día' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

export function Inicio() {
  const { state } = useLocation() as { state: { mensaje?: string } | null };
  const ahora = new Date();
  const larga = ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const fecha = larga.charAt(0).toUpperCase() + larga.slice(1); // «lunes, 9 de noviembre» → «Lunes, 9 de noviembre»

  const respaldo = necesitaRespaldo({
    ahora,
    ultimoRespaldo: fechaUltimoRespaldo(),
    primerUso: fechaPrimerUso(),
    hayDatos: true, // se afina abajo con los datos reales
  });

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

      {datos?.hayProductos && respaldo.necesita && (
        <Link to="/ajustes" className="aviso" style={{ display: 'block' }}>
          {respaldo.dias === null ? 'Aún no guardas un respaldo de tus datos.' : `Hace ${respaldo.dias} días que no guardas un respaldo.`}{' '}
          <u>Guárdalo ahora</u>
        </Link>
      )}

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
        <section className="tarjeta" aria-label="Bienvenida" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <b style={{ fontSize: 22 }}>¡Bienvenido a Caserita!</b>
          <span style={{ color: 'var(--suave)', fontWeight: 600 }}>Empecemos cargando lo que vendes. Elige cómo:</span>
          <Link className="boton" to="/importar" style={{ minHeight: 64, fontSize: 19 }}>
            Traer mi lista desde Excel
          </Link>
          <Link className="boton claro" to="/producto/nuevo" style={{ minHeight: 56, fontSize: 18, borderRadius: 18 }}>
            Agregar uno por uno
          </Link>
          <button onClick={() => cargarDatosDeEjemplo(db)} style={{ border: 0, background: 'none', color: 'var(--suave)', fontWeight: 800, textDecoration: 'underline', padding: 10, fontSize: 16 }}>
            Solo quiero probar con productos de ejemplo
          </button>
        </section>
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
