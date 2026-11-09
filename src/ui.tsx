import { Link, useNavigate } from 'react-router-dom';

const FORMAS = {
  carrito: 'M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H6M9 20.5v.01M18 20.5v.01',
  gente: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0-1.5-5.6M21.5 20a5.5 5.5 0 0 0-4-5.3',
  alerta: 'M12 3 2.5 20h19L12 3ZM12 10v4.5M12 17.5v.01',
  lupa: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5',
  billete: 'M4.5 6h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  celular: 'M9.5 2.5h5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2ZM11 18.5h2',
  cuaderno: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4ZM5 18a2 2 0 0 1 2-2h12M9 8h6',
  cuadros: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  caja: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
} as const;

export type NombreIcono = keyof typeof FORMAS;

/** Iconos de trazo; siempre decorativos (el texto del botón ya dice qué hace). */
export function Icono({ nombre, tam = 24 }: { nombre: NombreIcono; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={FORMAS[nombre]} />
    </svg>
  );
}

export function Cabecera({ titulo, volver }: { titulo: string; volver?: string }) {
  const navegar = useNavigate();
  return (
    <div className="cabecera">
      {volver !== undefined && (
        <button
          className="atras"
          aria-label="Volver"
          onClick={() => (volver ? navegar(volver) : navegar(-1))}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
      )}
      <h1>{titulo}</h1>
    </div>
  );
}

export function Pronto({ titulo }: { titulo: string }) {
  return (
    <main className="pantalla">
      <Cabecera titulo={titulo} volver="/" />
      <div className="tarjeta">Esta pantalla se construye en el siguiente paso.</div>
      <Link className="boton claro" to="/">
        Ir al inicio
      </Link>
    </main>
  );
}
