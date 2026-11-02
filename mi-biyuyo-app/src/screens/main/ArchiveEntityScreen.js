import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import { Screen, Header, Txt, Card, Button, Empty } from "../../components/ui";
import { ENT_CCY, ENT_CCY_LABEL } from "../../utils/money";
import { go } from "../../navigation/helpers";
import { confirm } from "../../utils/confirm";

/**
 * Archivar una entidad que ya tiene movimientos (no se puede eliminar sin perder su historial).
 * Archivada: no suma a Mi saldo ni sale al registrar o transferir; el historial y las estadísticas
 * se conservan y se puede restaurar. Si aún tiene saldo, se transfiere a otra entidad o se cierra
 * con un ajuste que lo deja en 0.
 */
export default function ArchiveEntityScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, actions, showToast } = useData();
  const { fx } = model;
  const e = model.entById[route.params?.id];
  const [busy, setBusy] = useState(false);

  if (!e || e.archived) {
    return (
      <Screen>
        <Header title="Archivar entidad" onBack={() => navigation.goBack()} />
        <Empty text="No se encontró esta entidad." />
      </Screen>
    );
  }

  const key = ENT_CCY[e.ccy];
  const cur = model.entNative(e);
  const zero = Math.abs(cur) < (e.ccy === "usdt" ? 0.0005 : 0.005);
  const canTransfer = model.ents.length > 1 && cur > 0.005;

  const archive = async (adjust) => {
    setBusy(true);
    try {
      await actions.archiveEntity(e.id, adjust ? { adjust_amount: -cur } : {});
      showToast(`«${e.name}» archivada`);
      go(navigation, "Entities");
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  const confirmArchive = async () => {
    const ok = await confirm(
      "Archivar entidad",
      `¿Archivar "${e.name}"? Puedes restaurarla cuando quieras desde Entidades > Entidades archivadas.`,
      "Archivar",
    );
    if (ok) archive(false);
  };

  const confirmClose = async () => {
    const ok = await confirm(
      "Cerrar y archivar",
      `Se registrará un ajuste de ${cur > 0 ? "-" : "+"}${fx.money(key, Math.abs(cur))} para dejar "${e.name}" en 0 y se archivará. No cuenta como ingreso ni gasto.`,
      "Cerrar y archivar",
    );
    if (ok) archive(true);
  };

  return (
    <Screen contentStyle={{ gap: 16, paddingTop: 16 }}>
      <Header title="Archivar entidad" onBack={() => navigation.goBack()} />

      <Card style={{ gap: 4 }}>
        <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
          {e.name} · {ENT_CCY_LABEL[e.ccy]}
        </Txt>
        <Txt style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.4 }}>
          {fx.money(key, cur)}
        </Txt>
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
          Saldo actual
        </Txt>
      </Card>

      <Txt style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>
        Una entidad con movimientos no se elimina para no perder su historial:
        se archiva. Archivada, deja de sumar a Mi saldo y no aparece al registrar
        movimientos ni al transferir, pero su historial y tus estadísticas se
        conservan. Puedes restaurarla cuando quieras.
      </Txt>

      {zero ? (
        <Button
          label="Archivar entidad"
          height={54}
          loading={busy}
          onPress={confirmArchive}
        />
      ) : (
        <View style={{ gap: 12 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>
            Esta entidad aún tiene saldo. ¿Qué hacemos con él?
          </Txt>
          {cur > 0.005 ? (
            <Button
              label="Transferirlo a otra entidad"
              height={52}
              disabled={!canTransfer || busy}
              onPress={() => navigation.navigate("Transfer", { from: e.id })}
            />
          ) : null}
          <Button
            label="Cerrar la entidad (dejar el saldo en 0)"
            outline
            height={52}
            loading={busy}
            onPress={confirmClose}
          />
          <Txt style={{ fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
            Al transferirlo, vuelve a esta pantalla para archivarla. Al cerrarla,
            se registra un ajuste que deja el saldo en 0 (no cuenta como ingreso
            ni gasto) y se archiva.
          </Txt>
        </View>
      )}
    </Screen>
  );
}
