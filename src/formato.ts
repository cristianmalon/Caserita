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
