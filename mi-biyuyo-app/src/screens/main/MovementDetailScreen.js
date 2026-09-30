import React, { useState } from "react";
import { View, Modal, Image, TouchableOpacity, Platform } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Header,
  Txt,
  Card,
  Tile,
  DispTabs,
  ConvRows,
  Button,
  Icon,
  Empty,
} from "../../components/ui";
import { META, dayRateTxt, isDebtType } from "../../utils/ledger";
import { CCY_KEYS, CCY_LABEL, dlabel } from "../../utils/money";
import { confirm } from "../../utils/confirm";

export default function MovementDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv, disp, actions, showToast } = useData();
  const { fx } = model;
  const m = model.moveById[route.params?.id];
  const [receipt, setReceipt] = useState(null);

  if (!m) {
    return (
      <Screen>
        <Header
          title="Detalle del movimiento"
          onBack={() => navigation.goBack()}
        />
        <Empty text="No se encontró este movimiento." />
      </Screen>
    );
  }

  const meta = META[m.type];
  const tint = colors[m.type];
  const debt = isDebtType(m.type);
  const sign =
    m.type === "ingreso"
      ? "+"
      : m.type === "gasto"
        ? "-"
        : m.cash === false
          ? ""
          : m.type === "pagar"
            ? "+"
            : "-";
  // Valores del día en que se registró (no se recalculan con la tasa de hoy)
  const total = m.val[disp];
  const part = (usd) => (m.usd > 0 ? (usd / m.usd) * total : 0);
  const money = (n) => fx.money(disp, n);
  const assigned = m.items.reduce((a, it) => a + part(it.usd || 0), 0);
  const rest = Math.max(0, total - assigned);
  const itemsNote = !m.items.length
    ? "Este movimiento no tiene detalle."
    : assigned > 0
      ? `Detallado ${money(assigned)} de ${money(total)}` +
        (rest > 0.005 ? `. Sin detallar ${money(rest)}.` : ".")
      : `Sin montos por ítem. El total es ${money(total)}.`;

  const rows = CCY_KEYS.map((k) => ({
    label: CCY_LABEL[k],
    sub: k === m.ccy ? "Moneda del registro" : dayRateTxt(m.val, k),
    value: fx.money(k, m.val[k]),
  }));

  const viewReceipt = async () => {
    try {
      const r = await actions.getReceipt(m.id);
      if (String(r.data).startsWith("data:image")) setReceipt(r);
      else if (Platform.OS === "web") window.open(r.data, "_blank");
      else showToast("La vista previa de PDF no está disponible en el móvil");
    } catch (err) {
      showToast(errorMessage(err, "No se pudo abrir el recibo"));
    }
  };

  const remove = async () => {
    const ok = await confirm(
      "Eliminar movimiento",
      "Se eliminará junto con sus abonos y el saldo de las entidades se recalculará.",
    );
    if (!ok) return;
    try {
      await actions.deleteMovement(m.id);
      showToast("Movimiento eliminado");
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: 16, paddingBottom: 32 }}>
      <Header
        title="Detalle del movimiento"
        onBack={() => navigation.goBack()}
      />

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Tile
            icon={m.cat.icon}
            soft={tint.soft}
            fg={tint.fg}
            size={44}
            radius={14}
            iconSize={22}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: "800" }}>
              {m.title}
            </Txt>
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              {meta.label +
                " · " +
                m.cat.name +
                (m.person ? " · " + m.person : "")}
            </Txt>
          </View>
        </View>
        <Txt
          style={{
            fontSize: 30,
            fontWeight: "800",
            letterSpacing: -0.6,
            color: tint.fg,
          }}
        >
          {sign + dv(m.val)}
        </Txt>
        <View style={{ gap: 4 }}>
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            {dlabel(m.date) +
              (m.ent && !(debt && m.cash === false)
                ? " · " + model.entName(m.ent)
                : "")}
          </Txt>
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Registrado en {CCY_LABEL[m.ccy]}
          </Txt>
        </View>
      </Card>

      <DispTabs height={40} />

      <Card pad={14}>
        <ConvRows title="MONTO EN LAS 3 MONEDAS" rows={rows} />
      </Card>

      <Card pad={14} style={{ gap: 4 }}>
        <Txt
          style={{
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.5,
            color: colors.textSecondary,
          }}
        >
          DETALLE DE LA COMPRA
        </Txt>
        {m.items.map((x, i) => (
          <View
            key={x.id ?? i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
            }}
          >
            <Txt style={{ fontSize: 14, fontWeight: "600", flexShrink: 1 }}>
              {x.name}
            </Txt>
            <Txt
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: x.usd != null ? colors.text : colors.textSecondary,
              }}
            >
              {x.usd != null ? money(part(x.usd)) : "Sin monto"}
            </Txt>
          </View>
        ))}
        <Txt
          style={{
            fontSize: 13,
            lineHeight: 18,
            color: colors.textSecondary,
            paddingTop: 6,
          }}
        >
          {itemsNote}
        </Txt>
      </Card>

      <Card pad={14} style={{ gap: 10 }}>
        <Txt
          style={{
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.5,
            color: colors.textSecondary,
          }}
        >
          RECIBO
        </Txt>
        {m.hasReceipt ? (
          <TouchableOpacity
            onPress={viewReceipt}
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <View
              style={{
                width: 52,
                height: 64,
                borderRadius: 8,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name="receipt"
                size={24}
                color={colors.textSecondary}
                stroke={1.6}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: "700" }}
              >
                {m.receipt || "Recibo"}
              </Txt>
              <Txt
                style={{ fontSize: 12, color: colors.link, fontWeight: "700" }}
              >
                Ver recibo
              </Txt>
            </View>
          </TouchableOpacity>
        ) : (
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Sin recibo adjunto.
          </Txt>
        )}
      </Card>

      {debt ? (
        <Button
          label="Ver seguimiento y abonos"
          bg={tint.strong}
          height={50}
          style={{ borderRadius: 14 }}
          onPress={() => navigation.navigate("DebtDetail", { id: m.id })}
        />
      ) : null}

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
          Eliminar movimiento
        </Txt>
      </TouchableOpacity>

      <Modal
        visible={!!receipt}
        transparent
        animationType="fade"
        onRequestClose={() => setReceipt(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setReceipt(null)}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          {receipt ? (
            <Image
              source={{ uri: receipt.data }}
              resizeMode="contain"
              style={{ width: "100%", height: "80%" }}
            />
          ) : null}
          <Txt style={{ color: "#ffffff", marginTop: 12, fontWeight: "700" }}>
            Toca para cerrar
          </Txt>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}
