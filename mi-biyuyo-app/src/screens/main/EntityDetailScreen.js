import React, { useRef, useState } from "react";
import { View, TouchableOpacity, Share } from "react-native";
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
  ENT_CCY,
  ENT_CCY_LABEL,
} from "../../utils/money";
import PeriodBar from "../../components/PeriodBar";
import { usePeriod } from "../../contexts/PeriodContext";
import {
  PaymentShareCard,
  paymentText,
  shareAsImage,
} from "../../components/PaymentShareCard";
import { usePlan } from "../../hooks/usePlan";
import { go } from "../../navigation/helpers";
import { confirm } from "../../utils/confirm";

const PREVIEW = 10;

export default function EntityDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, dv, actions, showToast } = useData();
  const { period } = usePeriod();
  const { gate } = usePlan();
  const { fx } = model;
  const [payOpen, setPayOpen] = useState(false); // datos de pago: acordeón cerrado por defecto
  const [capturing, setCapturing] = useState(false); // dibuja la tarjeta con QR solo mientras se comparte
  const cardRef = useRef(null);
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
  // Movimientos del período global de la app; aquí se ven los más recientes y el resto en «Ver más movimientos»
  const ledger = ledgerOf(model, e.id, dv, { from: period.from, to: period.to });
  const low = model.isLow(e);

  // Comparte los datos de pago como imagen (QR + datos). Si no se puede compartir una imagen, comparte
  // el texto, y si tampoco se puede, lo copia.
  const share = async () => {
    const text = paymentText(e.name, data);
    try {
      setCapturing(true);
      await new Promise((r) => setTimeout(r, 150)); // deja que se dibuje la tarjeta
      if (!(await shareAsImage(cardRef))) await Share.share({ message: text });
    } catch {
      await Clipboard.setStringAsync(text);
      showToast("Datos de pago copiados");
    } finally {
      setCapturing(false);
    }
  };

  // Con movimientos no se elimina (se perdería su historial): se archiva
  const used = model.entUsed(e.id);
  const native = model.entNative(e);

  const restore = async () => {
    if (!gate("multi_entity")) return;
    try {
      await actions.restoreEntity(e.id);
      showToast(`«${e.name}» restaurada`);
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const remove = async () => {
    const ok = await confirm(
      "Eliminar entidad",
      `¿Eliminar "${e.name}"?` +
        (Math.abs(native) > 0.005
          ? ` Su saldo de ${fx.money(ENT_CCY[e.ccy], native)} dejará de sumarse a Mi saldo.`
          : ""),
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
          {e.archived ? (
            <Button
              label="Restaurar entidad"
              height={52}
              style={{ borderRadius: 14 }}
              onPress={restore}
            />
          ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Transferir"
              height={52}
              style={{ flex: 1, borderRadius: 14 }}
              disabled={model.ents.length < 2}
              onPress={() =>
                gate("transfers") &&
                navigation.navigate("Transfer", { from: e.id })
              }
            />
            <Button
              label="Editar"
              outline
              height={52}
              style={{ flex: 1, borderRadius: 14 }}
              onPress={() => navigation.navigate("EntityForm", { id: e.id })}
            />
          </View>
          )}
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
        {!e.archived ? (
          <Button
            label="Ajustar saldo"
            outline
            height={44}
            style={{ borderRadius: 12 }}
            onPress={() =>
              e.locked
                ? gate("locked_entity")
                : navigation.navigate("AdjustBalance", { entId: e.id })
            }
          />
        ) : null}
      </Card>

      {e.locked ? (
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
            Esta entidad está en solo lectura con el plan Gratis: puedes ver su
            saldo y su historial, pero no registrar movimientos en ella. Con
            Premium vuelve a funcionar normal.
          </Txt>
        </View>
      ) : null}

      {e.archived ? (
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
            Esta entidad está archivada: no suma a Mi saldo ni aparece al
            registrar. Su historial se conserva. Restáurala para volver a
            usarla.
          </Txt>
        </View>
      ) : null}

      {!e.include && !e.archived ? (
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
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setPayOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: payOpen }}
          accessibilityLabel="Datos de pago"
          style={{
            minHeight: 32,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Txt
            style={{
              flex: 1,
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
            {data.length ? pt.label : "Sin datos"}
          </Txt>
          <View style={{ transform: [{ rotate: payOpen ? "90deg" : "0deg" }] }}>
            <Icon
              name="chevronRight"
              size={16}
              color={colors.textSecondary}
              stroke={2}
            />
          </View>
        </TouchableOpacity>
        {payOpen ? (
          <>
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
        {capturing ? (
          <PaymentShareCard ref={cardRef} name={e.name} fields={data} />
        ) : null}
        <Button
          label="Compartir datos de pago"
          outline
          height={46}
          style={{ borderRadius: 12 }}
          disabled={!data.length}
          onPress={share}
        />
          </>
        ) : null}
      </Card>

      <View style={{ gap: 10 }}>
        <Txt style={{ fontSize: 15, fontWeight: "700" }}>Movimientos</Txt>
        <PeriodBar />
        {ledger.slice(0, PREVIEW).map((r) => (
          <MovRow
            key={r.key}
            row={r}
            bordered
            onPress={() => go(navigation, r.nav.name, r.nav.params)}
          />
        ))}
        {!ledger.length ? (
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            Sin movimientos en el período ({period.label.toLowerCase()}).
          </Txt>
        ) : null}
        {ledger.length > PREVIEW ? (
          <Button
            label={`Ver los ${ledger.length} movimientos`}
            outline
            height={46}
            style={{ borderRadius: 14 }}
            onPress={() => navigation.navigate("EntityMovements", { id: e.id })}
          />
        ) : null}
      </View>

      {!e.archived ? (
        <TouchableOpacity
          onPress={
            used
              ? () =>
                  gate("multi_entity") &&
                  navigation.navigate("ArchiveEntity", { id: e.id })
              : remove
          }
          style={{
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt
            style={{
              color: used ? colors.textSecondary : colors.danger.fg,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {used ? "Archivar entidad" : "Eliminar entidad"}
          </Txt>
        </TouchableOpacity>
      ) : null}
    </Screen>
  );
}
