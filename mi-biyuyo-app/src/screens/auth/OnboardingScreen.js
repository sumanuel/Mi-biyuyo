import React, { useRef, useState } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../contexts/ThemeContext";
import { Txt } from "../../components/ui";
import { Icon } from "../../components/icons";

export const ONBOARDING_KEY = "@mb_onboarding_done";

const SLIDES = [
  {
    key: "welcome",
    icon: "wallet",
    eyebrow: "Bienvenido a Mi Biyuyo",
    title: "Tus finanzas en un solo lugar",
    text: "Registra lo que entra, lo que sale, lo que te deben y lo que debes, con tu saldo siempre a la vista.",
    points: [
      "Ingresos y gastos en segundos",
      "Por cobrar y por pagar con abonos",
      "Un ojito para ocultar tu saldo",
    ],
  },
  {
    key: "currencies",
    icon: "globe",
    eyebrow: "Dólar, bolívares y USDT",
    title: "Tres monedas, una sola base",
    text: "El dólar (USD) es la base. Registra en bolívares (BCV) o en USDT (Binance P2P) y todo se convierte con las tasas del día.",
    points: [
      "Cada movimiento conserva la tasa del día en que lo registraste",
      "Mi saldo y tus deudas se recalculan con la tasa de hoy",
      "Aviso diario de la tasa a las 7:00 a. m.",
    ],
  },
  {
    key: "entities",
    icon: "bank",
    eyebrow: "Entidades",
    title: "Tu dinero, ordenado por entidades",
    text: "Crea efectivo, bancos o billeteras digitales, transfiere entre ellas y decide cuáles suman a Mi saldo.",
    points: [
      "El saldo inicial aparece como primer movimiento",
      "Transferencias con o sin comisión",
      "Alertas cuando un saldo baja del mínimo",
    ],
  },
  {
    key: "stats",
    icon: "stats",
    eyebrow: "Estadísticas",
    title: "Entiende a dónde va tu dinero",
    text: "Mira tus números por rango de fechas, busca en el historial y descubre qué compras más.",
    points: [
      "Este mes, mes anterior o el rango que elijas",
      "Historial con filtros y buscador",
      "Edita cualquier movimiento si te equivocas",
    ],
  },
  {
    key: "security",
    icon: "fingerprint",
    eyebrow: "Seguridad",
    title: "Protegido con tu huella",
    text: "Verifica tu correo al registrarte y entra con tu huella o Face ID cuando quieras.",
    points: [
      "Código de verificación por correo",
      "Desbloqueo con huella desde Ajustes",
      "Modo claro y oscuro",
    ],
  },
];

/** Introducción de 5 pantallas. `replay` = se abrió otra vez desde Ajustes. */
export default function OnboardingScreen({ onComplete, replay = false }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    } catch {}
    onComplete?.();
  };

  const goTo = (i) => {
    ref.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          minHeight: 48,
          paddingHorizontal: 12,
        }}
      >
        {!last ? (
          <TouchableOpacity
            onPress={finish}
            accessibilityLabel="Omitir introducción"
            style={{ minHeight: 48, justifyContent: "center", padding: 10 }}
          >
            <Txt
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: colors.textSecondary,
              }}
            >
              {replay ? "Cerrar" : "Omitir"}
            </Txt>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        style={{ flex: 1 }}
      >
        {SLIDES.map((s) => (
          <ScrollView
            key={s.key}
            style={{ width }}
            contentContainerStyle={{
              paddingHorizontal: 22,
              paddingBottom: 12,
              gap: 16,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                height: 210,
                borderRadius: 28,
                backgroundColor: "#1f7a59",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  top: -90,
                  right: -70,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: "rgba(0,0,0,0.08)",
                  bottom: -70,
                  left: -50,
                }}
              />
              <View
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 32,
                  backgroundColor: "#2b8f6a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={s.icon} size={58} color="#ffffff" stroke={1.7} />
              </View>
            </View>

            <Txt
              style={{
                fontSize: 12,
                fontWeight: "800",
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: colors.accent,
              }}
            >
              {s.eyebrow}
            </Txt>
            <Txt style={{ fontSize: 26, fontWeight: "800", lineHeight: 32 }}>
              {s.title}
            </Txt>
            <Txt
              style={{
                fontSize: 15,
                lineHeight: 22,
                color: colors.textSecondary,
              }}
            >
              {s.text}
            </Txt>
            <View style={{ gap: 10, marginTop: 4 }}>
              {s.points.map((p) => (
                <View
                  key={p}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: colors.accent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="check" size={14} color="#ffffff" stroke={3} />
                  </View>
                  <Txt style={{ flex: 1, fontSize: 14, fontWeight: "600" }}>
                    {p}
                  </Txt>
                </View>
              ))}
            </View>
          </ScrollView>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: 18, gap: 16 }}>
        <View
          style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}
        >
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={{
                width: i === index ? 26 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === index ? colors.accent : colors.disabled,
              }}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => (last ? finish() : goTo(index + 1))}
          activeOpacity={0.85}
          accessibilityLabel={last ? "Comenzar" : "Siguiente"}
          style={{
            minHeight: 54,
            borderRadius: 16,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt style={{ color: "#ffffff", fontSize: 16, fontWeight: "800" }}>
            {last ? (replay ? "Listo" : "Comenzar") : "Siguiente"}
          </Txt>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
