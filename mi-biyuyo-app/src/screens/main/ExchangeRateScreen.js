import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useExchangeRate } from "../../contexts/ExchangeRateContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Card,
  Field,
  Button,
} from "../../components/ui";
import { grp, parseNum } from "../../utils/money";

const asInput = (v) =>
  Number(v) > 0 ? String(Number(v)).replace(".", ",") : "";

/** Tasas de cambio: manual o desde fuentes en línea. */
export default function ExchangeRateScreen({ navigation }) {
  const { colors } = useTheme();
  const { rates, loading, fetchExternal, updateManual } = useExchangeRate();
  const { showToast } = useData();
  const [bcv, setBcv] = useState(asInput(rates.usd_to_ves));
  const [bin, setBin] = useState(asInput(rates.binance_to_ves));
  const [saving, setSaving] = useState(false);

  const gap =
    parseNum(bcv) > 0 && parseNum(bin) > 0
      ? (parseNum(bin) / parseNum(bcv) - 1) * 100
      : null;

  const fetchOnline = async () => {
    try {
      const data = await fetchExternal();
      setBcv(asInput(data.usd_to_ves));
      setBin(asInput(data.binance_to_ves));
      showToast("Tasas actualizadas desde fuentes en línea");
    } catch (err) {
      showToast(errorMessage(err, "No se pudo obtener las tasas"));
    }
  };

  const save = async () => {
    if (!(parseNum(bcv) > 0) && !(parseNum(bin) > 0))
      return showToast("Ingresa al menos una tasa");
    setSaving(true);
    try {
      await updateManual(
        parseNum(bcv) || undefined,
        parseNum(bin) || undefined,
      );
      showToast("Tasas guardadas");
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err, "No se pudo guardar las tasas"));
      setSaving(false);
    }
  };

  return (
    <Screen
      data={false}
      contentStyle={{ paddingTop: 16, gap: 16 }}
      footer={
        <Footer>
          <Button
            label="Guardar tasas"
            onPress={save}
            height={54}
            loading={saving}
          />
        </Footer>
      }
    >
      <Header title="Tasas de cambio" onBack={() => navigation.goBack()} />

      <Card style={{ gap: 14 }}>
        <Txt
          style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
        >
          Todos tus montos se guardan en USD. Con estas tasas se convierte entre
          USD, VES (BCV) y USDT (Binance). Ej.: si 1 USD = 850 VES y 1 USDT =
          950 VES, entonces 850 VES = USD 1.00 = USDT 0.89.
        </Txt>
        <Field
          label="Tasa BCV"
          hint="(VES por 1 USD)"
          value={bcv}
          onChangeText={setBcv}
          keyboardType="decimal-pad"
          placeholder="0,00"
        />
        <Field
          label="Tasa Binance P2P"
          hint="(VES por 1 USDT)"
          value={bin}
          onChangeText={setBin}
          keyboardType="decimal-pad"
          placeholder="0,00"
        />
        {gap !== null ? (
          <View
            style={{
              padding: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Txt style={{ fontSize: 13, fontWeight: "600" }}>
              Brecha Binance:{" "}
              {(gap >= 0 ? "+" : "-") + grp(Math.abs(gap), ".", ",")}% sobre la
              tasa BCV
            </Txt>
          </View>
        ) : null}
      </Card>

      <Button
        label="Obtener tasas en línea"
        outline
        height={50}
        style={{ borderRadius: 14 }}
        onPress={fetchOnline}
        loading={loading}
      />
    </Screen>
  );
}
