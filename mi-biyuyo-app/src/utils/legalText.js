/**
 * Términos de uso, planes y pagos, política de reembolsos y privacidad (texto que ve el usuario en
 * Ajustes > Acerca de > Términos y reembolsos). Es la única fuente del texto: docs/TERMINOS-Y-REEMBOLSOS.md
 * se genera a partir de este archivo. Revísalo (idealmente con un asesor) antes de empezar a cobrar.
 */
export const SUPPORT_EMAIL = "contacto.sumadev@gmail.com";
export const REFUND_DAYS = 7; // ventana para pedir un reembolso cuando corresponde

export const LEGAL_UPDATED = "noviembre de 2026";

export const LEGAL_SECTIONS = [
  {
    title: "1. Qué es Mi Biyuyo",
    body: [
      "Mi Biyuyo es una herramienta para llevar el control de tus finanzas personales: ingresos, gastos, entidades, deudas y estadísticas.",
      "No es una entidad financiera, no mueve ni custodia tu dinero y no ofrece asesoría financiera. Las tasas de cambio (BCV y Binance P2P) son referenciales y pueden diferir de las que uses en la práctica.",
    ],
  },
  {
    title: "2. Tu cuenta y tus datos",
    body: [
      "Eres responsable de la información que registras y de mantener segura tu contraseña. Tus datos se guardan en nuestro servidor para que los tengas en todos tus dispositivos.",
      "Solo tú ves tus movimientos, entidades y estadísticas. No vendemos ni compartimos tu información con terceros, salvo lo necesario para operar el servicio (por ejemplo, el envío de correos) o si una autoridad competente lo exige.",
    ],
  },
  {
    title: "3. Planes Gratis y Premium",
    body: [
      "Mi Biyuyo tiene un plan Gratis y un plan Premium. El plan Gratis incluye 1 entidad, el registro de ingresos y gastos y las estadísticas básicas (Balance del período, Ahorro / Brecha Binance y Distribución del saldo).",
      "Premium agrega más de una entidad y transferencias, por cobrar y por pagar, gastos planificados, categorías propias, detalle de la compra con recibos, estadísticas completas y exportar a Excel.",
      "Al crear tu cuenta recibes un período de prueba con todas las funciones Premium. Su duración se muestra en la app y puede cambiar para cuentas nuevas.",
    ],
  },
  {
    title: "4. Cómo se paga",
    body: [
      "El pago es manual: eliges un plan y un método (Pago móvil, Zinli o PayPal), haces el pago con los datos que te mostramos en la app y nos informas la referencia con «Ya pagué». No hay cobros automáticos ni renovación automática: tú decides cuándo renovar.",
      "Los precios están en dólares (USD). Si pagas por Pago móvil, el monto en bolívares se calcula con la tasa BCV oficial del momento y se te muestra exacto antes de pagar.",
      "Revisamos cada pago a mano. Cuando lo aprobamos, Premium se activa y te avisamos. Si no podemos aprobarlo, verás el motivo en Mi plan y por correo.",
      "Un plan mensual dura 30 días y uno anual 365. Si ya tienes Premium y pagas de nuevo, los días se suman a los que te quedaban.",
    ],
  },
  {
    title: "5. Cuando termina tu Premium o tu prueba",
    body: [
      "Pasas al plan Gratis y no se borra nada de lo que registraste. Lo que Gratis no incluye se sigue viendo, pero no se puede registrar de nuevo: las entidades adicionales quedan en solo lectura y tus categorías propias dejan de poder elegirse al registrar.",
      "Si activas Premium otra vez, todo vuelve a funcionar como antes.",
    ],
  },
  {
    title: "6. Reembolsos",
    body: [
      `Los pagos de Premium no son reembolsables una vez activado el plan, salvo en estos casos, que debes reportar dentro de los ${REFUND_DAYS} días siguientes al pago: cobro duplicado, error en el monto cobrado, o que no hayamos podido activar Premium.`,
      `Para pedirlo, escríbenos a ${SUPPORT_EMAIL} con tu correo de la cuenta y la referencia del pago. El reembolso se hace por el mismo método de pago; si el método cobra una comisión, puede descontarse.`,
      "Si un pago es rechazado y el dinero llegó a salir de tu cuenta, te lo devolvemos.",
    ],
  },
  {
    title: "7. Cambios en precios y planes",
    body: [
      "Podemos cambiar los precios o lo que incluye cada plan. Te avisaremos en la app y el cambio no afecta los días de Premium que ya pagaste.",
    ],
  },
  {
    title: "8. Uso adecuado",
    body: [
      "No está permitido enviar comprobantes falsos, usar códigos de canje que no te correspondan ni intentar saltarte las restricciones del plan. Podemos suspender cuentas que lo hagan.",
    ],
  },
  {
    title: "9. Privacidad",
    body: [
      "Guardamos tu nombre, tu correo, los datos financieros que registras (entidades, movimientos, deudas) y, si los envías, los comprobantes de pago. Los comprobantes solo los ve quien administra Mi Biyuyo, para verificar tu pago.",
      `Puedes pedir que corrijamos o eliminemos tu cuenta y tus datos escribiendo a ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    title: "10. Contacto",
    body: [`Escríbenos a ${SUPPORT_EMAIL}.`],
  },
];
