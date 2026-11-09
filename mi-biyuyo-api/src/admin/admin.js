/* Panel de administración de Mi Biyuyo. Todo el texto de usuarios se inserta con textContent
   (nunca como HTML) para que una referencia o un nombre malicioso no pueda ejecutar código. */
(function () {
  "use strict";
  var KEY = "mb_admin_key";
  var view = document.getElementById("view");
  var msg = document.getElementById("msg");
  var authBox = document.getElementById("auth");
  var tabsBox = document.getElementById("tabs");
  var tab = "payments";

  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === "class") el.className = props[k];
      else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== undefined && props[k] !== null) el[k] = props[k];
    });
    function add(c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) return c.forEach(add);
      el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    }
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }
  function say(text, bad) {
    msg.textContent = text || "";
    msg.className = bad ? "bad" : "mut";
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function getKey() { try { return sessionStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function setKey(v) { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) {} }
  var fmt = function (d) { return d ? new Date(d).toLocaleString("es-VE") : "—"; };
  var money = function (n, c) { return n == null ? "—" : Number(n).toFixed(2) + " " + (c || ""); };

  function api(method, path, body) {
    return fetch("/api/admin" + path, {
      method: method,
      headers: { "Content-Type": "application/json", "x-admin-key": getKey() },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          if (r.status === 401) { setKey(""); renderAuth(); }
          throw new Error(j.error || "Error " + r.status);
        }
        return j;
      });
    });
  }
  function run(p, ok) {
    say("Procesando…");
    return p.then(function (r) { say(ok || "Listo"); return r; })
      .catch(function (e) { say(e.message, true); throw e; });
  }

  /* ---------- acceso ---------- */
  function renderAuth() {
    clear(authBox); clear(view); clear(tabsBox);
    if (getKey()) {
      authBox.appendChild(h("button", { onclick: function () { setKey(""); renderAuth(); say(""); } }, "Salir"));
      renderTabs(); show();
      return;
    }
    var input = h("input", { type: "password", placeholder: "Clave de administración", autocomplete: "off" });
    var go = function () {
      setKey(input.value);
      api("GET", "/plans").then(function () { say(""); renderAuth(); }).catch(function (e) { setKey(""); say(e.message, true); });
    };
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    authBox.appendChild(input);
    authBox.appendChild(h("button", { class: "pri", onclick: go }, "Entrar"));
  }
  var TABS = [["payments", "Pagos"], ["codes", "Códigos"], ["users", "Usuarios"], ["settings", "Configuración"], ["receivers", "Datos de cobro"]];
  function renderTabs() {
    clear(tabsBox);
    TABS.forEach(function (t) {
      tabsBox.appendChild(h("button", { class: tab === t[0] ? "on" : "", onclick: function () { tab = t[0]; renderTabs(); show(); } }, t[1]));
    });
  }
  function show() {
    clear(view);
    ({ payments: viewPayments, codes: viewCodes, users: viewUsers, settings: viewSettings, receivers: viewReceivers })[tab]();
  }

  /* ---------- pagos ---------- */
  var payFilter = "pending";
  function viewPayments() {
    var sel = h("select", { onchange: function () { payFilter = sel.value; viewPayments(); } },
      [["pending", "Pendientes"], ["", "Todos"], ["approved", "Aprobados"], ["rejected", "Rechazados"]].map(function (o) {
        return h("option", { value: o[0], selected: o[0] === payFilter }, o[1]);
      }));
    clear(view);
    view.appendChild(h("div", { class: "row" }, h("b", null, "Pagos"), sel));
    var list = h("div", { class: "card" }, "Cargando…");
    view.appendChild(list);
    api("GET", "/payments" + (payFilter ? "?status=" + payFilter : "")).then(function (rows) {
      clear(list);
      if (!rows.length) list.appendChild(h("span", { class: "mut" }, "No hay pagos en esta lista."));
      rows.forEach(function (p) { list.appendChild(paymentCard(p)); });
    }).catch(function (e) { say(e.message, true); });
  }
  function paymentCard(p) {
    var low = p.paid_amount != null && p.expected_amount != null && p.paid_amount < p.expected_amount * 0.98;
    var holder = h("div");
    var box = h("div", { class: "card" },
      h("div", { class: "row" }, h("b", null, p.email), h("span", { class: "tag" }, p.status), h("span", { class: "mut" }, p.name)),
      h("div", null, "Plan ", h("b", null, p.plan_code), " (" + p.plan_days + " días) · ", h("b", null, p.method), " · ref. ", h("b", null, p.reference)),
      h("div", { class: low ? "bad" : "" }, "Esperado: " + money(p.expected_amount, p.expected_currency) + " · Pagó: " + money(p.paid_amount, p.paid_currency) + (low ? "  ⚠ menos de lo esperado" : "")),
      h("div", { class: "mut" }, "Solicitado: " + fmt(p.requested_at) + (p.reviewed_at ? " · Revisado: " + fmt(p.reviewed_at) : "") + (p.reject_reason ? " · Motivo: " + p.reject_reason : "")),
      holder,
      h("div", { class: "row" },
        p.has_proof && h("button", { onclick: function () { showProof(p.id, holder); } }, "Ver comprobante"),
        p.status === "pending" && h("button", { class: "pri", onclick: function () {
          if (!confirm("¿Aprobar el pago de " + p.email + "? Se sumarán " + p.plan_days + " días de Premium.")) return;
          run(api("POST", "/payments/" + p.id + "/approve"), "Pago aprobado").then(viewPayments);
        } }, "Aprobar"),
        p.status === "pending" && h("button", { class: "bad", onclick: function () {
          var reason = prompt("Motivo del rechazo (el usuario lo verá):");
          if (!reason) return;
          run(api("POST", "/payments/" + p.id + "/reject", { reason: reason }), "Pago rechazado").then(viewPayments);
        } }, "Rechazar")));
    return box;
  }
  function showProof(id, holder) {
    clear(holder);
    api("GET", "/payments/" + id + "/proof").then(function (p) {
      if (/^data:image\//i.test(p.data)) holder.appendChild(h("img", { class: "proof", src: p.data, alt: "Comprobante" }));
      else holder.appendChild(h("a", { href: p.data, download: p.name || "comprobante" }, "Descargar comprobante"));
    }).catch(function (e) { say(e.message, true); });
  }

  /* ---------- códigos ---------- */
  function viewCodes() {
    clear(view);
    var planSel = h("select", null, h("option", { value: "" }, "Días sueltos"));
    var days = h("input", { type: "number", min: 1, value: 30, style: "width:90px" });
    var count = h("input", { type: "number", min: 1, max: 50, value: 1, style: "width:80px" });
    var exp = h("input", { type: "number", min: 1, placeholder: "días (opcional)", style: "width:130px" });
    var out = h("textarea", { readOnly: true, placeholder: "Aquí aparecen los códigos generados" });
    api("GET", "/plans").then(function (ps) { ps.forEach(function (p) { planSel.appendChild(h("option", { value: p.code }, p.name + " (" + p.days + " días)")); }); });
    view.appendChild(h("div", { class: "card" },
      h("b", null, "Generar códigos de canje"),
      h("div", { class: "row" }, "Otorga:", planSel, "o", days, "días"),
      h("div", { class: "row" }, "Cantidad:", count, "Vigencia del código:", exp),
      h("button", { class: "pri", onclick: function () {
        var body = { count: Number(count.value) };
        if (planSel.value) body.plan_code = planSel.value; else body.days = Number(days.value);
        if (exp.value) body.expires_in_days = Number(exp.value);
        run(api("POST", "/codes", body), "Códigos generados").then(function (r) { out.value = r.codes.join("\n"); loadList(); });
      } }, "Generar"),
      out));
    var list = h("div", { class: "card" });
    view.appendChild(list);
    function loadList() {
      clear(list); list.appendChild(h("b", null, "Últimos códigos"));
      api("GET", "/codes").then(function (rows) {
        rows.forEach(function (c) {
          list.appendChild(h("div", { class: "row" },
            h("code", null, c.code),
            h("span", { class: "mut" }, (c.plan_code || c.days + " días") + (c.expires_at ? " · vence " + fmt(c.expires_at) : "")),
            c.used_at ? h("span", { class: "tag" }, "usado por " + (c.used_by_email || "?")) : h("button", { class: "bad", onclick: function () {
              run(api("DELETE", "/codes/" + c.id), "Código eliminado").then(loadList);
            } }, "Eliminar")));
        });
      });
    }
    loadList();
  }

  /* ---------- usuarios ---------- */
  function viewUsers() {
    clear(view);
    var q = h("input", { placeholder: "Correo (mín. 3 letras)" });
    var res = h("div");
    var find = function () {
      clear(res);
      api("GET", "/users?q=" + encodeURIComponent(q.value)).then(function (rows) {
        if (!rows.length) res.appendChild(h("span", { class: "mut" }, "Sin resultados."));
        rows.forEach(function (u) { res.appendChild(userCard(u)); });
      }).catch(function (e) { say(e.message, true); });
    };
    q.addEventListener("keydown", function (e) { if (e.key === "Enter") find(); });
    view.appendChild(h("div", { class: "card" }, h("b", null, "Buscar usuario"), h("div", { class: "row" }, q, h("button", { class: "pri", onclick: find }, "Buscar")), res));

    var bulk = h("input", { type: "number", value: 7, style: "width:90px" });
    view.appendChild(h("div", { class: "card" },
      h("b", null, "Ajustar la prueba de todos los que están en prueba ahora"),
      h("span", { class: "mut" }, "Suma (o resta, con un número negativo) días a su fin de prueba. Nadie queda antes de hoy."),
      h("div", { class: "row" }, "Días:", bulk, h("button", { class: "bad", onclick: function () {
        if (!confirm("¿Ajustar la prueba de TODOS los usuarios en prueba en " + bulk.value + " días?")) return;
        run(api("POST", "/trial/bulk", { days: Number(bulk.value), confirm: true })).then(function (r) { say("Usuarios ajustados: " + r.updated); });
      } }, "Aplicar a todos"))));
  }
  function userCard(u) {
    var days = h("input", { type: "number", value: 30, style: "width:90px" });
    return h("div", { class: "card" },
      h("div", { class: "row" }, h("b", null, u.email), h("span", { class: "tag" }, u.plan), h("span", { class: "mut" }, u.name)),
      h("div", { class: "mut" }, "Prueba hasta: " + fmt(u.trial_ends_at) + " · Premium hasta: " + fmt(u.premium_until)),
      h("div", { class: "row" }, "Días:", days,
        h("button", { class: "pri", onclick: function () {
          run(api("POST", "/gift", { email: u.email, target: "premium", days: Number(days.value) }), "Premium extendido").then(viewUsers);
        } }, "Regalar Premium"),
        h("button", { onclick: function () {
          run(api("POST", "/gift", { email: u.email, target: "trial", days: Number(days.value) }), "Prueba ajustada").then(viewUsers);
        } }, "Sumar/restar a la prueba")));
  }

  /* ---------- configuración y planes ---------- */
  function viewSettings() {
    clear(view);
    var f = { trial_days: h("input", { type: "number", min: 0, max: 365, style: "width:100px" }), trial_days_existing: h("input", { type: "number", min: 0, max: 365, style: "width:100px" }), bcv_rate_override: h("input", { placeholder: "vacío = automática", style: "width:160px" }) };
    api("GET", "/settings").then(function (rows) { rows.forEach(function (r) { if (f[r.key]) f[r.key].value = r.value; }); });
    view.appendChild(h("div", { class: "card" },
      h("b", null, "Días de prueba"),
      h("span", { class: "mut" }, "Solo afecta a quienes empiecen su prueba después del cambio. 0 = sin prueba."),
      h("div", { class: "row" }, "Usuarios nuevos:", f.trial_days, "Usuarios que ya existían:", f.trial_days_existing),
      h("b", null, "Tasa BCV para cobros en bolívares"),
      h("div", { class: "row" }, "Fijar tasa (VES por USD):", f.bcv_rate_override),
      h("button", { class: "pri", onclick: function () {
        run(api("PUT", "/settings", { trial_days: f.trial_days.value, trial_days_existing: f.trial_days_existing.value, bcv_rate_override: f.bcv_rate_override.value }), "Configuración guardada");
      } }, "Guardar")));
    var plans = h("div", { class: "card" }, h("b", null, "Planes y precios"));
    view.appendChild(plans);
    api("GET", "/plans").then(function (ps) {
      ps.forEach(function (p) {
        var name = h("input", { value: p.name, style: "width:120px" });
        var price = h("input", { type: "number", step: "0.01", value: p.price_usd, style: "width:100px" });
        var d = h("input", { type: "number", value: p.days, style: "width:90px" });
        var act = h("input", { type: "checkbox", checked: p.active });
        plans.appendChild(h("div", { class: "row" }, h("code", null, p.code), name, "USD", price, "Días", d, h("label", null, act, " activo"),
          h("button", { class: "pri", onclick: function () {
            run(api("PUT", "/plans/" + p.code, { name: name.value, price_usd: price.value, days: d.value, active: act.checked }), "Plan guardado");
          } }, "Guardar")));
      });
    });
  }

  /* ---------- datos de cobro ---------- */
  function viewReceivers() {
    clear(view);
    var list = h("div");
    view.appendChild(h("div", { class: "card" }, h("b", null, "Datos de cobro que ve el usuario"),
      h("span", { class: "mut" }, "Método: pago_movil se cobra en bolívares; cualquier otro (zinli, paypal, binance_pay…) en USD. Un dato por línea con el formato «Campo: valor»."), list));
    function row(r) {
      var m = h("input", { value: r.method || "", placeholder: "método (ej: pago_movil)", style: "width:170px" });
      var l = h("input", { value: r.label || "", placeholder: "Nombre visible" });
      var d = h("textarea", { value: (r.details || []).map(function (x) { return x.label + ": " + x.value; }).join("\n"), placeholder: "Banco: 0102 - Banco de Venezuela\nTeléfono: 0414…" });
      var o = h("input", { type: "number", value: r.sort_order || 0, style: "width:70px" });
      var a = h("input", { type: "checkbox", checked: r.active !== false });
      var read = function () {
        return { method: m.value, label: l.value, sort_order: Number(o.value), active: a.checked,
          details: d.value.split("\n").map(function (line) { var i = line.indexOf(":"); return i > 0 ? { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() } : null; }).filter(Boolean) };
      };
      return h("div", { class: "card" }, h("div", { class: "row" }, m, l, "Orden", o, h("label", null, a, " activo")), d,
        h("div", { class: "row" },
          h("button", { class: "pri", onclick: function () { run(r.id ? api("PUT", "/receivers/" + r.id, read()) : api("POST", "/receivers", read()), "Guardado").then(viewReceivers); } }, "Guardar"),
          r.id && h("button", { class: "bad", onclick: function () { if (confirm("¿Eliminar este dato de cobro?")) run(api("DELETE", "/receivers/" + r.id), "Eliminado").then(viewReceivers); } }, "Eliminar")));
    }
    api("GET", "/receivers").then(function (rows) {
      rows.forEach(function (r) { list.appendChild(row(r)); });
      list.appendChild(h("h4", null, "Agregar nuevo"));
      list.appendChild(row({}));
    });
  }

  renderAuth();
})();
