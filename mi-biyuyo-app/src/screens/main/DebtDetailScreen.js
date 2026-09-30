import React from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
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
import { debtStatus } from "../../utils/ledger";
import { CCY_KEYS, CCY_LABEL, dlabel, grp } from "../../utils/money";

export default function DebtDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv } = useData();
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

  // Historial: del más reciente al más antiguo, con el saldo tras cada abono.
  let run = debt.usd;
  const pays = debt.pays
    .slice()
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
  const timeline = pays
    .map((p) => {
      run = Math.max(0, run - p.usd);
      const r = p.rate || fx.FACT[p.ccy];
      return {
        key: "p" + p.id,
        title: (isCobro ? "Cobro" : "Pago") + " · " + p.method,
        sub:
          dlabel(p.date) +
          " · " +
          (p.ccy === "usd" ? "Moneda base" : "Tasa " + grp(r, ".", ",")),
        amount: (isCobro ? "+" : "-") + fx.money(p.ccy, p.usd * r),
        eq: "≈ " + fx.money("usd", p.usd),
        rest: run <= 0.005 ? "Saldada" : "Saldo " + dv(run),
        restOk: run <= 0.005,
        dot: tint.strong,
      };
    })
    .reverse();
  timeline.push({
    key: "origin",
    title: "Deuda registrada",
    sub: dlabel(debt.date) + " · " + CCY_LABEL[debt.ccy],
    amount: fx.money(debt.ccy, fx.fromUsd(debt.ccy, debt.usd)),
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
            label={closed ? "Deuda saldada" : isCobro ? "Registrar cobro" : "Registrar pago"}
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
          pct={debt.usd > 0 ? Math.round((paid / debt.usd) * 100) : 0}
          color={tint.strong}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            {(isCobro ? "Cobrado " : "Pagado ") + dv(paid)}
          </Txt>
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            Total {dv(debt.usd)}
          </Txt>
        </View>
      </Card>

      <DispTabs height={40} />

      <Card pad={14}>
        <ConvRows title="SALDO PENDIENTE EN LAS 3 MONEDAS" rows={rows} />
      </Card>

      <View style={{ gap: 10 }}>
        <Txt style={{ fontSize: 15, fontWeight: "700" }}>Historial de abonos</Txt>
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
              </View>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
