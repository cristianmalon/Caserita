import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { marcarPrimerUso, pedirAlmacenamientoPersistente } from './respaldo';
import './styles.css';

marcarPrimerUso();
// Pide que el navegador no borre los datos si falta espacio (no bloquea nada si lo niega).
void pedirAlmacenamientoPersistente();

// En la versión publicada como página no hay rutas en la URL: la navegación vive en memoria.
const Router = import.meta.env.MODE === 'artifact' ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router basename={import.meta.env.MODE === 'artifact' ? undefined : import.meta.env.BASE_URL}>
      <App />
    </Router>
  </StrictMode>,
);
