import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import QRCodeCore from "qrcode/lib/core/qrcode";
import { Txt } from "./ui";

const CARD_W = 360;
const QR_BOX = 300;
const BG = "#17402c";

/** Texto de los datos de pago: «Datos de X:» y una línea «Campo: valor» por dato. */
export const paymentText = (name, fields) =>
  `Datos de ${name}:\n\n` + fields.map((f) => `${f.label}: ${f.value}`).join("\n");

/** QR (módulos negros) dibujado como un solo trazo SVG. */
function QrSvg({ text, size }) {
  const qr = QRCodeCore.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2; // margen blanco, en módulos
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  const total = n + quiet * 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
      <Path d={d} fill="#000000" />
    </Svg>
  );
}

/**
 * Tarjeta que se convierte en imagen para compartir: QR con los datos y el detalle debajo.
 * Se dibuja fuera de la pantalla solo mientras se captura (ver `shareAsImage`).
 */
export const PaymentShareCard = React.forwardRef(function PaymentShareCard(
  { name, fields },
  ref,
) {
  const text = paymentText(name, fields);
  return (
    <View
      ref={ref}
      collapsable={false}
      pointerEvents="none"
      style={{
        position: "absolute",
        left: -2000,
        top: 0,
        width: CARD_W,
        padding: 14,
        gap: 14,
        backgroundColor: BG,
      }}
    >
      <View
        style={{
          width: CARD_W - 28,
          alignItems: "center",
          padding: 10,
          borderRadius: 16,
          backgroundColor: "#ffffff",
        }}
      >
        <QrSvg text={text} size={QR_BOX} />
      </View>
      <View style={{ gap: 2, paddingHorizontal: 4, paddingBottom: 6 }}>
        <Txt style={{ fontSize: 18, color: "#ffffff" }}>Datos de {name}:</Txt>
        <View style={{ height: 10 }} />
        {fields.map((f) => (
          <Txt key={f.label} style={{ fontSize: 18, color: "#ffffff" }}>
            {f.label}: {f.value}
          </Txt>
        ))}
      </View>
    </View>
  );
});

/**
 * Captura la tarjeta (ya montada) como PNG y abre el menú de compartir.
 * Devuelve false si el dispositivo no puede compartir archivos (p. ej. en la web).
 */
export async function shareAsImage(cardRef) {
  if (!(await Sharing.isAvailableAsync())) return false;
  const uri = await captureRef(cardRef, { format: "png", quality: 1 });
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: "Compartir datos de pago",
  });
  return true;
}
