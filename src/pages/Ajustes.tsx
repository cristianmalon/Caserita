import { useRef, useState } from 'react';
import { db } from '../data/db';
import { exportarRespaldo, restaurarRespaldo } from '../domain/gestion';
import { diaLocal, ErrorDeNegocio } from '../domain/operaciones';
import { Cabecera } from '../ui';

/** Respaldo: todos los datos viven solo en este celular, así que hay que poder guardarlos y recuperarlos. */
export function Ajustes() {
  const entrada = useRef<HTMLInputElement>(null);
  const [pendiente, setPendiente] = useState<{ nombre: string; datos: unknown } | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const guardar = async () => {
    const respaldo = await exportarRespaldo(db);
    const archivo = new Blob([JSON.stringify(respaldo)], { type: 'application/json' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = `caserita-respaldo-${diaLocal(new Date())}.json`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    setMensaje({ texto: 'Respaldo guardado. Guárdalo en un lugar seguro (WhatsApp a ti mismo, Drive, etc.).', error: false });
  };

  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      setPendiente({ nombre: archivo.name, datos: JSON.parse(await archivo.text()) });
      setMensaje(null);
    } catch {
      setMensaje({ texto: 'Ese archivo no se puede leer. ¿Es un respaldo de Caserita?', error: true });
    }
  };

  const restaurar = async () => {
    try {
      const n = await restaurarRespaldo(db, pendiente?.datos);
      setPendiente(null);
      setMensaje({ texto: `Respaldo restaurado: ${n} ${n === 1 ? 'producto' : 'productos'}.`, error: false });
    } catch (e) {
      setMensaje({ texto: e instanceof ErrorDeNegocio ? e.message : 'No se pudo restaurar', error: true });
      setPendiente(null);
    }
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Respaldo" volver="/todo" />

      <div className="tarjeta" style={{ background: 'var(--ambar)', color: 'var(--ambar-tinta)', fontWeight: 700 }}>
        Tus datos están solo en este celular. Si lo pierdes o borras la app, se pierden. Guarda un respaldo cada cierto tiempo.
      </div>

      {mensaje && <div className={mensaje.error ? 'error' : 'aviso'} role={mensaje.error ? 'alert' : 'status'} style={mensaje.error ? undefined : { background: 'var(--verde-claro)', color: '#1e4d12' }}>{mensaje.texto}</div>}

      <button className="boton" onClick={guardar} style={{ minHeight: 68, fontSize: 21 }}>Guardar respaldo</button>

      {pendiente ? (
        <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <b>¿Restaurar «{pendiente.nombre}»?</b>
          <span className="sub">Esto reemplaza TODO lo que hay ahora en este celular: productos, ventas y fiados.</span>
          <div className="dos">
            <button className="boton borde" style={{ minHeight: 52, fontSize: 17 }} onClick={() => setPendiente(null)}>Cancelar</button>
            <button className="boton" style={{ minHeight: 52, fontSize: 17, background: 'var(--rojo-tinta)', boxShadow: 'none' }} onClick={restaurar}>Sí, restaurar</button>
          </div>
        </div>
      ) : (
        <>
          <button className="boton borde" onClick={() => entrada.current?.click()} style={{ minHeight: 60, fontSize: 19, borderRadius: 20 }}>Restaurar un respaldo</button>
          <input ref={entrada} type="file" accept="application/json,.json" aria-label="Archivo de respaldo" hidden onChange={(e) => { elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />
        </>
      )}
    </main>
  );
}
