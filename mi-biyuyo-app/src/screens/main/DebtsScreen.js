import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Txt,
  H1,
  Card,
  Segmented,
  Input,
  Button,
  DispTabs,
  ProgressBar,
  Tile,
  TonePill,
  Empty,
} from "../../components/ui";
import DateRangeFilter from "../../components/DateRangeFilter";
import { META, debtStatus } from "../../utils/ledger";
import { endOfMonth, fullDate, nTxt, startOfMonth } from "../../utils/money";
import { go } from "../../navigation/helpers";

const PAGE = 25;

/** Lista de por cobrar o por pagar (según `type`), separada en pendientes y canceladas. */
export default function DebtsScreen({ navigation, type: tab }) {
  const { colors } = useTheme();
  const { model, dv } = useData();
  const [view, setView] = useState("pend");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(endOfMonth());
  const [limit, setLimit] = useState(PAGE);

  const tint = colors[tab];
  const done = view === "done";
  const isDone = (m) => model.pendOf(m) <= 0.005;
  // Fecha de cancelación: la del último abono (o la de la deuda si no tuvo abonos)
  const doneDate = (m) =>
    (m.pays || []).reduce((a, p) => (p.date > a ? p.date : a), m.date);
  const ofType = model.moves.filter((m) => m.type === tab);
  const pendAll = ofType.filter((m) => !isDone(m));
  const qn = q.trim().toLowerCase();
  const doneRows = ofType
    .filter(isDone)
    .filter((m) => doneDate(m) >= from && doneDate(m) <= to)
    .filter(
      (m) =>
        !qn ||
        [m.person || "", m.title, m.cat.name]
          .join(" ")
          .toLowerCase()
          .includes(qn),
    )
    .sort((a, b) => (doneDate(a) < doneDate(b) ? 1 : -1));
  const all = done ? doneRows : pendAll;
  const total = all.reduce((a, m) => a + model.totalOf(m), 0);
  const paid = all.reduce((a, m) => a + model.paidOf(m), 0);
  const rows = done
    ? doneRows
    : pendAll
        .slice()
        .sort(
          (a, b) =>
            (a.dueIn === null ? 999 : a.dueIn) -
            (b.dueIn === null ? 999 : b.dueIn),
        );
  const shown = done ? rows.slice(0, limit) : rows;

  return (
    <Screen pull>
      <H1>{tab === "cobrar" ? "Por cobrar" : "Por pagar"}</H1>
      <Segmented
        height={40}
        items={[
          ["pend", "Pendientes"],
          ["done", "Canceladas"],
        ].map(([k, l]) => ({
          label: l,
          active: view === k,
          onPress: () => {
            setView(k);
            setLimit(PAGE);
          },
        }))}
      />
      <DispTabs height={40} />
      {done ? (
        <>
          <Input
            value={q}
            onChangeText={(v) => {
              setQ(v);
              setLimit(PAGE);
            }}
            placeholder="Buscar por persona, título o categoría"
            accessibilityLabel="Buscar deudas canceladas"
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              fontSize: 15,
            }}
          />
          <DateRangeFilter
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              setLimit(PAGE);
            }}
          />
        </>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Txt
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            fontWeight: "600",
          }}
        >
          {done
            ? tab === "cobrar"
              ? "Total cobrado en el período"
              : "Total pagado en el período"
            : tab === "cobrar"
              ? "Pendiente por cobrar"
              : "Pendiente por pagar"}
        </Txt>
        <Txt style={{ fontSize: 28, fontWeight: "800", letterSpacing: -0.56 }}>
          {done ? dv(total) : dv(total - paid)}
        </Txt>
        {done ? (
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            {nTxt(rows.length, "cancelada")} del {fullDate(from)} al{" "}
            {fullDate(to)}
          </Txt>
        ) : (
          <>
            <ProgressBar
              pct={total > 0 ? Math.round((paid / total) * 100) : 0}
              color={tint.strong}
            />
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              {(tab === "cobrar" ? "Cobrado " : "Pagado ") +
                dv(paid) +
                " de " +
                dv(total)}
            </Txt>
          </>
        )}
      </Card>

      <View style={{ gap: 8 }}>
        {rows.length === 0 ? (
          <Empty
            text={
              done
                ? "No hay deudas canceladas en este rango de fechas."
                : tab === "cobrar"
                  ? "No tienes cobros pendientes."
                  : "No tienes deudas pendientes."
            }
          />
        ) : null}
        {shown.map((m) => {
          const st = debtStatus(model, m);
          return (
            <TouchableOpacity
              key={m.id}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("DebtDetail", { id: m.id })}
              accessibilityLabel={`${m.person || m.title}, ${done ? "cancelada" : "pendiente " + dv(model.pendOf(m))}`}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                gap: 10,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Tile icon={m.cat.icon} soft={tint.soft} fg={tint.fg} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt
                    numberOfLines={1}
                    style={{ fontSize: 14, fontWeight: "700" }}
                  >
                    {m.person || m.title}
                  </Txt>
                  <Txt
                    numberOfLines={1}
                    style={{ fontSize: 12, color: colors.textSecondary }}
                  >
                    {m.cat.name} · {m.title}
                  </Txt>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Txt style={{ fontSize: 15, fontWeight: "800" }}>
                    {done ? dv(model.totalOf(m)) : dv(model.pendOf(m))}
                  </Txt>
                  <Txt style={{ fontSize: 11, color: colors.textSecondary }}>
                    {done
                      ? "el " + fullDate(doneDate(m))
                      : "de " + dv(model.totalOf(m))}
                  </Txt>
                </View>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={{ flex: 1 }}>
                  <ProgressBar
                    height={6}
                    pct={
                      model.totalNative(m) > 0
                        ? Math.round(
                            ((model.totalNative(m) - model.pendNative(m)) /
                              model.totalNative(m)) *
                              100,
                          )
                        : 0
                    }
                    color={tint.strong}
                  />
                </View>
                <TonePill label={st.t} toneName={st.tone} />
              </View>
            </TouchableOpacity>
          );
        })}
        {done && rows.length > limit ? (
          <Button
            label="Mostrar más"
            outline
            height={46}
            style={{ borderRadius: 14 }}
            onPress={() => setLimit((l) => l + PAGE)}
          />
        ) : null}
      </View>

      <TouchableOpacity
        onPress={() => go(navigation, "Pick", { type: tab, ts: Date.now() })}
        style={{
          minHeight: 50,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colors.disabled,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          {tab === "cobrar"
            ? "Registrar nuevo por cobrar"
            : "Registrar nuevo por pagar"}
        </Txt>
      </TouchableOpacity>
    </Screen>
  );
}
