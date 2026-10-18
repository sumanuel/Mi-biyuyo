import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Card,
  Tile,
  TonePill,
  DispTabs,
  ProgressBar,
  ConvRows,
  Button,
  Empty,
} from "../../components/ui";
import { META, debtStatus } from "../../utils/ledger";
import { CCY_KEYS, CCY_LABEL, dlabel, fullDate, grp } from "../../utils/money";
import { confirm } from "../../utils/confirm";

export default function DebtDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv, actions, showToast } = useData();
  const { fx } = model;
  const debt = model.moveById[route.params?.id];

  if (!debt) {
    return (
      <Screen>
        <Header title="Detalle" onBack={() => navigation.goBack()} />
        <Empty text="No se encontró esta deuda." />
      </Screen>
    );
  }

  const isCobro = debt.type === "cobrar";
  const tint = colors[debt.type];
  const paid = model.paidOf(debt);
  const pend = model.pendOf(debt);
  const st = debtStatus(model, debt);
  const closed = pend <= 0.005;

  // Datos de la deuda para verlos sin entrar a editar: quién, descripción, fechas y entidad
  const info = [
    debt.person && [
      META[debt.type].personLabel.replace(/[¿?]/g, ""),
      debt.person,
    ],
    debt.hasDesc && ["Descripción", debt.title],
    ["Categoría", debt.cat.name],
    [
      "Registrada el",
      fullDate(debt.date) +
        (debt.ent && debt.cash !== false
          ? " · " + model.entName(debt.ent)
          : ""),
    ],
    !debt.sched &&
      debt.dueDate && [
        "Vence el",
        fullDate(debt.dueDate) +
          (debt.recurring ? " · se repite cada mes" : ""),
      ],
    debt.notes && ["Notas", debt.notes],
  ].filter(Boolean);

  // Elimina la deuda con todos sus abonos. Los saldos de las entidades se calculan a partir de los
  // movimientos y abonos guardados, así que al borrarlos quedan como si la deuda nunca se hubiera registrado.
  const remove = async () => {
    const n = debt.pays.length;
    const ok = await confirm(
      isCobro ? "Eliminar cuenta por cobrar" : "Eliminar cuenta por pagar",
      `Esta acción es irreversible.\n\nSe eliminará «${debt.title}»` +
        (n
          ? ` junto con ${n === 1 ? "su abono" : `sus ${n} abonos`} (${dv(paid)} ${isCobro ? "cobrados" : "pagados"}).`
          : ".") +
        "\n\nLos saldos de tus entidades se recalcularán como si esta deuda nunca se hubiera registrado" +
        (n
          ? ": se revierte también el dinero que entró o salió con cada abono."
          : "."),
    );
    if (!ok) return;
    try {
      await actions.deleteMovement(debt.id);
      showToast("Deuda eliminada");
      // Si se llegó desde el detalle del movimiento, ese ya no existe: se vuelve dos pantallas atrás
      const routes = navigation.getState().routes;
      if (routes[routes.length - 2]?.name === "MovementDetail")
        navigation.pop(2);
      else navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  // Elimina un abono (por ejemplo, si se registró mal) para poder volver a registrarlo.
  // Los saldos se calculan con los abonos guardados: al borrarlo, el dinero vuelve a la entidad
  // y la deuda recupera ese saldo pendiente (si estaba saldada, vuelve a quedar activa).
  const removePay = async (p) => {
    const what = isCobro ? "cobro" : "pago";
    const ok = await confirm(
      "Eliminar " + what,
      `Esta acción es irreversible.

Se eliminará el ${what} de ${fx.money(p.ccy, p.val[p.ccy])} del ${fullDate(p.date)}.` +
        `

La deuda recupera ese saldo pendiente${closed ? " y vuelve a quedar activa" : ""}, y ` +
        (p.ent
          ? `el dinero ${isCobro ? "sale de" : "vuelve a"} ${model.entName(p.ent)}.`
          : "no cambia ninguna entidad.") +
        `

Después podrás registrar el ${what} de nuevo.`,
    );
    if (!ok) return;
    try {
      await actions.deletePayment(debt.id, p.id);
      showToast(isCobro ? "Cobro eliminado" : "Pago eliminado");
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  // Historial: del más reciente al más antiguo. Cada abono conserva su valor del día;
  // el saldo tras cada abono se calcula en la moneda de la deuda y se valúa con la tasa de hoy.
  let runNative = model.totalNative(debt);
  const pays = debt.pays
    .slice()
    .sort((a, b) =>
      a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1,
    );
  // Deuda en cuotas: qué cuotas cubre cada abono (los abonos las van cubriendo en orden)
  const tol = debt.ccy === "bin" ? 0.005 : 0.01;
  let cum = 0;
  const instLabel = (p) => {
    if (!debt.sched) return null;
    const from = cum;
    cum += p.val[debt.ccy];
    let start = 0;
    const full = [];
    const completes = [];
    const partial = [];
    debt.sched.forEach((c) => {
      const end = start + c.amt;
      const overlap = Math.min(cum, end) - Math.max(from, start);
      if (overlap > tol) {
        if (cum >= end - tol)
          (from <= start + tol ? full : completes).push(c.n);
        else partial.push(c.n);
      }
      start = end;
    });
    const list = (ns) =>
      ns.length > 2 && ns.every((n, i) => i === 0 || n === ns[i - 1] + 1)
        ? `${ns[0]} a ${ns[ns.length - 1]}`
        : ns.join(" y ");
    const parts = [];
    if (full.length)
      parts.push(
        `${full.length === 1 ? "Cuota" : "Cuotas"} ${list(full)} de ${debt.inst}`,
      );
    if (completes.length)
      parts.push(
        `completa la ${completes.length === 1 ? "cuota" : "cuotas"} ${list(completes)}`,
      );
    if (partial.length) parts.push(`abono a la cuota ${list(partial)}`);
    const text = parts.join(" · ");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
  };
  const timeline = pays
    .map((p) => {
      const inst = instLabel(p);
      runNative = Math.max(0, runNative - p.val[debt.ccy]);
      const settled = runNative <= (debt.ccy === "bin" ? 0.005 : 0.01);
      const r = p.rate || fx.FACT[p.ccy];
      return {
        key: "p" + p.id,
        pay: p,
        inst,
        title: (isCobro ? "Cobro" : "Pago") + " · " + p.method,
        sub:
          dlabel(p.date) +
          " · " +
          (p.ccy === "usd"
            ? "Moneda base"
            : p.ccy === "bin"
              ? "1 USDT = USD " + grp(1 / r, ",", ".")
              : "Tasa " + grp(r, ".", ",")),
        amount: (isCobro ? "+" : "-") + fx.money(p.ccy, p.val[p.ccy]),
        eq: "≈ " + fx.money("usd", p.usd),
        rest: settled
          ? "Saldada"
          : "Saldo " + dv(model.usdOfNative(debt, runNative)),
        restOk: settled,
        dot: tint.strong,
      };
    })
    .reverse();
  timeline.push({
    key: "origin",
    title: "Deuda registrada",
    sub: dlabel(debt.date) + " · " + CCY_LABEL[debt.ccy],
    amount: fx.money(debt.ccy, model.totalNative(debt)),
    eq: "≈ " + fx.money("usd", debt.usd),
    rest: "",
    neutral: true,
    dot: colors.muted,
  });

  const rows = CCY_KEYS.map((k) => ({
    label: CCY_LABEL[k],
    sub: fx.rateTxt(k),
    value: fx.ready(k) ? fx.money(k, fx.fromUsd(k, pend)) : "Sin tasa",
  }));

  return (
    <Screen
      contentStyle={{ paddingTop: 16 }}
      footer={
        <Footer>
          <Button
            label={
              closed
                ? "Deuda saldada"
                : isCobro
                  ? "Registrar cobro"
                  : "Registrar pago"
            }
            disabled={closed}
            bg={tint.strong}
            height={54}
            onPress={() => navigation.navigate("Pay", { id: debt.id })}
          />
        </Footer>
      }
    >
      <Header
        title={isCobro ? "Detalle por cobrar" : "Detalle por pagar"}
        onBack={() => navigation.goBack()}
      />

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Tile
            icon={debt.cat.icon}
            soft={tint.soft}
            fg={tint.fg}
            size={44}
            radius={14}
            iconSize={22}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: "700" }}>
              {debt.person || debt.title}
            </Txt>
            <Txt
              numberOfLines={1}
              style={{ fontSize: 12, color: colors.textSecondary }}
            >
              {debt.cat.name} · {debt.title}
            </Txt>
          </View>
          <TonePill label={st.t} toneName={st.tone} />
        </View>
        <View style={{ gap: 2 }}>
          <Txt
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              fontWeight: "600",
            }}
          >
            {isCobro ? "Saldo por cobrar" : "Saldo por pagar"}
          </Txt>
          <Txt style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.6 }}>
            {dv(pend)}
          </Txt>
        </View>
        <ProgressBar
          pct={
            model.totalNative(debt) > 0
              ? Math.round(
                  ((model.totalNative(debt) - model.pendNative(debt)) /
                    model.totalNative(debt)) *
                    100,
                )
              : 0
          }
          color={tint.strong}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            {(isCobro ? "Cobrado " : "Pagado ") + dv(paid)}
          </Txt>
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            Total {dv(model.totalOf(debt))}
          </Txt>
        </View>
        {debt.recurring ? (
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            Se repite cada mes: al saldarla se crea la del mes siguiente.
          </Txt>
        ) : null}
      </Card>

      <Card pad={14} style={{ gap: 2 }}>
        <Txt
          style={{
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.5,
            color: colors.textSecondary,
            paddingBottom: 4,
          }}
        >
          DATOS DE LA DEUDA
        </Txt>
        {info.map(([label, value], i) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 16,
              paddingVertical: 9,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.divider,
            }}
          >
            <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
              {label}
            </Txt>
            <Txt
              style={{
                flex: 1,
                textAlign: "right",
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              {value}
            </Txt>
          </View>
        ))}
        {debt.items.length ? (
          <View style={{ paddingTop: 6, gap: 4 }}>
            <Txt
              style={{
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.5,
                color: colors.textSecondary,
              }}
            >
              DETALLE
            </Txt>
            {debt.items.map((x, i) => (
              <Txt key={x.id ?? i} style={{ fontSize: 14 }}>
                {"• " + x.name}
              </Txt>
            ))}
          </View>
        ) : null}
      </Card>

      <DispTabs height={40} />

      <Card pad={14}>
        <ConvRows title="SALDO PENDIENTE EN LAS 3 MONEDAS" rows={rows} />
      </Card>

      {debt.sched ? (
        <View style={{ gap: 10 }}>
          <Txt style={{ fontSize: 15, fontWeight: "700" }}>
            Cuotas · una cada {debt.instDays} días
          </Txt>
          <Card pad={0} style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            {debt.sched.map((c, i) => {
              const tone = c.done
                ? "ok"
                : c.dueIn < 0
                  ? "danger"
                  : c.dueIn <= 7
                    ? "warn"
                    : "neutral";
              const label = c.done
                ? "Pagada"
                : c.partial
                  ? "Parcial · falta " +
                    fx.money(debt.ccy, Math.max(0, c.amt - c.paid))
                  : c.dueIn < 0
                    ? "Vencida"
                    : c.dueIn === 0
                      ? "Vence hoy"
                      : "Pendiente";
              return (
                <View
                  key={c.n}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    borderBottomWidth: i === debt.sched.length - 1 ? 0 : 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Txt style={{ fontSize: 14, fontWeight: "700" }}>
                      Cuota {c.n} de {debt.inst}
                    </Txt>
                    <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                      {fullDate(c.due)}
                    </Txt>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Txt style={{ fontSize: 14, fontWeight: "800" }}>
                      {fx.money(debt.ccy, c.amt)}
                    </Txt>
                    <TonePill label={label} toneName={tone} />
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Txt style={{ fontSize: 15, fontWeight: "700" }}>
          Historial de abonos
        </Txt>
        <Card pad={0} style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {timeline.map((e, i) => (
            <View
              key={e.key}
              style={{
                flexDirection: "row",
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: i === timeline.length - 1 ? 0 : 1,
                borderBottomColor: colors.divider,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  marginTop: 5,
                  borderRadius: 999,
                  backgroundColor: e.dot,
                }}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt style={{ fontSize: 14, fontWeight: "700" }}>{e.title}</Txt>
                <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                  {e.sub}
                </Txt>
                {e.inst ? (
                  <Txt
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: tint.fg,
                    }}
                  >
                    {e.inst}
                  </Txt>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 3 }}>
                <Txt
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: e.neutral ? colors.text : tint.fg,
                  }}
                >
                  {e.amount}
                </Txt>
                <Txt style={{ fontSize: 11, color: colors.textSecondary }}>
                  {e.eq}
                </Txt>
                {e.rest ? (
                  <Txt
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: e.restOk ? colors.ok.fg : colors.textSecondary,
                    }}
                  >
                    {e.rest}
                  </Txt>
                ) : null}
                {e.pay ? (
                  <TouchableOpacity
                    onPress={() => removePay(e.pay)}
                    accessibilityLabel={`Eliminar ${isCobro ? "cobro" : "pago"} del ${fullDate(e.pay.date)}`}
                    hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}
                    style={{ minHeight: 28, justifyContent: "center" }}
                  >
                    <Txt
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.danger.fg,
                      }}
                    >
                      Eliminar
                    </Txt>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      </View>

      <Button
        label="Editar deuda"
        outline
        height={50}
        style={{ borderRadius: 14 }}
        onPress={() => navigation.navigate("MovementForm", { editId: debt.id })}
      />

      <TouchableOpacity
        onPress={remove}
        accessibilityLabel="Eliminar deuda"
        style={{
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt
          style={{ color: colors.danger.fg, fontSize: 13, fontWeight: "700" }}
        >
          {isCobro ? "Eliminar cuenta por cobrar" : "Eliminar cuenta por pagar"}
        </Txt>
      </TouchableOpacity>
    </Screen>
  );
}
