import { Route, Routes } from 'react-router-dom';
import { CarritoProvider } from './carrito';
import { Cobrar } from './pages/Cobrar';
import { ElegirCliente } from './pages/ElegirCliente';
import { Efectivo } from './pages/Efectivo';
import { Fiados } from './pages/Fiados';
import { Fiar } from './pages/Fiar';
import { Inicio } from './pages/Inicio';
import { ProductoNuevo } from './pages/ProductoNuevo';
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
        <Route path="/inventario" element={<Pronto titulo="Inventario" />} />
        <Route path="/todo" element={<Pronto titulo="Todo mi negocio" />} />
        <Route path="*" element={<Pronto titulo="No encontrada" />} />
      </Routes>
    </CarritoProvider>
  );
}
