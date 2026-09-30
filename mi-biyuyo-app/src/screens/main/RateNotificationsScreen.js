import React, { useCallback, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../../contexts/ThemeContext";
import { useRateNotifications } from "../../contexts/RateNotificationsContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Header,
  Txt,
  Card,
  Button,
  Tile,
  TonePill,
  Icon,
  Empty,
} from "../../components/ui";
import { grp } from "../../utils/money";

const fmtDateTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
};

/** Campanita: avisos de la consulta diaria de la tasa BCV. */
export default function RateNotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const { showToast } = useData();
  const { items, apply, dismiss, remove, markAllRead, checkNow } =
    useRateNotifications();
  const [busy, setBusy] = useState(false);

  // Al abrir la campanita, los avisos se marcan como leídos (se quita el punto rojo)
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(markAllRead, 600);
      return () => clearTimeout(t);
    }, [markAllRead]),
  );

  const run = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) showToast(okMsg);
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const searchNow = async () => {
    setBusy(true);
    try {
      const item = await checkNow({ force: true });
      showToast(item ? "Tasas encontradas" : "No se pudo obtener la tasa");
    } catch (err) {
      showToast(errorMessage(err, "No se pudo consultar la tasa"));
    } finally {
      setBusy(false);
    }
  };

  const statusPill = (st) =>
    st === "applied" ? (
      <TonePill label="Aplicada" toneName="ok" />
    ) : st === "dismissed" ? (
      <TonePill label="Descartada" toneName="neutral" />
    ) : (
      <TonePill label="Pendiente" toneName="warn" />
    );

  return (
    <Screen data={false} contentStyle={{ paddingTop: 16 }}>
      <Header title="Notificaciones" onBack={() => navigation.goBack()} />

      <Txt
        style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
      >
        Cada día a las 7:00 a. m. se consultan la tasa oficial BCV y la de
        Binance (USDT). Tú decides si las actualizas.
      </Txt>
      <Button
        label="Buscar tasas ahora"
        outline
        height={46}
        style={{ borderRadius: 14 }}
        onPress={searchNow}
        loading={busy}
      />

      {items.length === 0 ? <Empty text="No tienes notificaciones." /> : null}

      {items.map((n) => (
        <Card key={n.id} style={{ gap: 10 }}>
          <View
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
          >
            <Tile soft={colors.info.bg}>
              <Txt
                style={{ fontSize: 12, fontWeight: "800", color: colors.link }}
              >
                VES
              </Txt>
            </Tile>
            <View style={{ flex: 1, gap: 3 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Txt style={{ flex: 1, fontSize: 14, fontWeight: "700" }}>
                  {n.title}
                </Txt>
                {!n.read ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.gasto.strong,
                    }}
                  />
                ) : null}
              </View>
              <Txt
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.textSecondary,
                }}
              >
                {n.message}
              </Txt>
              <Txt style={{ fontSize: 11, color: colors.muted }}>
                {fmtDateTime(n.createdAt)} · {n.source}
              </Txt>
            </View>
            <TouchableOpacity
              onPress={() => run(() => remove(n.id))}
              accessibilityLabel="Eliminar notificación"
              style={{
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name="close"
                size={16}
                color={colors.textSecondary}
                stroke={2}
              />
            </TouchableOpacity>
          </View>

          {n.status === "pending" ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                label="Actualizar tasas"
                height={44}
                style={{ flex: 1.4, borderRadius: 12 }}
                onPress={() => run(() => apply(n), "Tasas actualizadas")}
              />
              <Button
                label="Ahora no"
                outline
                height={44}
                style={{ flex: 1, borderRadius: 12 }}
                onPress={() => run(() => dismiss(n))}
              />
            </View>
          ) : (
            <View style={{ flexDirection: "row" }}>{statusPill(n.status)}</View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
