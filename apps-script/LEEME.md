# Mails de la agenda con Google Apps Script

1. Entrá a https://script.google.com con **ventas.egoh@gmail.com** → **Nuevo proyecto**. Nombre: *Agenda Showroom · mails*.
2. Borrá lo que hay en `Código.gs` y pegá todo `Codigo.gs`. Guardá.
3. **Configuración del proyecto** (engranaje):
   - Zona horaria: *(GMT-03:00) Buenos Aires*.
   - **Propiedades de la secuencia de comandos** → agregar:
     - `SUPABASE_URL` = `https://raeuxuvshvpczwpnxirk.supabase.co`
     - `SUPABASE_SERVICE_KEY` = la **Secret key** de Supabase (Project Settings → API Keys). No la compartas.
     - `APP_URL` = `https://etapa2.agenda-showroom.pages.dev/`
     - `SHOWROOM` = `egoh`
4. En el editor elegí la función `instalarTareaDiaria` → **Ejecutar**. Google pide permisos (mandar mails, conectarse a internet, tareas programadas): aceptá. Si dice "Google no verificó esta app": *Configuración avanzada → Ir a … (no seguro)*: es tu propio script.
5. **Implementar → Nueva implementación** → tipo **Aplicación web** → Ejecutar como: **Yo** → Quién tiene acceso: **Cualquier usuario** → Implementar. Copiá la **URL de la aplicación web** (termina en `/exec`) y pasala para cargarla en `js/config.js` (`avisosUrl`).
6. Prueba: hacé una reserva con tu mail → te llega la confirmación y el aviso. Para el resumen: función `probarResumen` → Ejecutar (llega si hay citas el próximo día de atención).
