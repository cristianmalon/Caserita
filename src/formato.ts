export const soles = (n: number): string => `S/ ${n.toFixed(2)}`;

/** Enlace de WhatsApp con un mensaje listo. Asume Perú (+51) si el número no trae código de país. */
export const enlaceWhatsApp = (telefono: string, mensaje: string): string | null => {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length < 7) return null;
  const numero = digitos.length === 9 ? `51${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
};

/** «hoy», «ayer» o «hace N días» entre una fecha ISO y ahora. */
export const haceCuanto = (iso: string, ahora = new Date()): string => {
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(new Date(iso))) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
};

export type EstadoStock = 'agotado' | 'poco' | 'bien';

/** Agotado = 0; pocos = quedan hasta el mínimo que avisa cada producto. */
export const estadoDeStock = (p: { stock: number; minimo: number }): EstadoStock =>
  p.stock <= 0 ? 'agotado' : p.stock <= p.minimo ? 'poco' : 'bien';

export const ETIQUETA_ESTADO: Record<EstadoStock, string> = {
  agotado: 'Agotado',
  poco: 'Quedan pocos',
  bien: 'Hay suficiente',
};

export const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  venta: 'Venta',
  ingreso: 'Ingreso',
  ajuste: 'Ajuste',
  conteo: 'Conteo',
  anulacion: 'Venta anulada',
};

/** «12», «0.75 kg», «2.5 kg»: sin ceros sobrantes. */
export const formatoCantidad = (n: number, unidad?: 'unidad' | 'kg'): string => {
  const texto = String(Number(n.toFixed(3)));
  return unidad === 'kg' ? `${texto} kg` : texto;
};

export const nombreUnidades = (unidad?: 'unidad' | 'kg'): string => (unidad === 'kg' ? 'kilos' : 'unidades');
