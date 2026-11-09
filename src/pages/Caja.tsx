import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../data/db';
import { ventasDelDia } from '../domain/gestion';
import { ErrorDeNegocio, anularVenta, diaLocal, resumenDeCaja } from '../domain/operaciones';
import { formatoCantidad, soles } from '../formato';
import { Cabecera } from '../ui';

const METODO = { efectivo: 'Efectivo', digital: 'Yape o transferencia', fiado: 'Fiado' } as const;

/** Caja del día: cuánto entró, por qué medio, y la lista de ventas (con opción de anular). */
export function Caja() {
  const hoy = diaLocal(new Date());
  const [dia, setDia] = useState(hoy);
  const [anulando, setAnulando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const resumen = useLiveQuery(() => resumenDeCaja(db, dia), [dia]);
  const ventas = useLiveQuery(() => ventasDelDia(db, dia), [dia]);

  const anular = async (id: string) => {
    try {
      await anularVenta(db, id);
      setMensaje({ texto: 'Venta anulada. Devolvimos el stock.', error: false });
    } catch (e) {
      setMensaje({ texto: e instanceof ErrorDeNegocio ? e.message : 'No se pudo anular', error: true });
    }
    setAnulando(null);
  };

  const dato = (titulo: string, valor: number | undefined, destacado = false) => (
    <div className="tarjeta" style={{ padding: 12, background: destacado ? 'var(--verde-claro)' : undefined }}>
      <div className="sub" style={{ fontSize: 14, fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: destacado ? '#1e4d12' : undefined }}>{valor === undefined ? '—' : soles(valor)}</div>
    </div>
  );

  return (
    <main className="pantalla">
      <Cabecera titulo="Caja del día" volver="/todo" />

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800 }}>
        Día
        <input type="date" className="campo" style={{ height: 48 }} value={dia} max={hoy} onChange={(e) => e.target.value && setDia(e.target.value)} />
      </label>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }} aria-label="Resumen del día">
        {dato('Vendiste', resumen?.total)}
        {dato('Efectivo en caja', resumen?.efectivoEnCaja, true)}
        {dato('En efectivo', resumen?.efectivo)}
        {dato('Yape / transferencia', resumen?.digital)}
        {dato('A fiado', resumen?.fiado)}
        {dato('Cobros de fiados', resumen?.cobrosDeFiados)}
      </section>
      <div className="aviso" style={{ background: 'var(--verde-claro)', color: '#1e4d12', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>Ganancia estimada</span>
        <b style={{ fontSize: 24 }}>{resumen ? soles(resumen.ganancia) : '—'}</b>
      </div>

      {mensaje && <div className={mensaje.error ? 'error' : 'aviso'} role={mensaje.error ? 'alert' : 'status'} style={mensaje.error ? undefined : { background: 'var(--verde-claro)', color: '#1e4d12' }}>{mensaje.texto}</div>}

      <b style={{ fontSize: 18 }}>Ventas {dia === hoy ? 'de hoy' : 'del día'}</b>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Ventas">
        {ventas && ventas.length === 0 && <div className="tarjeta" style={{ fontWeight: 700 }}>No hay ventas este día.</div>}
        {ventas?.map(({ venta, lineas, cliente }) => (
          <div key={venta.id} className="tarjeta" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, opacity: venta.anulada ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, textDecoration: venta.anulada ? 'line-through' : 'none' }}>
                  {new Date(venta.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} · {METODO[venta.metodo]}
                </div>
                <div className="sub" style={{ fontSize: 14 }}>{lineas.map((l) => `${formatoCantidad(l.cantidad, l.unidad)}× ${l.nombre}`).join(', ')}</div>
                {cliente && <div className="sub" style={{ fontSize: 14, fontWeight: 800 }}>{cliente.nombre}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <b style={{ fontSize: 20, textDecoration: venta.anulada ? 'line-through' : 'none' }}>{soles(venta.total)}</b>
                {venta.anulada && <div className="etiqueta agotado">Anulada</div>}
              </div>
            </div>

            {!venta.anulada && anulando !== venta.id && (
              <button className="boton borde" style={{ minHeight: 44, fontSize: 16, borderRadius: 14, color: 'var(--rojo-tinta)', borderColor: 'var(--rojo-tinta)' }} onClick={() => { setAnulando(venta.id); setMensaje(null); }}>
                Anular esta venta
              </button>
            )}
            {anulando === venta.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <b>¿Anular esta venta?</b>
                <span className="sub">Se devuelve el stock{venta.metodo === 'fiado' ? ' y se quita la deuda del cliente' : ' y deja de contar en la caja'}.</span>
                <div className="dos">
                  <button className="boton borde" style={{ minHeight: 48, fontSize: 17 }} onClick={() => setAnulando(null)}>No</button>
                  <button className="boton" style={{ minHeight: 48, fontSize: 17, background: 'var(--rojo-tinta)', boxShadow: 'none' }} onClick={() => anular(venta.id)}>Sí, anular</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
