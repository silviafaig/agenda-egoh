// Conexión a la nube (etapa 2). La publishable key se puede compartir: los permisos los controla la base (RLS).
// Si se borra este archivo o queda vacío, la app funciona en modo local (datos en el navegador).
window.EG_CONFIG = {
  supabaseUrl: "https://raeuxuvshvpczwpnxirk.supabase.co",
  supabaseKey: "sb_publishable_QcpU19qYvFmY-R-Sq426pg_D0t6Bgxr",
  showroom: "egoh",
  // Dirección pública definitiva: los links que se comparten (reserva, QR, citas) usan esta.
  appUrl: "https://turnos.egohmayorista.com.ar/",
  // Dirección del Apps Script que manda los mails (Implementar → Aplicación web). Vacío = sin mails.
  avisosUrl: ""
};
