import { Link } from 'react-router-dom';
import { Cabecera, Icono, type NombreIcono } from '../ui';

interface Opcion {
  titulo: string;
  detalle: string;
  a: string;
  icono: NombreIcono;
  fondo: string;
  tinta: string;
}

const AZUL = ['var(--azul-claro)', 'var(--azul-tinta)'];
const AMBAR = ['var(--ambar)', 'var(--ambar-tinta)'];
const VERDE = ['var(--verde-claro)', '#1e4d12'];
const ROSA = ['var(--rojo-claro)', 'var(--rojo-tinta)'];

const o = (titulo: string, detalle: string, a: string, icono: NombreIcono, c: string[]): Opcion => ({ titulo, detalle, a, icono, fondo: c[0], tinta: c[1] });

const OPCIONES: Opcion[] = [
  o('Inventario', 'Qué tengo y qué falta', '/inventario', 'caja', AMBAR),
  o('Ingresar mercadería', 'Lo que llegó hoy', '/ingreso', 'carrito', VERDE),
  o('Contar', 'Revisar el stock por sección', '/contar', 'cuadros', AZUL),
  o('Secciones', 'Ordena tus productos', '/secciones', 'cuadros', ROSA),
  o('Fiados', 'Quién me debe', '/fiados', 'gente', AZUL),
  o('Caja del día', 'Cuánto entró, y anular ventas', '/caja', 'billete', VERDE),
  o('Producto nuevo', 'Agregar a mi lista', '/producto/nuevo', 'caja', AMBAR),
  o('Respaldo', 'Guarda tus datos', '/ajustes', 'cuaderno', ROSA),
];

export function Todo() {
  return (
    <main className="pantalla">
      <Cabecera titulo="Todo mi negocio" volver="/" />
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--suave)' }}>Todo lo que necesitas para llevar tu bodega, en un solo lugar.</div>

      <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }} aria-label="Secciones de la app">
        {OPCIONES.map((op) => (
          <Link key={op.a} to={op.a} className="mosaico" style={{ background: op.fondo, color: op.tinta, justifyContent: 'space-between', minHeight: 116 }}>
            <Icono nombre={op.icono} tam={32} />
            <span>
              <b style={{ display: 'block', fontSize: 19, lineHeight: 1.1 }}>{op.titulo}</b>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{op.detalle}</span>
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
