import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Image } from "react-native";

// Pantalla de carga (prototipo "Pantalla de carga"): mensajes que rotan mientras se abre la sesión.
const PHASES = [
  ["Ingresando", "Estamos verificando tu acceso y preparando tu sesión."],
  ["Preparando tus finanzas", "Se están preparando tus cuentas y movimientos."],
  ["Iniciando Mi Biyuyo", "Estamos organizando todo para comenzar."],
  [
    "Preparando datos",
    "Se están creando y verificando las tablas principales.",
  ],
  [
    "Actualizando información",
    "Se están revisando datos anteriores para mantener tu información al día.",
  ],
  [
    "Cargando configuración",
    "Se están aplicando los ajustes base de tu cuenta.",
  ],
  [
    "Revisando tu perfil",
    "Se están comprobando tus datos, la tasa de cambio y los pasos iniciales.",
  ],
  [
    "Activando servicios",
    "Se están preparando tareas automáticas y utilidades de apoyo.",
  ],
  [
    "Casi listo",
    "Estamos afinando los últimos detalles para mostrar tus finanzas.",
  ],
];

export default function SplashScreen() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1500);
    return () => clearInterval(t);
  }, []);
  const idx = tick % PHASES.length;
  const [title, message] = PHASES[idx];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#1f7a59",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 336,
          alignItems: "center",
          backgroundColor: "rgba(9,55,39,0.24)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.14)",
          borderRadius: 24,
          paddingVertical: 30,
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: 110,
            height: 110,
            borderRadius: 32,
            backgroundColor: "rgba(8,48,35,0.34)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <Image
            source={require("../../../assets/splash-icon.png")}
            style={{ width: 96, height: 96 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
        <Text
          style={{
            color: "#ffffff",
            fontSize: 20,
            fontWeight: "800",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.82)",
            fontSize: 14,
            lineHeight: 20,
            fontWeight: "600",
            textAlign: "center",
            minHeight: 48,
          }}
        >
          {message}
        </Text>
        <Text
          style={{
            color: "rgba(255,255,255,0.62)",
            fontSize: 12,
            textAlign: "center",
            marginTop: 8,
          }}
        >
          Tu espacio se abrirá en unos instantes.
        </Text>
        <ActivityIndicator color="#ffffff" style={{ marginTop: 16 }} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
          {PHASES.map((_p, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  i <= idx ? "#ffffff" : "rgba(255,255,255,0.22)",
                transform: [{ scale: i === idx ? 1.12 : 1 }],
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
