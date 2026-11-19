import React, { useState } from "react";
import { Image, Modal, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Header,
  Txt,
  Card,
  Button,
  Empty,
  Field,
} from "../../components/ui";
import ZoomImage from "../../components/ZoomImage";
import { go } from "../../navigation/helpers";
import { confirm } from "../../utils/confirm";
import { MAX_PENDING, usePendingReceipts } from "../../utils/pendingReceipts";

const when = (ts) => {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Recibos pendientes: fotos guardadas en este teléfono para registrar el gasto cuando haya tiempo. */
export default function PendingReceiptsScreen({ navigation }) {
  const { colors } = useTheme();
  const { showToast } = useData();
  const { list, setNote, remove } = usePendingReceipts();
  const [big, setBig] = useState(null);

  const register = (r) =>
    go(navigation, "Pick", { type: "gasto", pendingId: r.id, ts: Date.now() });

  const del = async (r) => {
    const ok = await confirm(
      "Eliminar recibo",
      "Se borra la foto de este teléfono y no se puede recuperar.",
    );
    if (!ok) return;
    await remove(r.id);
    showToast("Recibo eliminado");
  };

  return (
    <Screen contentStyle={{ paddingTop: 16, paddingBottom: 32, gap: 12 }}>
      <Header title="Recibos pendientes" onBack={() => navigation.goBack()} />
      <Txt
        style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
      >
        Fotos que tomaste con prisa. Regístralas cuando tengas tiempo o
        elimínalas. Se guardan solo en este teléfono ({list.length} de{" "}
        {MAX_PENDING}).
      </Txt>

      {list.length === 0 ? (
        <Empty text="No tienes recibos pendientes. Usa «Foto de recibo» en Inicio." />
      ) : (
        list.map((r) => (
          <Card key={r.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={() => setBig(r)} activeOpacity={0.85}>
                <Image
                  source={{ uri: r.uri }}
                  resizeMode="cover"
                  style={{
                    width: 84,
                    height: 112,
                    borderRadius: 10,
                    backgroundColor: colors.surfaceAlt,
                  }}
                />
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 8 }}>
                <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                  {when(r.at)}
                </Txt>
                <Field
                  defaultValue={r.note}
                  onEndEditing={(e) => setNote(r.id, e.nativeEvent.text)}
                  placeholder="Añadir descripción"
                  maxLength={80}
                  returnKeyType="done"
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                label="Registrar gasto"
                onPress={() => register(r)}
                height={46}
                style={{ flex: 1, borderRadius: 14 }}
              />
              <Button
                label="Eliminar"
                outline
                color={colors.danger.fg}
                onPress={() => del(r)}
                height={46}
                style={{ borderRadius: 14, paddingHorizontal: 18 }}
              />
            </View>
          </Card>
        ))
      )}

      <Modal
        visible={!!big}
        transparent
        animationType="fade"
        onRequestClose={() => setBig(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            paddingTop: 48,
            paddingBottom: 24,
            paddingHorizontal: 12,
            gap: 12,
          }}
        >
          {big ? <ZoomImage uri={big.uri} style={{ flex: 1 }} /> : null}
          <Txt
            style={{
              color: "#ffffff",
              textAlign: "center",
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            Pellizca para acercar · toca dos veces para ampliar
          </Txt>
          <Button
            label="Cerrar"
            onPress={() => setBig(null)}
            height={48}
            style={{ borderRadius: 14 }}
          />
        </View>
      </Modal>
    </Screen>
  );
}
