import React, { useEffect } from "react";
import { TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useGuide } from "../../contexts/GuideContext";
import {
  Screen,
  Header,
  Txt,
  Card,
  Button,
  ProgressBar,
  Icon,
} from "../../components/ui";
import { go } from "../../navigation/helpers";

const STEPS = {
  rates: {
    title: "Registra las tasas del día",
    text: "Mi Biyuyo usa el dólar (USD) como base y necesita dos tasas: la del BCV (bolívares por 1 USD) y la de Binance P2P (bolívares por 1 USDT). Escríbelas a mano o toca «Obtener tasas en línea». Sin ellas no podrás registrar en bolívares ni en USDT.",
    action: "Ir a Tasas de cambio",
    go: (n) => n.navigate("ExchangeRate"),
  },
  entities: {
    title: "Crea tus entidades con su saldo",
    text: "Una entidad es donde tienes tu dinero: efectivo, un banco o una billetera digital. Elige su moneda (USD, VES o USDT) y escribe el saldo inicial: aparecerá como tu primer movimiento y sumará a Mi saldo.",
    action: "Nueva entidad",
    go: (n) => n.navigate("EntityForm"),
  },
  moves: {
    title: "Registra tus movimientos",
    text: "Toca Registrar (+) y elige: ingreso, gasto, por cobrar (te deben) o por pagar (debes). Escribe el monto, la fecha y la entidad. Verás al instante el equivalente en las tres monedas con la tasa del día.",
    action: "Registrar",
    go: (n) => go(n, "Pick", { ts: Date.now() }),
  },
  details: {
    title: "Agrega detalle a tus compras",
    text: "En un gasto abre «Detalle de la compra» y anota los ítems (pan, queso, vino…), con o sin monto. Así «Ítems más comprados» te muestra en qué gastas y en qué fechas compraste cada cosa.",
    action: "Registrar un gasto",
    go: (n) => go(n, "Pick", { type: "gasto", ts: Date.now() }),
  },
  stats: {
    title: "Mira tus estadísticas",
    text: "Elige el período (este mes, mes anterior o fechas Desde/Hasta) y descubre cuánto entra, cuánto sale, tus categorías con más gasto y cómo se reparte tu saldo entre entidades.",
    action: "Ver estadísticas",
    go: (n) => go(n, "Stats"),
  },
};

/** Guía de primeros pasos: los pasos se marcan solos cuando ya están hechos. */
export default function GettingStartedScreen({ navigation }) {
  const { colors } = useTheme();
  const guide = useGuide();

  useEffect(() => {
    guide.markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round((guide.doneCount / guide.total) * 100);

  return (
    <Screen data={false} contentStyle={{ gap: 14, paddingTop: 16 }}>
      <Header title="Primeros pasos" onBack={() => navigation.goBack()} />

      <Card style={{ gap: 10 }}>
        <Txt style={{ fontSize: 15, fontWeight: "800" }}>
          {guide.doneCount === guide.total
            ? "¡Todo listo!"
            : `${guide.doneCount} de ${guide.total} pasos listos`}
        </Txt>
        <ProgressBar pct={pct} color={colors.accent} />
        <Txt
          style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
        >
          Sigue estos pasos en orden para empezar. Se marcan solos cuando los
          completas.
        </Txt>
      </Card>

      {guide.steps.map((s, i) => {
        const c = STEPS[s.key];
        return (
          <Card
            key={s.key}
            style={{
              gap: 10,
              opacity: s.done ? 0.75 : 1,
              borderColor: s.done ? colors.border : colors.accent,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: s.done ? colors.accent : colors.chip,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.done ? (
                  <Icon name="check" size={16} color="#ffffff" stroke={3} />
                ) : (
                  <Txt style={{ fontSize: 14, fontWeight: "800" }}>{i + 1}</Txt>
                )}
              </View>
              <Txt style={{ flex: 1, fontSize: 15, fontWeight: "800" }}>
                {c.title}
              </Txt>
              {s.done ? (
                <Txt
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.accent,
                  }}
                >
                  Listo
                </Txt>
              ) : null}
            </View>
            <Txt
              style={{
                fontSize: 13,
                lineHeight: 19,
                color: colors.textSecondary,
              }}
            >
              {c.text}
            </Txt>
            <Button
              label={c.action}
              outline={s.done}
              height={44}
              style={{ borderRadius: 12 }}
              onPress={() => c.go(navigation)}
            />
          </Card>
        );
      })}

      <TouchableOpacity
        onPress={() => navigation.navigate("HelpCenter")}
        style={{
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt style={{ color: colors.link, fontSize: 14, fontWeight: "700" }}>
          Ver ayuda completa
        </Txt>
      </TouchableOpacity>
    </Screen>
  );
}
