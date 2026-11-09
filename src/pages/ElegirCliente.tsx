import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCarrito } from '../carrito';
import { db } from '../data/db';
import { crearCliente, resumenDeDeudas } from '../domain/gestion';
import { ErrorDeNegocio } from '../domain/operaciones';
import { soles } from '../formato';
import { Cabecera, Icono } from '../ui';

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Elige el cliente de la venta. Para fiar es obligatorio; para otras ventas es opcional. */
export function ElegirCliente() {
  const { state } = useLocation() as { state: { siguiente?: string } | null };
  const siguiente = state?.siguiente ?? '/cobrar';
  const paraFiar = siguiente === '/fiado';
  const navegar = useNavigate();
  const carrito = useCarrito();

  const [elegido, setElegido] = useState<string | null>(carrito.clienteId);
  const [consulta, setConsulta] = useState('');
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState<string | null>(null);

  const deudas = useLiveQuery(() => resumenDeDeudas(db), []) ?? [];
  const q = normalizar(consulta);
  const lista = deudas
    .filter((d) => !q || normalizar(d.cliente.nombre).includes(q))
    .sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre, 'es'));
  const seleccionado = deudas.find((d) => d.cliente.id === elegido)?.cliente;

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const cliente = await crearCliente(db, { nombre, telefono });
      setElegido(cliente.id);
      setCreando(false);
      setNombre('');
      setTelefono('');
    } catch (err) {
      setError(err instanceof ErrorDeNegocio ? err.message : 'No se pudo guardar el cliente');
    }
  };

  const confirmar = () => {
    carrito.seleccionarCliente(elegido);
    navegar(siguiente, { replace: true });
  };

  return (
    <main className="pantalla">
      <Cabecera titulo={paraFiar ? '¿A quién le fías?' : '¿Quién es el cliente?'} volver="" />

      <div className="campo-con-icono">
        <Icono nombre="lupa" />
        <label className="sr-only" htmlFor="buscar-cliente">Buscar cliente por nombre</label>
        <input id="buscar-cliente" className="campo" placeholder="Buscar cliente por nombre" value={consulta} onChange={(e) => setConsulta(e.target.value)} autoComplete="off" />
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Clientes">
        {!paraFiar && (
          <button className="fila" aria-pressed={elegido === null} onClick={() => setElegido(null)} style={{ border: elegido === null ? '3px solid var(--verde)' : '3px solid transparent', textAlign: 'left', background: elegido === null ? 'var(--verde-claro)' : undefined }}>
            <span className="nombre">Cliente general<span className="sub" style={{ display: 'block' }}>Sin guardar quién compró</span></span>
          </button>
        )}
        {lista.map(({ cliente, deuda }) => (
          <button key={cliente.id} className="fila" aria-pressed={elegido === cliente.id} onClick={() => setElegido(cliente.id)} style={{ border: elegido === cliente.id ? '3px solid var(--verde)' : '3px solid transparent', textAlign: 'left', background: elegido === cliente.id ? 'var(--verde-claro)' : undefined, minHeight: 64 }}>
            <span className="nombre">
              {cliente.nombre}
              <span className="sub" style={{ display: 'block' }}>{deuda > 0 ? `Debe ${soles(deuda)}` : 'No debe nada'}</span>
            </span>
            {elegido === cliente.id && <span aria-label="Elegido" style={{ color: 'var(--verde)', fontSize: 28, fontWeight: 800 }}>✓</span>}
          </button>
        ))}
        {lista.length === 0 && !creando && (
          <div className="tarjeta" style={{ fontWeight: 700 }}>
            {deudas.length === 0 ? 'Aún no tienes clientes. Agrega el primero abajo.' : `No encontramos «${consulta}».`}
          </div>
        )}

        {creando ? (
          <form onSubmit={crear} className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800 }}>
              Nombre
              <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus autoComplete="off" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800 }}>
              <span>Celular <span style={{ fontWeight: 600, color: 'var(--suave)' }}>(opcional, para recordarle por WhatsApp)</span></span>
              <input className="campo" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </label>
            {error && <div className="error" role="alert">{error}</div>}
            <div className="dos">
              <button type="button" className="boton borde" style={{ minHeight: 52, fontSize: 18 }} onClick={() => { setCreando(false); setError(null); }}>Cancelar</button>
              <button type="submit" className="boton" style={{ minHeight: 52, fontSize: 18 }}>Guardar</button>
            </div>
          </form>
        ) : (
          <button className="boton borde" style={{ minHeight: 56, fontSize: 18, borderStyle: 'dashed', borderColor: '#bfaf96', color: 'var(--suave)', borderRadius: 18 }} onClick={() => setCreando(true)}>
            + Cliente nuevo
          </button>
        )}
      </section>

      <div className="relleno" />

      <button className="boton" disabled={paraFiar && !elegido} onClick={confirmar} style={{ minHeight: 72, fontSize: 22 }}>
        {seleccionado ? `Usar a ${seleccionado.nombre}` : paraFiar ? 'Elige un cliente para fiar' : 'Seguir sin cliente'}
      </button>
    </main>
  );
}
