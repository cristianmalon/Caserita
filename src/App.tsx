import { Route, Routes } from 'react-router-dom';
import { CarritoProvider } from './carrito';
import { Ajustes } from './pages/Ajustes';
import { Caja } from './pages/Caja';
import { Conteo } from './pages/Conteo';
import { ContarSeccion } from './pages/ContarSeccion';
import { Cobrar } from './pages/Cobrar';
import { ElegirCliente } from './pages/ElegirCliente';
import { Efectivo } from './pages/Efectivo';
import { Fiados } from './pages/Fiados';
import { Fiar } from './pages/Fiar';
import { Ingreso } from './pages/Ingreso';
import { Inicio } from './pages/Inicio';
import { Inventario } from './pages/Inventario';
import { ProductoDetalle } from './pages/ProductoDetalle';
import { ProductoNuevo } from './pages/ProductoNuevo';
import { Secciones } from './pages/Secciones';
import { ResultadoConteo } from './pages/ResultadoConteo';
import { Todo } from './pages/Todo';
import { Vender } from './pages/Vender';
import { Pronto } from './ui';

export function App() {
  return (
    <CarritoProvider>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/vender" element={<Vender />} />
        <Route path="/producto/nuevo" element={<ProductoNuevo />} />
        <Route path="/cobrar" element={<Cobrar />} />
        <Route path="/cobrar/efectivo" element={<Efectivo />} />
        <Route path="/cliente" element={<ElegirCliente />} />
        <Route path="/fiado" element={<Fiar />} />
        <Route path="/fiados" element={<Fiados />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/producto/:id" element={<ProductoDetalle />} />
        <Route path="/ingreso" element={<Ingreso />} />
        <Route path="/secciones" element={<Secciones />} />
        <Route path="/contar" element={<ContarSeccion />} />
        <Route path="/contar/:id" element={<Conteo />} />
        <Route path="/contar/:id/resultado" element={<ResultadoConteo />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/ajustes" element={<Ajustes />} />
        <Route path="/todo" element={<Todo />} />
        <Route path="*" element={<Pronto titulo="No encontrada" />} />
      </Routes>
    </CarritoProvider>
  );
}
