import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import {
  type FilaImportada,
  type LecturaProductos,
  clasificarProductos,
  importarProductos,
  interpretarProductos,
  leerCsv,
  plantillaCsv,
} from '../domain/importar';
import { ErrorDeNegocio } from '../domain/operaciones';
import { soles } from '../formato';
import { Cabecera } from '../ui';

interface Revision {
  origen: string;
  lectura: LecturaProductos;
  nuevos: FilaImportada[];
  repetidos: FilaImportada[];
}

/**
 * Excel guarda el «CSV» en Windows con la codificación antigua (ANSI): leído como UTF-8,
 * «Azúcar» saldría con un símbolo roto. Se prueba UTF-8 y, si falla, Windows-1252.
 */
function decodificar(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function Importar() {
  const navegar = useNavigate();
  const entrada = useRef<HTMLInputElement>(null);
  const [pegado, setPegado] = useState('');
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const revisar = async (texto: string, origen: string) => {
    setError(null);
    try {
      const lectura = interpretarProductos(leerCsv(texto));
      const { nuevos, repetidos } = await clasificarProductos(db, lectura.validas);
      setRevision({ origen, lectura, nuevos, repetidos });
    } catch (e) {
      setRevision(null);
      setError(e instanceof ErrorDeNegocio ? e.message : 'No se pudo leer el archivo');
    }
  };

  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (/\.(xlsx?|ods)$/i.test(archivo.name)) {
      setRevision(null);
      setError('Ese es un archivo de Excel. Ábrelo en Excel y usa Archivo → Guardar como → «CSV (delimitado por comas)»; luego elígelo aquí.');
      return;
    }
    await revisar(decodificar(await archivo.arrayBuffer()), archivo.name);
  };

  const descargarPlantilla = () => {
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([plantillaCsv()], { type: 'text/csv;charset=utf-8' }));
    enlace.download = 'caserita-plantilla-productos.csv';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  const importar = async () => {
    if (!revision) return;
    setImportando(true);
    try {
      const r = await importarProductos(db, revision.lectura.validas);
      navegar('/inventario', {
        replace: true,
        state: { mensaje: `Importados ${r.creados} ${r.creados === 1 ? 'producto' : 'productos'}${r.repetidos.length ? ` (${r.repetidos.length} ya los tenías)` : ''}` },
      });
    } catch (e) {
      setError(e instanceof ErrorDeNegocio ? e.message : 'No se pudo importar. No se guardó nada.');
      setImportando(false);
    }
  };

  return (
    <main className="pantalla">
      <Cabecera titulo="Importar productos" volver="" />

      {!revision ? (
        <>
          <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b style={{ fontSize: 18 }}>Trae tu lista desde Excel</b>
            <span style={{ fontWeight: 600 }}>
              Necesitas una hoja con una fila de títulos. Obligatorias: <b>nombre</b> y <b>precio</b>. Opcionales: <b>costo</b>, <b>stock</b>, <b>codigo</b>, <b>seccion</b> y <b>unidad</b> (escribe «kg» para lo que se vende por kilo).
            </span>
            <button className="boton claro" onClick={descargarPlantilla} style={{ minHeight: 52, fontSize: 17, borderRadius: 16 }}>Descargar plantilla de ejemplo</button>
          </div>

          {error && <div className="error" role="alert">{error}</div>}

          <button className="boton" onClick={() => entrada.current?.click()} style={{ minHeight: 68, fontSize: 21 }}>Elegir mi archivo CSV</button>
          <input ref={entrada} type="file" accept=".csv,.txt,.xlsx,.xls,text/csv" aria-label="Archivo con tus productos" hidden onChange={(e) => { elegirArchivo(e.target.files?.[0]); e.target.value = ''; }} />

          <div className="tarjeta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor="pegado" style={{ fontWeight: 800 }}>O copia las filas en Excel (con los títulos) y pégalas aquí</label>
            <textarea id="pegado" value={pegado} onChange={(e) => setPegado(e.target.value)} rows={5} placeholder={'nombre\tprecio\tstock\nLeche\t4.50\t24'} style={{ width: '100%', border: '2px solid #d9cdb8', borderRadius: 14, padding: 12, fontSize: 16, fontFamily: 'inherit', background: 'var(--crema)' }} />
            <button className="boton borde" disabled={!pegado.trim()} onClick={() => revisar(pegado, 'lo pegado')} style={{ minHeight: 52, fontSize: 17, borderRadius: 16 }}>Revisar lo pegado</button>
          </div>
        </>
      ) : (
        <>
          <div className="tarjeta" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, textAlign: 'center' }}>
            <Cifra valor={revision.nuevos.length} texto={revision.nuevos.length === 1 ? 'listo para crear' : 'listos para crear'} color="var(--verde)" />
            <Cifra valor={revision.repetidos.length} texto="ya los tienes" />
            <Cifra valor={revision.lectura.errores.length} texto={revision.lectura.errores.length === 1 ? 'con error' : 'con errores'} color={revision.lectura.errores.length ? '#a33a00' : undefined} />
          </div>
          <div style={{ marginTop: -6, fontSize: 14, fontWeight: 700, color: 'var(--suave)' }}>Revisando {revision.origen}</div>

          {revision.nuevos.length > 0 && (
            <section aria-label="Productos que se crearán" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <b>Así quedarán</b>
              {revision.nuevos.slice(0, 5).map((f) => (
                <div key={f.fila} className="fila" style={{ minHeight: 52 }}>
                  <span className="nombre">
                    {f.nombre}
                    <span className="sub" style={{ display: 'block', fontSize: 13 }}>
                      {f.stock} {f.unidad === 'kg' ? 'kg' : 'en stock'}{f.seccion ? ` · ${f.seccion}` : ''}{f.codigo ? ` · ${f.codigo}` : ''}
                    </span>
                  </span>
                  <b>{soles(f.precio)}{f.unidad === 'kg' ? '/kg' : ''}</b>
                </div>
              ))}
              {revision.nuevos.length > 5 && <span className="sub">…y {revision.nuevos.length - 5} más</span>}
            </section>
          )}

          {revision.repetidos.length > 0 && (
            <div className="tarjeta" style={{ fontSize: 15 }}>
              <b>Ya los tienes, se omiten:</b>{' '}
              {revision.repetidos.slice(0, 4).map((f) => f.nombre).join(', ')}
              {revision.repetidos.length > 4 && ` y ${revision.repetidos.length - 4} más`}
              <div className="sub">No cambiamos lo que ya tienes guardado.</div>
            </div>
          )}

          {revision.lectura.errores.length > 0 && (
            <section aria-label="Filas con errores" className="tarjeta" style={{ background: 'var(--rojo-claro)', color: 'var(--rojo-tinta)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <b>Estas filas no se importan. Corrígelas en el archivo y vuelve a subirlo:</b>
              {revision.lectura.errores.slice(0, 8).map((e) => (
                <span key={e.fila} style={{ fontSize: 15, fontWeight: 700 }}>Fila {e.fila}: {e.motivo}</span>
              ))}
              {revision.lectura.errores.length > 8 && <span style={{ fontSize: 15, fontWeight: 700 }}>…y {revision.lectura.errores.length - 8} más</span>}
            </section>
          )}

          {error && <div className="error" role="alert">{error}</div>}

          <div className="relleno" />
          <button className="boton" disabled={importando || revision.nuevos.length === 0} onClick={importar} style={{ minHeight: 68, fontSize: 21 }}>
            {revision.nuevos.length === 0 ? 'No hay nada nuevo para importar' : `Importar ${revision.nuevos.length} ${revision.nuevos.length === 1 ? 'producto' : 'productos'}`}
          </button>
          <button className="boton borde" onClick={() => { setRevision(null); setError(null); }} style={{ minHeight: 52, fontSize: 17, borderRadius: 16 }}>Elegir otro archivo</button>
        </>
      )}
    </main>
  );
}

function Cifra({ valor, texto, color }: { valor: number; texto: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 30, fontWeight: 800, color }}>{valor}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--suave)' }}>{texto}</div>
    </div>
  );
}
