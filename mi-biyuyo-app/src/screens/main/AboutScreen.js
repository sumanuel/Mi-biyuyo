import React from "react";
import { Image, Linking, Platform, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Screen, Header, Txt, Card, Button } from "../../components/ui";
import { useData } from "../../contexts/DataContext";
import app from "../../../app.json";

const FEATURES = [
  "Ingresos, gastos, por cobrar y por pagar en USD, bolívares (BCV) y USDT (Binance)",
  "Por cobrar y por pagar con abonos, cuotas y fecha de vencimiento",
  "Entidades (efectivo, bancos, billeteras) con transferencias entre ellas, ordenadas como prefieras",
  "Cada movimiento conserva la tasa del día en que se registró",
  "Tus propias categorías: créalas, ocúltalas o elimínalas",
  "Detalle de las compras con cantidad y monto por ítem, y qué es lo que más compras",
  "Gastos planificados: prepara tu lista y regístrala cuando llegue el momento",
  "Estadísticas por rango de fechas, con el detalle de cada categoría, y alertas de saldo bajo",
  "Bloqueo con tu huella para proteger tus datos",
];

const SUPPORT_EMAIL = "contacto.sumadev@gmail.com";

/** Acerca de: versión, descripción, fuentes de las tasas y contacto. */
export default function AboutScreen({ navigation }) {
  const { colors } = useTheme();
  const { showToast } = useData();

  // Abre el correo con el asunto y los datos de la app ya puestos (sin datos personales)
  const writeSupport = () => {
    const subject = `Soporte Mi Biyuyo ${app.expo.version}`;
    const body = `\n\n---\nVersión: ${app.expo.version}\nSistema: ${Platform.OS} ${Platform.Version}`;
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    ).catch(() =>
      showToast(`No se pudo abrir el correo. Escríbenos a ${SUPPORT_EMAIL}`),
    );
  };

  const info = (label, value) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Txt style={{ fontSize: 14, color: colors.textSecondary }}>{label}</Txt>
      <Txt style={{ fontSize: 14, fontWeight: "700" }}>{value}</Txt>
    </View>
  );

  return (
    <Screen data={false} contentStyle={{ gap: 16, paddingTop: 16 }}>
      <Header title="Acerca de" onBack={() => navigation.goBack()} />

      <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
        <Image
          source={require("../../../assets/icon.png")}
          style={{ width: 84, height: 84, borderRadius: 20 }}
          accessibilityIgnoresInvertColors
        />
        <Txt style={{ fontSize: 22, fontWeight: "800" }}>Mi Biyuyo</Txt>
        <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
          Tus finanzas personales, claras y al día
        </Txt>
      </View>

      <Card style={{ gap: 10 }}>
        {info("Versión", app.expo.version)}
        {info("Moneda base", "USD")}
        {info("Monedas", "USD · VES · USDT")}
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Qué puedes hacer</Txt>
        {FEATURES.map((f) => (
          <View key={f} style={{ flexDirection: "row", gap: 8 }}>
            <Txt style={{ color: colors.accent, fontWeight: "800" }}>•</Txt>
            <Txt
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 18,
                color: colors.textSecondary,
              }}
            >
              {f}
            </Txt>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 6 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          Fuente de las tasas
        </Txt>
        <Txt
          style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
        >
          La tasa BCV se consulta en DolarApi y la de Binance P2P en CriptoYa.
          Puedes escribirlas a mano o actualizarlas cada día desde Tasas de
          cambio. Son referenciales.
        </Txt>
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          Contacto y soporte
        </Txt>
        <Txt
          style={{ fontSize: 13, lineHeight: 18, color: colors.textSecondary }}
        >
          ¿Tienes una duda, una sugerencia o encontraste un problema? Escríbenos
          a {SUPPORT_EMAIL} y te respondemos.
        </Txt>
        <Button
          label="Escribir a soporte"
          outline
          height={46}
          style={{ borderRadius: 14 }}
          onPress={writeSupport}
        />
      </Card>

      <Txt
        style={{
          fontSize: 12,
          color: colors.textSecondary,
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} Mi Biyuyo
      </Txt>
    </Screen>
  );
}
