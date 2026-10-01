import React from "react";
import { View, TouchableOpacity } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Card,
  Tile,
  DispTabs,
  ConvRows,
  Button,
  MovRow,
  Icon,
  Empty,
} from "../../components/ui";
import { KIND_ICON, KIND_LABEL, PT, ledgerOf } from "../../utils/ledger";
import {
  CCY_KEYS,
  CCY_LABEL,
  ENT_CCY_LABEL,
  last30Range,
  monthLabel,
} from "../../utils/money";
import { go } from "../../navigation/helpers";
import { confirm } from "../../utils/confirm";

export default function EntityDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv, actions, showToast } = useData();
  const { fx } = model;
  const e = model.entById[route.params?.id];

  if (!e) {
    return (
      <Screen>
        <Header title="Entidad" onBack={() => navigation.goBack()} />
        <Empty text="No se encontró esta entidad." />
      </Screen>
    );
  }

  const k = colors.kind[e.kind] || colors.kind.otro;
  const bal = model.entBal(e);
  const pt = PT[e.pt] || PT.none;
  const data = (e.pd || [])
    .map((v, i) => ({ label: pt.f[i] || "", value: v }))
    .filter((f) => f.value && f.label);
  // Solo los últimos 30 días; el resto se ve en «Ver más movimientos» (con rango de fechas)
  const ledger = ledgerOf(model, e.id, dv, last30Range());
  const low = model.isLow(e);

  const copy = async () => {
    await Clipboard.setStringAsync(
      data.map((f) => `${f.label}: ${f.value}`).join("\n"),
    );
    showToast("Datos de pago copiados");
  };

  const remove = async () => {
    const ok = await confirm(
      "Eliminar entidad",
      `¿Eliminar "${e.name}"? Solo es posible si no tiene movimientos.`,
    );
    if (!ok) return;
    try {
      await actions.deleteEntity(e.id);
      showToast("Entidad eliminada");
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const rows = CCY_KEYS.map((c) => ({
    label: CCY_LABEL[c],
    sub: fx.rateTxt(c),
    value: fx.ready(c) ? fx.money(c, fx.fromUsd(c, bal)) : "Sin tasa",
  }));

  return (
    <Screen
      contentStyle={{ paddingTop: 16 }}
      footer={
        <Footer>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Transferir"
              height={52}
              style={{ flex: 1, borderRadius: 14 }}
              disabled={model.ents.length < 2}
              onPress={() => navigation.navigate("Transfer", { from: e.id })}
            />
            <Button
              label="Editar"
              outline
              height={52}
              style={{ flex: 1, borderRadius: 14 }}
              onPress={() => navigation.navigate("EntityForm", { id: e.id })}
            />
          </View>
        </Footer>
      }
    >
      <Header title="Entidad" onBack={() => navigation.goBack()} />

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Tile
            icon={KIND_ICON[e.kind] || "card"}
            soft={k.soft}
            fg={k.fg}
            size={44}
            radius={14}
            iconSize={22}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt numberOfLines={1} style={{ fontSize: 17, fontWeight: "800" }}>
              {e.name}
            </Txt>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              {(KIND_LABEL[e.kind] || "Otro") + " · " + ENT_CCY_LABEL[e.ccy]}
            </Txt>
          </View>
        </View>
        <View style={{ gap: 2 }}>
          <Txt
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              fontWeight: "600",
            }}
          >
            Saldo de la entidad
          </Txt>
          <Txt style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.6 }}>
            {dv(bal)}
          </Txt>
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            {e.alert != null
              ? "Alerta si baja de " + dv(e.alert)
              : "Sin alerta de saldo bajo"}
          </Txt>
        </View>
      </Card>

      {!e.include ? (
        <View
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: colors.chip,
          }}
        >
          <Txt
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: colors.textSecondary,
            }}
          >
            Esta entidad no suma a Mi saldo. Sus movimientos siguen
            registrándose aquí.
          </Txt>
        </View>
      ) : null}

      {low ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: colors.warn.border,
            borderRadius: 14,
            backgroundColor: colors.warn.bg,
          }}
        >
          <Icon name="warn" size={20} color={colors.warn.fg} stroke={2} />
          <Txt
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: "700",
              lineHeight: 18,
              color: colors.warn.fg,
            }}
          >
            Saldo por debajo de tu alerta ({e.alert != null ? dv(e.alert) : ""})
          </Txt>
        </View>
      ) : null}

      <DispTabs height={40} />

      <Card pad={14}>
        <ConvRows title="SALDO EN LAS 3 MONEDAS" rows={rows} />
      </Card>

      <Card pad={14} style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Txt
            style={{
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.5,
              color: colors.textSecondary,
            }}
          >
            DATOS DE PAGO
          </Txt>
          <Txt
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: colors.textSecondary,
            }}
          >
            {data.length ? pt.label : ""}
          </Txt>
        </View>
        {data.map((f) => (
          <View
            key={f.label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
            }}
          >
            <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
              {f.label}
            </Txt>
            <Txt
              style={{
                fontSize: 14,
                fontWeight: "700",
                textAlign: "right",
                flexShrink: 1,
              }}
            >
              {f.value}
            </Txt>
          </View>
        ))}
        {!data.length ? (
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Aún no agregaste datos de pago.
          </Txt>
        ) : null}
        <Button
          label="Copiar datos de pago"
          outline
          height={46}
          style={{ borderRadius: 12 }}
          disabled={!data.length}
          onPress={copy}
        />
      </Card>

      <View style={{ gap: 10 }}>
        <Txt style={{ fontSize: 15, fontWeight: "700" }}>
          Movimientos de {monthLabel()}
        </Txt>
        {ledger.map((r) => (
          <MovRow
            key={r.key}
            row={r}
            bordered
            onPress={() => go(navigation, r.nav.name, r.nav.params)}
          />
        ))}
        {!ledger.length ? (
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Sin movimientos en los últimos 30 días.
          </Txt>
        ) : null}
        <Button
          label="Ver más movimientos"
          outline
          height={46}
          style={{ borderRadius: 14 }}
          onPress={() => navigation.navigate("EntityMovements", { id: e.id })}
        />
      </View>

      <TouchableOpacity
        onPress={remove}
        style={{
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt
          style={{ color: colors.danger.fg, fontSize: 13, fontWeight: "700" }}
        >
          Eliminar entidad
        </Txt>
      </TouchableOpacity>
    </Screen>
  );
}
