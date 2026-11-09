import { Link, useNavigate } from 'react-router-dom';

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
