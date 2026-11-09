import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useState } from 'react';
import { db } from '../data/db';
import { crearCliente, resumenDeDeudas } from '../domain/gestion';
import { ErrorDeNegocio, registrarAbono } from '../domain/operaciones';
import { enlaceWhatsApp, haceCuanto, soles } from '../formato';
import { Cabecera, Icono } from '../ui';

/** Lista de quién te debe, con cobro de abonos y recordatorio por WhatsApp. */
export function Fiados() {
  const deudas = useLiveQuery(() => resumenDeDeudas(db), []);
  const [abonando, setAbonando] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const conDeuda = (deudas ?? []).filter((d) => d.deuda > 0).sort((a, b) => (a.desde ?? '').localeCompare(b.desde ?? ''));
  const sinDeuda = (deudas ?? []).filter((d) => d.deuda <= 0).sort((a, b) => a.cliente.nombre.localeCompare(b.cliente.nombre, 'es'));
  const total = conDeuda.reduce((s, d) => s + d.deuda, 0);

  const abrirAbono = (id: string) => {
    setAbonando(abonando === id ? null : id);
    setMonto('');
    setMensaje(null);
  };

  const cobrar = async (e: FormEvent, clienteId: string, nombreCliente: string) => {
    e.preventDefault();
    const n = Number(monto.replace(',', '.'));
    try {
      await registrarAbono(db, clienteId, n);
      setMensaje({ texto: `Abono de ${soles(n)} registrado de ${nombreCliente}`, error: false });
      setAbonando(null);
    } catch (err) {
      setMensaje({ texto: err instanceof ErrorDeNegocio ? err.message : 'No se pudo guardar el abono', error: true });
    }
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await crearCliente(db, { nombre, telefono });
      setCreando(false);
      setNombre('');
      setTelefono('');
      setMensaje(null);
    } catch (err) {
      setMensaje({ texto: err instanceof ErrorDeNegocio ? err.message : 'No se pudo guardar el cliente', error: true });
    }
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Fiados" volver="/" />

      <div className="tarjeta" style={{ background: 'var(--azul-claro)', color: 'var(--azul-tinta)' }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>Te deben en total</div>
        <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1 }}>{deudas ? soles(total) : '—'}</div>
      </div>

      {mensaje && (
        <div className={mensaje.error ? 'error' : 'aviso'} role={mensaje.error ? 'alert' : 'status'} style={mensaje.error ? undefined : { background: 'var(--verde-claro)', color: '#1e4d12' }}>
          {mensaje.texto}
        </div>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Clientes con deuda">
        {deudas && conDeuda.length === 0 && <div className="tarjeta" style={{ fontWeight: 700 }}>Nadie te debe por ahora.</div>}
        {conDeuda.map(({ cliente, deuda, desde }) => {
          const aviso = enlaceWhatsApp(cliente.telefono ?? '', `Hola ${cliente.nombre}, te recuerdo que tienes pendiente ${soles(deuda)} en la bodega. ¡Gracias!`);
          return (
            <div key={cliente.id} className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{cliente.nombre}</div>
                  {desde && <div style={{ fontSize: 14, fontWeight: 700, color: Date.now() - new Date(desde).getTime() > 7 * 86_400_000 ? '#a33a00' : 'var(--suave)' }}>Desde {haceCuanto(desde)}</div>}
                </div>
                <b style={{ fontSize: 24 }}>{soles(deuda)}</b>
              </div>

              {abonando === cliente.id ? (
                <form onSubmit={(e) => cobrar(e, cliente.id, cliente.nombre)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label className="sr-only" htmlFor={`abono-${cliente.id}`}>Monto del abono</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id={`abono-${cliente.id}`} className="campo" inputMode="decimal" placeholder="S/ 0.00" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
                    <button type="button" className="boton claro" style={{ minHeight: 56, fontSize: 16, padding: '0 14px', borderRadius: 16 }} onClick={() => setMonto(String(deuda))}>Todo</button>
                  </div>
                  <div className="dos">
                    <button type="button" className="boton borde" style={{ minHeight: 52, fontSize: 18 }} onClick={() => setAbonando(null)}>Cancelar</button>
                    <button type="submit" className="boton" style={{ minHeight: 52, fontSize: 18 }}>Guardar abono</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="boton" style={{ flexGrow: 1, minHeight: 52, fontSize: 18, borderRadius: 14 }} onClick={() => abrirAbono(cliente.id)}>Cobrar abono</button>
                  {aviso ? (
                    <a className="boton" href={aviso} target="_blank" rel="noreferrer" aria-label={`Recordar a ${cliente.nombre} por WhatsApp`} style={{ minHeight: 52, fontSize: 16, padding: '0 14px', borderRadius: 14, background: 'var(--verde-claro)', color: '#1e4d12', boxShadow: 'none' }}>
                      <Icono nombre="celular" tam={20} /> Recordar
                    </a>
                  ) : (
                    <span className="sub" style={{ alignSelf: 'center', fontSize: 13, fontWeight: 700, color: 'var(--suave)', maxWidth: 110, lineHeight: 1.2 }}>Sin celular para recordar</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {sinDeuda.length > 0 && (
        <section aria-label="Clientes sin deuda" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ fontSize: 16, color: 'var(--suave)' }}>Sin deuda</b>
          {sinDeuda.map(({ cliente }) => (
            <div key={cliente.id} className="fila" style={{ minHeight: 48 }}>
              <span className="nombre">{cliente.nombre}</span>
            </div>
          ))}
        </section>
      )}

      <div className="relleno" />

      {creando ? (
        <form onSubmit={crear} className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800 }}>
            Nombre
            <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus autoComplete="off" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 800 }}>
            <span>Celular <span style={{ fontWeight: 600, color: 'var(--suave)' }}>(opcional)</span></span>
            <input className="campo" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </label>
          <div className="dos">
            <button type="button" className="boton borde" style={{ minHeight: 52, fontSize: 18 }} onClick={() => setCreando(false)}>Cancelar</button>
            <button type="submit" className="boton" style={{ minHeight: 52, fontSize: 18 }}>Guardar</button>
          </div>
        </form>
      ) : (
        <button className="boton borde" style={{ minHeight: 60, fontSize: 19, borderRadius: 20 }} onClick={() => setCreando(true)}>
          + Nuevo cliente
        </button>
      )}
    </main>
  );
}
