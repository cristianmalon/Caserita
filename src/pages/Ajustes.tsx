import { useEffect, useRef, useState } from 'react';
import { db } from '../data/db';
import { exportarRespaldo, restaurarRespaldo } from '../domain/gestion';
import { diaLocal, ErrorDeNegocio } from '../domain/operaciones';
import { haceCuanto } from '../formato';
import { almacenamientoProtegido, fechaUltimoRespaldo, pedirAlmacenamientoPersistente, registrarRespaldoHecho } from '../respaldo';
import { Cabecera } from '../ui';

/** Respaldo: todos los datos viven solo en este celular, así que hay que poder guardarlos y recuperarlos. */
export function Ajustes() {
  const entrada = useRef<HTMLInputElement>(null);
  const [pendiente, setPendiente] = useState<{ nombre: string; datos: unknown } | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(fechaUltimoRespaldo());
  const [protegido, setProtegido] = useState<boolean | null | undefined>(undefined); // undefined = comprobando

  useEffect(() => {
    almacenamientoProtegido().then(setProtegido);
  }, []);

  const crearArchivo = async () => {
    const respaldo = await exportarRespaldo(db);
    return new File([JSON.stringify(respaldo)], `caserita-respaldo-${diaLocal(new Date())}.json`, { type: 'application/json' });
  };

  const hecho = (texto: string) => {
    registrarRespaldoHecho();
    setUltimo(fechaUltimoRespaldo());
    setMensaje({ texto, error: false });
  };

  const guardar = async () => {
    const archivo = await crearArchivo();
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = archivo.name;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    hecho('Respaldo guardado en tu celular. Guárdalo también fuera de él (Drive, o envíatelo por WhatsApp).');
  };

  // En el celular, abre el menú de compartir (WhatsApp, Drive, correo…) con el archivo adjunto.
  const archivoParaCompartir = typeof File !== 'undefined' && typeof navigator.canShare === 'function';
  const compartir = async () => {
    try {
      const archivo = await crearArchivo();
      if (!navigator.canShare?.({ files: [archivo] })) {
        setMensaje({ texto: 'Este navegador no puede compartir archivos. Usa «Guardar respaldo».', error: true });
        return;
      }
      await navigator.share({ files: [archivo], title: 'Respaldo de Caserita' });
      hecho('Respaldo enviado. Revisa que haya llegado.');
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return; // la persona cerró el menú
      setMensaje({ texto: 'No se pudo compartir el respaldo. Usa «Guardar respaldo».', error: true });
    }
  };

  const proteger = async () => {
    const ok = await pedirAlmacenamientoPersistente();
    setProtegido(ok);
    if (!ok) setMensaje({ texto: 'El navegador no lo concedió todavía. Instala Caserita en la pantalla de inicio y vuelve a intentarlo.', error: true });
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

      <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <b>Último respaldo</b>
          <span style={{ fontWeight: 800, color: ultimo ? undefined : '#a33a00' }}>{ultimo ? haceCuanto(ultimo) : 'nunca'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <b>Datos protegidos</b>
          {protegido === undefined ? <span className="sub">comprobando…</span> : protegido === null ? <span className="sub">no se puede saber</span> : protegido ? <span className="etiqueta bien">Sí</span> : <span className="etiqueta poco">No</span>}
        </div>
        {protegido === false && (
          <>
            <span className="sub" style={{ fontSize: 14 }}>Sin esto, el navegador podría borrar tus datos si el celular se queda sin espacio. Instalar Caserita en la pantalla de inicio ayuda.</span>
            <button className="boton claro" onClick={proteger} style={{ minHeight: 48, fontSize: 17, borderRadius: 14 }}>Proteger mis datos</button>
          </>
        )}
      </div>

      {mensaje && <div className={mensaje.error ? 'error' : 'aviso'} role={mensaje.error ? 'alert' : 'status'} style={mensaje.error ? undefined : { background: 'var(--verde-claro)', color: '#1e4d12' }}>{mensaje.texto}</div>}

      {archivoParaCompartir && (
        <button className="boton" onClick={compartir} style={{ minHeight: 68, fontSize: 21 }}>Enviar respaldo por WhatsApp u otra app</button>
      )}
      <button className={archivoParaCompartir ? 'boton claro' : 'boton'} onClick={guardar} style={{ minHeight: archivoParaCompartir ? 56 : 68, fontSize: archivoParaCompartir ? 18 : 21, borderRadius: 20 }}>Guardar respaldo en el celular</button>

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
