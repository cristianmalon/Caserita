import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Se llama con cada código leído. Si devuelve texto, se muestra como respuesta en pantalla. */
  alLeer: (codigo: string) => string | void;
  alCerrar: () => void;
}

const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
// Mientras el mismo código siga a la vista no se repite; solo cuenta de nuevo si salió de cuadro un momento.
const HUECO_PARA_REPETIR_MS = 1200;

// BarcodeDetector no está en los tipos de TypeScript: se declara lo mínimo que se usa.
interface DetectorNativo {
  detect(fuente: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
type ConstructorDetector = {
  new (opciones: { formats: string[] }): DetectorNativo;
  getSupportedFormats?: () => Promise<string[]>;
};

function textoDeError(e: unknown): string {
  const nombre = (e as { name?: string })?.name;
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Para escanear, abre Caserita desde su enlace seguro (https).';
  }
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'No tenemos permiso para usar la cámara. Actívalo en el candado junto a la dirección del navegador.';
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return 'Este celular no tiene una cámara disponible. Escribe el código a mano.';
  }
  if (nombre === 'NotReadableError') {
    return 'La cámara está en uso por otra app. Ciérrala e inténtalo de nuevo.';
  }
  return 'No se pudo abrir la cámara. Escribe el código a mano.';
}

/**
 * Lector de códigos de barras con la cámara.
 * Usa el lector nativo del navegador (Chrome en Android) y, si no existe (iPhone, escritorio),
 * ZXing cargado solo cuando hace falta.
 */
export function Escaner({ alLeer, alCerrar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const ultimo = useRef<{ codigo: string; visto: number } | null>(null);
  const alLeerActual = useRef(alLeer);
  alLeerActual.current = alLeer; // siempre la versión más nueva, sin reiniciar la cámara

  const [error, setError] = useState<string | null>(null);
  const [activo, setActivo] = useState(false);
  const [respuesta, setRespuesta] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    let detener: () => void = () => {};
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const recibir = (codigo: string) => {
      const ahora = Date.now();
      const previo = ultimo.current;
      ultimo.current = { codigo, visto: ahora };
      if (previo && previo.codigo === codigo && ahora - previo.visto < HUECO_PARA_REPETIR_MS) return;
      navigator.vibrate?.(60);
      const texto = alLeerActual.current(codigo);
      setRespuesta(texto ?? codigo);
      clearTimeout(temporizador);
      temporizador = setTimeout(() => setRespuesta(null), 2500);
    };

    (async () => {
      try {
        const Nativo = (window as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
        const soportados = Nativo?.getSupportedFormats ? await Nativo.getSupportedFormats() : FORMATOS_NATIVOS;
        const formatos = FORMATOS_NATIVOS.filter((f) => soportados.includes(f));

        if (Nativo && formatos.length > 0) {
          const flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          if (cancelado) {
            flujo.getTracks().forEach((t) => t.stop());
            return;
          }
          const elemento = video.current!;
          elemento.srcObject = flujo;
          await elemento.play().catch(() => {});
          const detector = new Nativo({ formats: formatos });
          const intervalo = setInterval(async () => {
            if (elemento.readyState < 2) return;
            try {
              const encontrados = await detector.detect(elemento);
              if (encontrados[0]) recibir(encontrados[0].rawValue);
            } catch {
              /* un cuadro que no se pudo leer: se intenta con el siguiente */
            }
          }, 200);
          detener = () => {
            clearInterval(intervalo);
            flujo.getTracks().forEach((t) => t.stop());
            elemento.srcObject = null;
          };
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
          ]);
          if (cancelado) return;
          const pistas = new Map();
          pistas.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF,
          ]);
          const lector = new BrowserMultiFormatReader(pistas, { delayBetweenScanAttempts: 150 });
          const controles = await lector.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            video.current!,
            (resultado) => {
              if (resultado) recibir(resultado.getText());
            },
          );
          if (cancelado) {
            controles.stop();
            return;
          }
          detener = () => controles.stop();
        }
        if (!cancelado) setActivo(true);
      } catch (e) {
        if (!cancelado) setError(textoDeError(e));
      }
    })();

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      detener();
    };
  }, []);

  const esquina = (arriba: boolean, izquierda: boolean): React.CSSProperties => ({
    position: 'absolute',
    [arriba ? 'top' : 'bottom']: 0,
    [izquierda ? 'left' : 'right']: 0,
    width: 34,
    height: 34,
    borderColor: '#fff',
    borderStyle: 'solid',
    borderWidth: 0,
    [`border${arriba ? 'Top' : 'Bottom'}Width`]: 5,
    [`border${izquierda ? 'Left' : 'Right'}Width`]: 5,
    borderRadius: `${arriba && izquierda ? 10 : 0}px ${arriba && !izquierda ? 10 : 0}px ${!arriba && !izquierda ? 10 : 0}px ${!arriba && izquierda ? 10 : 0}px`,
  });

  return (
    <section aria-label="Escáner de código de barras" style={{ position: 'relative', height: 200, borderRadius: 24, background: '#2b2118', overflow: 'hidden', flex: 'none' }}>
      <video ref={video} playsInline muted aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: error ? 0 : 1 }} />

      {!error && (
        <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '42%', width: 250, height: 100, transform: 'translate(-50%, -50%)' }}>
          <span style={esquina(true, true)} />
          <span style={esquina(true, false)} />
          <span style={esquina(false, true)} />
          <span style={esquina(false, false)} />
          <span style={{ position: 'absolute', left: 14, right: 14, top: '50%', height: 3, borderRadius: 2, background: '#ff6b4a' }} />
        </div>
      )}

      <button type="button" aria-label="Cerrar el escáner" onClick={alCerrar} style={{ position: 'absolute', top: 10, right: 10, width: 44, height: 44, border: 0, borderRadius: 14, background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 22, fontWeight: 800 }}>
        ✕
      </button>

      <div role="status" aria-live="polite" style={{ position: 'absolute', left: 12, right: 12, bottom: 10, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
        {error ?? respuesta ?? (activo ? 'Apunta al código de barras' : 'Abriendo la cámara…')}
      </div>
    </section>
  );
}
