/**
 * Métodos de pago de una entidad, por país.
 * La API guarda solo el código (pm | acct | email | id | none) y hasta 4 datos en orden; cada país
 * le da a cada código su propio nombre y campos, así que no cambia nada en el servidor.
 *   label: nombre que ve el usuario   f: campos (máx. 4)   show: campo que se muestra en la lista
 */
const DEF_NONE = { label: "Sin datos", f: [] };
const DEF_EMAIL = { label: "Correo", f: ["Correo electrónico", "Titular"] };
const DEF_ID = { label: "ID de usuario", f: ["ID o usuario", "Plataforma"] };

const COMMON = { email: DEF_EMAIL, id: DEF_ID, none: DEF_NONE };

const COUNTRY_METHODS = {
  VE: {
    order: ["pm", "acct", "email", "id", "none"],
    kinds: { banco: "pm", digital: "email" },
    defs: {
      ...COMMON,
      pm: { label: "Pago Móvil", f: ["Banco", "Teléfono", "Cédula"], show: 1 },
      acct: {
        label: "Cuenta bancaria",
        f: ["N.º de cuenta", "Titular", "Cédula o RIF"],
      },
    },
  },
  CO: {
    order: ["pm", "acct", "email", "id", "none"],
    kinds: { banco: "acct", digital: "pm" },
    defs: {
      ...COMMON,
      pm: {
        label: "Nequi / Daviplata",
        f: ["Aplicación", "Celular", "Titular"],
        show: 1,
      },
      acct: {
        label: "Cuenta bancaria",
        f: ["Banco", "Tipo de cuenta", "N.º de cuenta", "Titular"],
        show: 2,
      },
    },
  },
  MX: {
    order: ["acct", "pm", "email", "id", "none"],
    kinds: { banco: "acct", digital: "email" },
    defs: {
      ...COMMON,
      acct: {
        label: "CLABE interbancaria",
        f: ["CLABE (18 dígitos)", "Banco", "Titular"],
      },
      pm: {
        label: "Tarjeta de débito",
        f: ["N.º de tarjeta", "Banco", "Titular"],
      },
    },
  },
  PE: {
    order: ["pm", "acct", "email", "id", "none"],
    kinds: { banco: "acct", digital: "pm" },
    defs: {
      ...COMMON,
      pm: {
        label: "Yape / Plin",
        f: ["Aplicación", "Celular", "Titular"],
        show: 1,
      },
      acct: {
        label: "Cuenta bancaria / CCI",
        f: ["N.º de cuenta o CCI", "Banco", "Titular"],
      },
    },
  },
  CL: {
    order: ["acct", "pm", "email", "id", "none"],
    kinds: { banco: "acct", digital: "pm" },
    defs: {
      ...COMMON,
      acct: {
        label: "Cuenta bancaria",
        f: ["Banco", "Tipo de cuenta", "N.º de cuenta", "RUT"],
        show: 2,
      },
      pm: {
        label: "Mach / Tenpo / otra app",
        f: ["Aplicación", "Teléfono o correo", "Titular"],
        show: 1,
      },
    },
  },
  AR: {
    order: ["acct", "pm", "email", "id", "none"],
    kinds: { banco: "acct", digital: "pm" },
    defs: {
      ...COMMON,
      acct: {
        label: "CBU / CVU",
        f: ["CBU o CVU", "Alias", "Titular", "CUIT o CUIL"],
      },
      pm: {
        label: "Mercado Pago u otra billetera",
        f: ["Aplicación", "Alias o CVU", "Titular"],
        show: 1,
      },
    },
  },
  EC: {
    order: ["acct", "pm", "email", "id", "none"],
    kinds: { banco: "acct", digital: "pm" },
    defs: {
      ...COMMON,
      acct: {
        label: "Cuenta bancaria",
        f: ["Banco", "Tipo de cuenta", "N.º de cuenta", "Cédula"],
        show: 2,
      },
      pm: {
        label: "Billetera móvil",
        f: ["Aplicación", "Celular", "Titular"],
        show: 1,
      },
    },
  },
  DO: {
    order: ["acct", "pm", "email", "id", "none"],
    kinds: { banco: "acct", digital: "pm" },
    defs: {
      ...COMMON,
      acct: {
        label: "Cuenta bancaria",
        f: ["Banco", "Tipo de cuenta", "N.º de cuenta", "Cédula"],
        show: 2,
      },
      pm: {
        label: "Billetera / pago móvil",
        f: ["Aplicación", "Celular", "Titular"],
        show: 1,
      },
    },
  },
  ES: {
    order: ["acct", "pm", "email", "id", "none"],
    kinds: { banco: "acct", digital: "pm" },
    defs: {
      ...COMMON,
      acct: {
        label: "Cuenta bancaria (IBAN)",
        f: ["IBAN", "Banco", "Titular"],
      },
      pm: { label: "Bizum", f: ["Teléfono", "Titular"] },
    },
  },
  US: {
    order: ["acct", "pm", "email", "id", "none"],
    kinds: { banco: "acct", digital: "pm" },
    defs: {
      ...COMMON,
      acct: {
        label: "Cuenta bancaria",
        f: ["Banco", "N.º de ruta (routing)", "N.º de cuenta", "Titular"],
        show: 2,
      },
      pm: {
        label: "Zelle / Venmo / Cash App",
        f: ["Aplicación", "Teléfono, correo o $usuario", "Titular"],
        show: 1,
      },
    },
  },
};

/** Métodos de pago del país: { order, defs, defaultFor(kind) }. Sin país conocido = Venezuela. */
export function methodsFor(country) {
  const m = COUNTRY_METHODS[country] || COUNTRY_METHODS.VE;
  return {
    order: m.order,
    defs: m.defs,
    // Método sugerido al elegir el tipo de entidad (efectivo y otro no llevan datos de pago)
    defaultFor: (kind) => m.kinds[kind] || "none",
  };
}

/** Texto corto para la lista: «Método · dato principal». */
export function paymentSummary(methods, type, data) {
  const def = methods.defs[type];
  const v = (data || []).filter(Boolean);
  if (type === "none" || !v.length || !def) return "Sin datos de pago";
  const main = (data || [])[def.show ?? 0] || v[0];
  return def.label + " · " + main;
}
