// Páginas legales (#/legal/privacidad, /terminos, /cookies, /reembolsos), pie con links y datos del negocio,
// y textos de consentimiento de los formularios. Los datos de cada showroom salen de su configuración
// (Perfil público → Datos legales), así cada showroom tiene sus propias páginas.
// BORRADOR: textos pensados para la Ley 25.326 y la Ley 24.240 (Argentina). Tienen que pasar por un abogado.
(function () {
  "use strict";
  const EG = window.EG;
  const S = EG.S;
  const U = EG.ui;
  const { esc, icon: I } = EG;

  EG.LEGAL_VERSION = "2026-10-17";
  const ACTUALIZADA = "17 de octubre de 2026";
  EG.LEGAL_PAGINAS = [["privacidad", "Política de privacidad"], ["terminos", "Términos y condiciones"], ["cookies", "Política de cookies"], ["reembolsos", "Política de reembolsos"]];

  // Datos legales del showroom (responsable de los datos de sus clientas).
  EG.datosLegales = function (s) {
    const l = (s && s.legal) || {};
    const wa = s && s.whatsappShowroom ? "+" + s.whatsappShowroom : "";
    return {
      nombre: (s && s.nombre) || "el showroom",
      titular: String(l.titular || "").trim() || (s && s.nombre) || "el showroom",
      cuit: String(l.cuit || "").trim(),
      direccion: (s && s.direccion) || "",
      email: String(l.email || "").trim(),
      whatsapp: wa,
      completos: !!(String(l.titular || "").trim() && String(l.cuit || "").trim() && (String(l.email || "").trim() || wa))
    };
  };
  const contactoTxt = (d) => [d.email ? `el mail <b>${esc(d.email)}</b>` : "", d.whatsapp ? `WhatsApp <b class="num">${esc(d.whatsapp)}</b>` : ""].filter(Boolean).join(" o ") || "los canales de contacto de esta página";

  // Leyenda obligatoria (Resolución AAIP 14/2018, art. 3).
  EG.LEYENDA_AAIP = "LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.";

  const link = (p, txt, nueva) => `<a href="#/legal/${p}"${nueva ? ' target="_blank" rel="noopener"' : ""}>${txt}</a>`;
  EG.legalLink = link;

  // Pie de las páginas públicas: datos del negocio + links legales.
  EG.pieLegal = function (s) {
    // Sin showroom (alta de la plataforma): solo los links.
    const d = s ? EG.datosLegales(s) : null;
    const datos = d ? [esc(d.titular), d.cuit ? "CUIT " + esc(d.cuit) : "", esc(d.direccion)].filter(Boolean).join(" · ") : "";
    return `<footer class="pielegal">${datos ? `<p>${datos}</p>` : ""}
      <nav aria-label="Información legal">${EG.LEGAL_PAGINAS.map((p) => link(p[0], p[1])).join("")}</nav></footer>`;
  };

  // Información breve antes de pedir datos (art. 6, Ley 25.326) + casilla de aceptación.
  EG.consentimientoReserva = function (s, checked) {
    const d = EG.datosLegales(s);
    return `<div class="stack sm consent">
      <p class="xs muted">Tus datos los usa <b>${esc(d.titular)}</b> solo para gestionar tu cita (confirmarla, recordarla y atenderte). No se venden ni se usan para publicidad de terceros. Podés pedir verlos, corregirlos o borrarlos por ${contactoTxt(d)}. Más info en la ${link("privacidad", "Política de privacidad", true)}.</p>
      <label class="check"><input type="checkbox" id="acepto" data-bind="booking.acepto" ${checked ? "checked" : ""} aria-describedby="acepto-txt" required>
        <span id="acepto-txt">Leí y acepto la ${link("privacidad", "Política de privacidad", true)} y los ${link("terminos", "Términos y condiciones", true)}, incluido que mis datos se guarden en servidores de proveedores que pueden estar fuera de Argentina.</span></label>
      <p class="xxs muted">${esc(EG.LEYENDA_AAIP)}</p></div>`;
  };
  EG.consentimientoAlta = function (checked) {
    return `<label class="check"><input type="checkbox" id="al-acepto" data-bind="alta.acepto" ${checked ? "checked" : ""} required>
      <span>Leí y acepto los ${link("terminos", "Términos y condiciones", true)} (incluida la parte para showrooms) y la ${link("privacidad", "Política de privacidad", true)}.</span></label>`;
  };

  /* ---------- contenido ---------- */
  const h2 = (t) => `<h2>${t}</h2>`;
  const p = (t) => `<p>${t}</p>`;
  const ul = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>`;

  function responsable(d) {
    return ul([`Responsable: <b>${esc(d.titular)}</b>${d.titular !== d.nombre ? ` (${esc(d.nombre)})` : ""}${d.cuit ? `, CUIT ${esc(d.cuit)}` : ""}.`,
      d.direccion ? `Domicilio: ${esc(d.direccion)}.` : "",
      `Contacto: ${contactoTxt(d)}.`].filter(Boolean));
  }

  function privacidad(s) {
    const d = EG.datosLegales(s);
    const mails = EG.remote && EG.remote.on && EG.remote.mails;
    return [
      p(`Esta política explica qué datos personales se piden al reservar una cita en <b>${esc(d.nombre)}</b> y en su panel, para qué se usan y cómo podés ejercer tus derechos según la Ley 25.326 de Protección de Datos Personales.`),
      h2("Quién es responsable de tus datos"), responsable(d),
      p(`La agenda funciona sobre la plataforma <b>Agenda Showroom</b>, que guarda y procesa los datos por cuenta del showroom y solo para prestarle el servicio. Los datos de las cuentas del panel (las personas de cada showroom) los trata la plataforma para darles acceso; las consultas sobre esos datos se hacen por el canal de soporte del panel.`),
      h2("Qué datos pedimos"),
      ul(["<b>Al reservar:</b> nombre y apellido, WhatsApp, " + (mails ? "email" : "email (opcional)") + ", zona (opcional), cómo comprás, qué estás buscando (opcional), el tipo de cita, el día y horario y las prendas que elegís ver.",
        "<b>Después de la cita:</b> el showroom puede anotar si asististe, qué prendas te llevaste, notas internas para atenderte mejor y el mensaje de agradecimiento que te manda por WhatsApp.",
        "<b>Si reservás por otro medio</b> (por ejemplo, por WhatsApp), el equipo del showroom puede cargar esos mismos datos en la agenda.",
        "<b>Cuentas del panel</b> (personas del showroom): email, nombre y contraseña (la contraseña no se guarda en texto legible y nadie del equipo puede verla)."]),
      p("Los datos marcados como obligatorios hacen falta para confirmar la cita y poder avisarte de cambios; sin ellos no se puede reservar online. Los opcionales podés dejarlos vacíos. Te pedimos que los datos sean verdaderos."),
      h2("Para qué los usamos"),
      ul(["Confirmar, recordar, reprogramar o cancelar tu cita" + (mails ? " (por WhatsApp y por mail)." : " (por WhatsApp)."),
        "Tener listas las prendas que elegiste y atenderte según lo que buscás.",
        "Escribirte por WhatsApp después de la visita para agradecerte o responder consultas.",
        "Llevar estadísticas internas del showroom (por ejemplo, cuántas visitas hubo o qué prendas se eligieron)."]),
      p("No vendemos ni alquilamos tus datos, no los usamos para publicidad de terceros y no los cruzamos con otras bases."),
      h2("Quién más los ve o los guarda"),
      p("Solo las personas del equipo del showroom con acceso al panel. Para que la agenda funcione se usan estos proveedores, que pueden guardar o procesar datos en servidores fuera de Argentina:"),
      ul(["<b>Supabase</b>: base de datos y cuentas del panel.",
        "<b>Cloudflare</b>: aloja la página; como cualquier sitio web, recibe la dirección IP y datos técnicos del navegador al cargarla.",
        mails ? "<b>Google</b> (Apps Script y Gmail): envía los mails de confirmación y los avisos al equipo." : "",
        EG.esPrincipalLegal() ? "<b>Tiendanube</b>: algunas fotos de prendas se cargan desde la tienda online del showroom; tu navegador las pide a sus servidores." : "",
        "<b>WhatsApp</b> (Meta): cuando vos o el showroom se escriben por WhatsApp, ese mensaje se rige por las políticas de WhatsApp.",
        "<b>Google Maps</b>: solo si tocás “Cómo llegar”, se abre Google Maps con la dirección del showroom."].filter(Boolean)),
      p("Al aceptar esta política das tu consentimiento expreso para esa transferencia internacional (art. 12, Ley 25.326). Fuera de esos casos, solo compartiríamos datos si lo exige una ley o una autoridad competente."),
      h2("Cuánto tiempo los guardamos"),
      p("Mientras el showroom use la agenda, o hasta que pidas borrarlos. Si el showroom deja de usar la plataforma, sus datos se borran. Pueden quedar por un tiempo limitado en copias de seguridad del proveedor de base de datos."),
      h2("Tus derechos"),
      ul(["<b>Acceso:</b> podés pedir qué datos tuyos hay, en forma gratuita y cada seis meses (salvo que tengas un interés legítimo para pedirlo antes).",
        "<b>Rectificación y actualización:</b> podés pedir que se corrijan o completen.",
        "<b>Supresión:</b> podés pedir que se borren. Lo hacemos dentro de los 5 días hábiles (art. 16, Ley 25.326), salvo que haya que conservarlos por una obligación legal.",
        "Si diste tu consentimiento, podés retirarlo cuando quieras; eso no afecta lo hecho antes."]),
      p(`Para cualquiera de estos pedidos, escribí a ${contactoTxt(d)}. Te podemos pedir algún dato para confirmar que sos vos.`),
      p(`<small>${esc(EG.LEYENDA_AAIP)}</small>`),
      p("Podés hacer tu reclamo en <b>argentina.gob.ar/aaip</b>."),
      h2("Datos que se guardan en tu dispositivo"),
      p(`Solo si marcás “Recordar mis datos”, tus datos de contacto quedan guardados en tu navegador para la próxima reserva. Más detalle en la ${link("cookies", "Política de cookies")}.`),
      h2("Seguridad"),
      p("La conexión con la página es cifrada (HTTPS), el panel pide email y contraseña y cada showroom solo puede ver sus propios datos. Ningún sistema es infalible; si detectamos un problema que afecte tus datos, te avisamos."),
      h2("Menores de edad"),
      p("La agenda está pensada para personas mayores de 18 años. Si sos menor, pedile a una persona adulta que reserve por vos."),
      h2("Cambios a esta política"),
      p("Si la cambiamos, publicamos la versión nueva en esta página con su fecha. Si el cambio es importante, te lo vamos a pedir aceptar en la próxima reserva.")
    ].join("");
  }

  function terminos(s) {
    const d = EG.datosLegales(s);
    const r = EG.reglas(s);
    const plazo = r.cambiosHoras > 0 ? `hasta ${U.plural(r.cambiosHoras, "hora")} antes de la cita` : "hasta el horario de la cita";
    return [
      p(`Estos términos rigen el uso de la agenda de citas de <b>${esc(d.nombre)}</b> (la parte 1, para quienes reservan) y del panel de la plataforma Agenda Showroom (la parte 2, para los showrooms que la usan). Al reservar o al crear una cuenta, los aceptás.`),
      h2("1. Reservas (para clientas)"),
      ul([`Quien ofrece la cita es ${esc(d.titular)}${d.cuit ? ` (CUIT ${esc(d.cuit)})` : ""}${d.direccion ? `, ${esc(d.direccion)}` : ""}.`,
        "<b>Reservar no tiene costo</b> y no te obliga a comprar. La agenda no cobra señas ni pagos.",
        "La cita queda confirmada cuando ves la pantalla de confirmación. Los horarios dependen de la disponibilidad y se asignan por orden de reserva.",
        `Podés cancelar o reprogramar desde el link de tu cita ${plazo}${r.maxReprog > 0 ? `, y reprogramar hasta ${U.plural(r.maxReprog, "vez", "veces")}` : ""}. Pasado ese plazo, escribile al showroom.`,
        "Si el showroom tiene que cambiar o cancelar tu cita, te avisa por WhatsApp" + (EG.remote && EG.remote.mails ? " o por mail" : "") + ".",
        "Las prendas que elegís son una <b>preselección</b> para tenerlas listas: no es una compra ni una reserva de stock. Se preparan según disponibilidad.",
        "Si se muestran precios, son orientativos y se confirman en la cita. Las condiciones de compra (mínimo, formas de pago, cambios) son las que informa el showroom.",
        "La videollamada se hace por WhatsApp al número que dejaste; necesitás tener la app y conexión a internet.",
        "Te pedimos datos verdaderos y no reservar horarios que no vas a usar. El showroom puede cancelar reservas hechas con datos falsos o para molestar."]),
      h2("2. Uso del panel (para showrooms)"),
      ul(["<b>Agenda Showroom</b> es la plataforma que le da a cada showroom su página de reservas y su panel. Por ahora el acceso es solo con código de invitación.",
        "Cada showroom es responsable de la cuenta y de las personas que suma a su panel, y de mantener sus contraseñas en secreto.",
        "<b>Datos de las clientas:</b> el showroom es el responsable de su base de datos según la Ley 25.326 (incluida, si corresponde, su inscripción ante la AAIP) y de responder los pedidos de sus clientas. La plataforma trata esos datos solo por cuenta del showroom y para prestar el servicio: no los usa para fines propios, no los cede a terceros y los borra cuando el showroom se da de baja (art. 25, Ley 25.326). El showroom puede exportar sus datos desde el panel en cualquier momento.",
        "El showroom garantiza que tiene derecho a usar las fotos, marcas, logos y textos que carga, y que la información que publica (precios, condiciones, dirección) es correcta.",
        "No se puede usar la plataforma para actividades ilegales, para mandar mensajes no pedidos ni para cargar datos de personas sin informarles.",
        "Hacemos lo posible para que la agenda funcione siempre, pero puede haber cortes o errores. En ese caso, el showroom sigue siendo quien atiende a sus clientas por sus propios medios.",
        "<b>Precio:</b> durante esta etapa de prueba la plataforma no tiene costo. Si más adelante tiene un precio, lo vamos a avisar antes y nadie queda suscripto a un plan pago sin aceptarlo.",
        "El showroom puede dejar de usar la plataforma cuando quiera, pidiendo la baja por el canal de soporte del panel. También podemos suspender una cuenta que no cumpla estos términos, avisando antes salvo en casos graves."]),
      h2("3. Propiedad intelectual"),
      p("El diseño y el software de la agenda pertenecen a la plataforma. Las fotos, marcas y textos de cada showroom son de ese showroom. Los íconos y fuentes que usa la agenda tienen licencias libres (Lucide, ISC; fuentes, SIL Open Font License)."),
      h2("4. Responsabilidad"),
      p("Ninguna parte de estos términos limita los derechos que te da la Ley 24.240 de Defensa del Consumidor cuando sea aplicable."),
      h2("5. Cambios, ley aplicable y contacto"),
      p(`Podemos actualizar estos términos; la versión vigente es la publicada en esta página con su fecha. Se aplica la ley argentina. Para consultas sobre las reservas, escribile al showroom por ${contactoTxt(d)}.`)
    ].join("");
  }

  function cookies(s) {
    const enPanel = EG.remote && EG.remote.on;
    return [
      p("<b>Esta agenda no usa cookies</b> de publicidad, de seguimiento ni de analítica, y no tiene herramientas de terceros como Google Analytics o el píxel de Meta."),
      p("Para funcionar usa el <b>almacenamiento local</b> de tu navegador (parecido a una cookie, pero queda solo en tu dispositivo y no se manda solo a ningún servidor). Esto es lo único que guarda:"),
      `<div class="tabla" role="region" aria-label="Datos guardados en el navegador" tabindex="0"><table><thead><tr><th scope="col">Qué</th><th scope="col">Para qué</th><th scope="col">Cuándo</th><th scope="col">Duración</th></tr></thead><tbody>
        <tr><td>Tus datos de contacto (<code>eg-mis-datos</code>)</td><td>Completar el formulario la próxima vez</td><td>Solo si marcás “Recordar mis datos”</td><td>Hasta que destildes la casilla o borres los datos del navegador</td></tr>
        ${enPanel ? `<tr><td>Sesión del panel (<code>sb-…-auth-token</code>)</td><td>Mantener abierta la sesión del equipo del showroom</td><td>Solo al ingresar al panel</td><td>Hasta cerrar sesión</td></tr>
        <tr><td>Alta pendiente (<code>eg-alta-pendiente</code>)</td><td>Terminar de crear un showroom después de confirmar el mail</td><td>Solo durante el alta</td><td>Se borra al crear el showroom</td></tr>` : `<tr><td>Datos de la agenda (<code>agenda-egoh:v1:…</code>)</td><td>Guardar la agenda en la versión sin conexión</td><td>Solo en la versión de prueba local</td><td>Hasta borrar los datos del navegador</td></tr>`}
      </tbody></table></div>`,
      h2("¿Hace falta aceptar cookies?"),
      p("No te pedimos aceptar un aviso de cookies porque solo se usa almacenamiento necesario para que la agenda funcione, y el de “Recordar mis datos” es opcional: lo activás vos con la casilla. Si en el futuro sumamos herramientas de analítica o de terceros, te vamos a pedir permiso antes de activarlas."),
      h2("Contenido de terceros"),
      p("Las fuentes y los íconos están alojados en la propia agenda, sin conexión con Google Fonts ni otros servicios. " + (EG.esPrincipalLegal() ? "Algunas fotos de prendas se cargan desde la tienda online del showroom (Tiendanube), que puede registrar datos técnicos de la conexión como cualquier servidor web. " : "") + "Los botones de WhatsApp, Instagram y Google Maps son links: no cargan nada hasta que los tocás."),
      h2("Cómo borrar estos datos"),
      p("Destildá “Recordar mis datos” en tu próxima reserva, o borrá los datos del sitio desde la configuración de tu navegador (en Chrome: Configuración → Privacidad y seguridad → Datos de sitios). " + link("privacidad", "Volver a la Política de privacidad") + ".")
    ].join("");
  }

  function reembolsos(s) {
    const d = EG.datosLegales(s);
    return [
      p(`<b>Reservar una cita no tiene costo.</b> La agenda de ${esc(d.nombre)} no cobra señas, depósitos ni pagos online, así que no hay nada para reembolsar por la reserva. Si no podés ir, cancelá o reprogramá desde el link de tu cita.`),
      h2("Compras en el showroom"),
      p(`Las compras se hacen en la cita, directamente con ${esc(d.titular)}. Los cambios, devoluciones y garantías de las prendas se rigen por la política del showroom (consultala en la cita o por ${contactoTxt(d)}) y por las leyes que correspondan según el tipo de compra.`),
      h2("Planes pagos para showrooms"),
      p("Hoy la plataforma no cobra a los showrooms. Si en el futuro hay planes pagos contratados online, vamos a publicar en la página principal el <b>botón de arrepentimiento</b> (para revocar la contratación dentro de los 10 días corridos) y el <b>botón de baja</b>, como pide la normativa de defensa del consumidor, junto con las condiciones de reembolso de cada plan.")
    ].join("");
  }

  EG.esPrincipalLegal = () => !EG.remote || !EG.remote.on || EG.remote.esPrincipal();

  EG.views.legal = function () {
    const s = S.db.settings;
    const pag = EG.LEGAL_PAGINAS.find((x) => x[0] === S.ui.legal) || EG.LEGAL_PAGINAS[0];
    const cuerpo = { privacidad, terminos, cookies, reembolsos }[pag[0]](s);
    const d = EG.datosLegales(s);
    return `<header class="pubtop"><div class="in">${U.logo(s)}</div></header>
      <main class="pubwrap narrow legal">
        <button type="button" class="back" data-act="legal.volver">${I("chevron-left", 16)}Volver</button>
        <nav class="pills scroll" aria-label="Páginas legales">${EG.LEGAL_PAGINAS.map((x) => `<a class="pill" href="#/legal/${x[0]}" ${x[0] === pag[0] ? 'aria-current="page"' : ""}>${x[1].replace("Política de ", "").replace(/^./, (c) => c.toUpperCase())}</a>`).join("")}</nav>
        <h1>${pag[1]}</h1><p class="xs muted">Última actualización: ${ACTUALIZADA}</p>
        ${!d.completos && S.ui.fromPanel ? `<p class="notice warn">Faltan datos legales del showroom (razón social, CUIT o contacto). Completalos en Perfil público → Datos legales.</p>` : ""}
        <article class="prose">${cuerpo}</article>
      </main>${EG.pieLegal(s)}`;
  };
  EG.actions["legal.volver"] = () => {
    if (history.length > 1) history.back();
    else S.go("reservar");
    return false;
  };
})();
