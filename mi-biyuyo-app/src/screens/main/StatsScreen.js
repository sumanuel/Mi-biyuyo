import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Txt,
  H1,
  Card,
  Tile,
  Segmented,
  DispTabs,
  ProgressBar,
  Icon,
} from "../../components/ui";
import { compact, dayMonth, grp, nTxt } from "../../utils/money";
import { go } from "../../navigation/helpers";

const WD = ["D", "L", "M", "M", "J", "V", "S"];
const CHART_H = 120;

export default function StatsScreen({ navigation }) {
  const { colors } = useTheme();
  const { model, disp, dv } = useData();
  const { fx } = model;
  const [days, setDays] = useState(30);
  const [sel, setSel] = useState(null);

  const list = model.moves.filter((m) => m.d < days);
  const inc = model.sum(list, "ingreso");
  const exp = model.sum(list, "gasto");
  const net = inc - exp;
  const saving = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
  const gap = fx.rate > 0 ? (fx.rateB / fx.rate - 1) * 100 : 0;

  /* ---- barras por tramo ---- */
  const nb = days === 7 ? 7 : 6;
  const size = days / nb;
  const acc = Array.from({ length: nb }, () => ({ i: 0, e: 0 }));
  list.forEach((m) => {
    if (m.type !== "ingreso" && m.type !== "gasto") return;
    const idx = nb - 1 - Math.floor(m.d / size);
    if (idx < 0 || idx >= nb) return;
    if (m.type === "ingreso") acc[idx].i += m.usd;
    else acc[idx].e += m.usd;
  });
  const rawMax = Math.max(
    1,
    ...acc.map((b) => Math.max(fx.fromUsd(disp, b.i), fx.fromUsd(disp, b.e))),
  );
  const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const niceMax = [1, 2, 5, 10].map((k) => k * pow).find((v) => v >= rawMax);
  const buckets = acc.map((b, i) => {
    const newestD = (nb - 1 - i) * size;
    const dt = new Date();
    dt.setDate(dt.getDate() - Math.round(days === 7 ? newestD : newestD + size - 1));
    const vi = fx.fromUsd(disp, b.i);
    const ve = fx.fromUsd(disp, b.e);
    const px = (v) => (v > 0 ? Math.max(3, Math.round((v / niceMax) * CHART_H)) : 0);
    return {
      label: days === 7 ? WD[dt.getDay()] : dayMonth(dt),
      hi: px(vi),
      he: px(ve),
      vi,
      ve,
    };
  });
  const readout =
    sel !== null && buckets[sel]
      ? `${buckets[sel].label} · Ingresos ${fx.money(disp, buckets[sel].vi)} · Gastos ${fx.money(disp, buckets[sel].ve)}`
      : "Toca una barra para ver los montos de ese tramo.";

  /* ---- rankings ---- */
  const rank = (t, top) => {
    const g = {};
    list
      .filter((m) => m.type === t)
      .forEach((m) => {
        const key = m.cat.id ?? "x";
        g[key] = g[key] || { cat: m.cat, usd: 0 };
        g[key].usd += m.usd;
      });
    const arr = Object.values(g).sort((a, b) => b.usd - a.usd);
    const total = arr.reduce((a, r) => a + r.usd, 0) || 1;
    const mx = arr.length ? arr[0].usd : 1;
    return arr.slice(0, top).map((r) => ({
      key: r.cat.id ?? "x",
      name: r.cat.name,
      icon: r.cat.icon,
      val: dv(r.usd),
      pct: Math.round((r.usd / total) * 100) + "%",
      w: Math.max(4, Math.round((r.usd / mx) * 100)),
    }));
  };
  const topExp = rank("gasto", 5);
  const topInc = rank("ingreso", 3);
  const insight = topExp.length
    ? `${topExp[0].name} es tu mayor gasto: ${topExp[0].pct} del total del período.`
    : "Aún no hay gastos en este período.";

  /* ---- ítems más comprados ---- */
  const agg = {};
  list
    .filter((m) => m.type === "gasto")
    .forEach((m) =>
      m.items.forEach((it) => {
        const k = it.name.trim().toLowerCase();
        if (!agg[k]) agg[k] = { name: it.name.trim(), n: 0, usd: 0 };
        agg[k].n += 1;
        agg[k].usd += it.usd || 0;
      }),
    );
  const aggArr = Object.values(agg).sort((a, b) => b.usd - a.usd || b.n - a.n);
  const aggMax = aggArr.length && aggArr[0].usd > 0 ? aggArr[0].usd : 1;
  const itemsTop = aggArr.slice(0, 5).map((x) => ({
    name: x.name,
    meta: nTxt(x.n, "compra"),
    val: x.usd > 0 ? dv(x.usd) : "Sin monto",
    w: x.usd > 0 ? Math.max(4, Math.round((x.usd / aggMax) * 100)) : 0,
  }));

  /* ---- distribución y deudas ---- */
  const dist = model.ents
    .map((e) => ({ id: e.id, name: e.name, b: model.entBal(e) }))
    .filter((x) => x.b > 0.005)
    .sort((a, b) => b.b - a.b)
    .map((x, _i, arr) => ({
      id: x.id,
      name: x.name,
      val: dv(x.b),
      pct: model.balance > 0 ? Math.round((x.b / model.balance) * 100) + "%" : "0%",
      w: Math.max(4, Math.round((x.b / arr[0].b) * 100)),
    }));
  const cobr = model.moves.filter((m) => m.type === "cobrar" && model.pendOf(m) > 0.005);
  const pag = model.moves.filter((m) => m.type === "pagar" && model.pendOf(m) > 0.005);
  const cobrTot = cobr.reduce((a, m) => a + model.pendOf(m), 0);
  const pagTot = pag.reduce((a, m) => a + model.pendOf(m), 0);
  const pos = cobrTot - pagTot;

  const legend = (color, label) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Txt style={{ fontSize: 12, color: colors.textSecondary }}>{label}</Txt>
    </View>
  );

  const bars = (rows, tint, barColor, withIcon = true) =>
    rows.map((r) => (
      <View key={r.key ?? r.id} style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {withIcon ? (
            <Tile icon={r.icon} soft={tint.soft} fg={tint.fg} size={32} radius={10} iconSize={18} />
          ) : null}
          <Txt numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "600" }}>
            {r.name}
          </Txt>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>{r.val}</Txt>
          <Txt
            style={{
              width: 38,
              textAlign: "right",
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            {r.pct}
          </Txt>
        </View>
        <ProgressBar height={6} pct={r.w} color={barColor} />
      </View>
    ));

  const title = (t) => <Txt style={{ fontSize: 15, fontWeight: "700" }}>{t}</Txt>;

  return (
    <Screen pull>
      <H1>Estadísticas</H1>
      <Segmented
        height={40}
        items={[
          [7, "7 días"],
          [30, "30 días"],
          [90, "90 días"],
        ].map(([v, label]) => ({
          label,
          active: days === v,
          onPress: () => {
            setDays(v);
            setSel(null);
          },
        }))}
      />
      <DispTabs height={40} />

      <Card style={{ gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Txt style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "600" }}>
            Balance del período
          </Txt>
          <Txt style={{ fontSize: 28, fontWeight: "800", letterSpacing: -0.56 }}>
            {(net < 0 ? "-" : "") + dv(Math.abs(net))}
          </Txt>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            {legend(colors.chartIncome, "Ingresos")}
            <Txt style={{ fontSize: 16, fontWeight: "700" }}>{dv(inc)}</Txt>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            {legend(colors.chartExpense, "Gastos")}
            <Txt style={{ fontSize: 16, fontWeight: "700" }}>{dv(exp)}</Txt>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card pad={14} style={{ flex: 1, gap: 4 }}>
          <Txt style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "600" }}>
            Ahorro
          </Txt>
          <Txt style={{ fontSize: 22, fontWeight: "800" }}>{saving}%</Txt>
          <Txt style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
            de tus ingresos del período
          </Txt>
        </Card>
        <Card pad={14} style={{ flex: 1, gap: 4 }}>
          <Txt style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "600" }}>
            Brecha Binance
          </Txt>
          <Txt style={{ fontSize: 22, fontWeight: "800" }}>
            {(gap >= 0 ? "+" : "-") + grp(Math.abs(gap), ".", ",") + "%"}
          </Txt>
          <Txt style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
            sobre la tasa BCV
          </Txt>
        </Card>
      </View>

      <Card style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {title("Flujo del período")}
          <View style={{ flexDirection: "row", gap: 12 }}>
            {legend(colors.chartIncome, "Ingresos")}
            {legend(colors.chartExpense, "Gastos")}
          </View>
        </View>
        <Txt style={{ minHeight: 34, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
          {readout}
        </Txt>
        <View style={{ marginLeft: 40, height: CHART_H, marginTop: 4 }}>
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.border }} />
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 59, height: 1, backgroundColor: colors.divider }} />
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 119, height: 1, backgroundColor: colors.divider }} />
          {[
            [-7, "0"],
            [52, compact(niceMax / 2)],
            [112, compact(niceMax)],
          ].map(([b, t]) => (
            <Txt
              key={b}
              style={{
                position: "absolute",
                left: -40,
                bottom: b,
                width: 34,
                textAlign: "right",
                fontSize: 10,
                color: colors.textSecondary,
              }}
            >
              {t}
            </Txt>
          ))}
          <View style={{ flexDirection: "row", gap: 4, height: CHART_H }}>
            {buckets.map((b, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                onPress={() => setSel(sel === i ? null : i)}
                accessibilityLabel={`${b.label}: ingresos ${fx.money(disp, b.vi)}, gastos ${fx.money(disp, b.ve)}`}
                style={{
                  flex: 1,
                  height: CHART_H,
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  gap: 3,
                  borderRadius: 6,
                  backgroundColor: sel === i ? colors.selected : "transparent",
                }}
              >
                <View style={{ width: 9, height: b.hi, backgroundColor: colors.chartIncome, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                <View style={{ width: 9, height: b.he, backgroundColor: colors.chartExpense, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ marginLeft: 40, flexDirection: "row", gap: 4 }}>
          {buckets.map((b, i) => (
            <Txt
              key={i}
              style={{ flex: 1, textAlign: "center", fontSize: 11, color: colors.textSecondary }}
            >
              {b.label}
            </Txt>
          ))}
        </View>
      </Card>

      <Card style={{ gap: 14 }}>
        {title("Gastos por categoría")}
        <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: -8 }}>
          {insight}
        </Txt>
        {bars(topExp, colors.gasto, colors.chartExpense)}
      </Card>

      <Card style={{ gap: 14 }}>
        {title("Ingresos por fuente")}
        {topInc.length === 0 ? (
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Aún no hay ingresos en este período.
          </Txt>
        ) : null}
        {bars(topInc, colors.cobrar, colors.chartIncome)}
      </Card>

      <Card style={{ gap: 12 }}>
        {title("Ítems más comprados")}
        <Txt style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: -6 }}>
          Suma solo los ítems con monto asignado. Toca uno para ver sus
          movimientos.
        </Txt>
        {itemsTop.map((r) => (
          <TouchableOpacity
            key={r.name}
            activeOpacity={0.8}
            onPress={() => go(navigation, "History", { q: r.name, ts: Date.now() })}
            accessibilityLabel={`Ver movimientos de ${r.name}`}
            style={{ minHeight: 44, paddingVertical: 4, gap: 6 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 1 }}>
                <Txt numberOfLines={1} style={{ fontSize: 14, fontWeight: "600" }}>
                  {r.name}
                </Txt>
                <Txt style={{ fontSize: 12, color: colors.textSecondary }}>{r.meta}</Txt>
              </View>
              <Txt style={{ fontSize: 14, fontWeight: "700" }}>{r.val}</Txt>
            </View>
            <ProgressBar height={6} pct={r.w} color={colors.chartExpense} />
          </TouchableOpacity>
        ))}
        {itemsTop.length === 0 ? (
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Aún no hay ítems detallados en este período.
          </Txt>
        ) : null}
      </Card>

      <Card style={{ gap: 14 }}>
        {title("Distribución del saldo")}
        {bars(dist, colors.neutral, colors.accent, false)}
        {dist.length === 0 ? (
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Sin saldo positivo en tus entidades.
          </Txt>
        ) : null}
      </Card>

      <Card style={{ gap: 12 }}>
        {title("Por cobrar y por pagar")}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>Por cobrar</Txt>
            <Txt style={{ fontSize: 16, fontWeight: "700", color: colors.cobrar.fg }}>
              {dv(cobrTot)}
            </Txt>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              {nTxt(cobr.length, "pendiente")}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>Por pagar</Txt>
            <Txt style={{ fontSize: 16, fontWeight: "700", color: colors.pagar.fg }}>
              {dv(pagTot)}
            </Txt>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              {nTxt(pag.length, "pendiente")}
            </Txt>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
          }}
        >
          <Txt style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "600" }}>
            Posición neta
          </Txt>
          <Txt style={{ fontSize: 16, fontWeight: "800" }}>
            {(pos < 0 ? "-" : "+") + dv(Math.abs(pos))}
          </Txt>
        </View>
      </Card>
    </Screen>
  );
}
