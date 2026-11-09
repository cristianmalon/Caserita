import { Route, Routes } from 'react-router-dom';
import { CarritoProvider } from './carrito';
import { Cobrar } from './pages/Cobrar';
import { Efectivo } from './pages/Efectivo';
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
        <Route path="/fiado" element={<Pronto titulo="Fiar esta venta" />} />
        <Route path="/fiados" element={<Pronto titulo="Fiados" />} />
        <Route path="/inventario" element={<Pronto titulo="Inventario" />} />
        <Route path="/todo" element={<Pronto titulo="Todo mi negocio" />} />
        <Route path="*" element={<Pronto titulo="No encontrada" />} />
      </Routes>
    </CarritoProvider>
  );
}
