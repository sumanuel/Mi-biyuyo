import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useData, errorMessage } from "../contexts/DataContext";
import { Button, Field, Icon, Txt } from "./ui";
import { discardFile, usePendingReceipts } from "../utils/pendingReceipts";

/**
 * Botón de Accesos clave para fotografiar un recibo con prisa y registrarlo después.
 * Un toque abre la cámara; luego se puede escribir una descripción o guardar de una vez.
 */
export default function ReceiptSnapButton({ onOpenList }) {
  const { colors } = useTheme();
  const { showToast } = useData();
  const { list, capture, save } = usePendingReceipts();
  const [photo, setPhoto] = useState(null); // { id, uri } recién tomada
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const [intro, setIntro] = useState(false); // explicación de la primera vez
  const introKey = `@mb_receipt_intro_${user?.id}`;

  // La primera vez explica de qué trata la función; después abre la cámara directo
  const press = async () => {
    let seen = true;
    try {
      seen = !!(await AsyncStorage.getItem(introKey));
    } catch {}
    if (seen) snap();
    else setIntro(true);
  };

  const startFromIntro = async () => {
    setIntro(false);
    try {
      await AsyncStorage.setItem(introKey, "1");
    } catch {}
    snap();
  };

  const snap = async () => {
    try {
      const p = await capture();
      if (p) {
        setNote("");
        setPhoto(p);
      }
    } catch (err) {
      showToast(errorMessage(err, "No se pudo abrir la cámara"));
    }
  };

  const keep = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await save(photo, note);
      setPhoto(null);
      showToast("Recibo guardado en pendientes");
    } catch (err) {
      showToast(errorMessage(err, "No se pudo guardar el recibo"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (photo) await discardFile(photo.uri);
    setPhoto(null);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={press}
        onLongPress={onOpenList}
        accessibilityLabel="Tomar foto de un recibo para registrar el movimiento después"
        style={{
          flex: 1,
          minHeight: 60,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingHorizontal: 10,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
        }}
      >
        <View>
          <Icon name="camera" size={22} color={colors.text} stroke={2} />
          {list.length ? (
            <View
              style={{
                position: "absolute",
                top: -8,
                right: -14,
                minWidth: 20,
                height: 20,
                paddingHorizontal: 5,
                borderRadius: 10,
                backgroundColor: colors.danger.fg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt
                style={{ color: "#ffffff", fontSize: 11, fontWeight: "800" }}
              >
                {list.length}
              </Txt>
            </View>
          ) : null}
        </View>
        <Txt style={{ fontSize: 13, fontWeight: "700", textAlign: "center" }}>
          Foto de recibo
        </Txt>
      </TouchableOpacity>

      <Modal
        visible={intro}
        transparent
        animationType="fade"
        onRequestClose={() => setIntro(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 18,
              gap: 12,
            }}
          >
            <Txt style={{ fontSize: 17, fontWeight: "800" }}>
              Recibos pendientes
            </Txt>
            <Txt
              style={{
                fontSize: 13,
                lineHeight: 19,
                color: colors.textSecondary,
              }}
            >
              ¿Con prisa? Toma una foto del recibo y registra el movimiento después, cuando
              tengas tiempo.
            </Txt>
            {[
              "Se abre la cámara y la foto queda guardada. Si quieres, le pones una descripción.",
              "Tus recibos pendientes aparecen en Inicio. Desde ahí los registras como gasto o los eliminas cuando quieras.",
              "Las fotos se guardan solo en este teléfono (hasta 50) y se pierden si desinstalas la app. Es gratis.",
            ].map((t) => (
              <View key={t} style={{ flexDirection: "row", gap: 8 }}>
                <Txt style={{ color: colors.accent, fontWeight: "800" }}>•</Txt>
                <Txt
                  style={{
                    flex: 1,
                    fontSize: 13,
                    lineHeight: 18,
                    color: colors.textSecondary,
                  }}
                >
                  {t}
                </Txt>
              </View>
            ))}
            <Button
              label="Entendido, tomar foto"
              onPress={startFromIntro}
              height={50}
              style={{ borderRadius: 14 }}
            />
            <TouchableOpacity
              onPress={() => setIntro(false)}
              style={{
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt style={{ fontSize: 13, fontWeight: "700" }}>Ahora no</Txt>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!photo}
        transparent
        animationType="fade"
        onRequestClose={cancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 18,
              gap: 12,
            }}
          >
            <Txt style={{ fontSize: 17, fontWeight: "800" }}>
              Recibo guardado
            </Txt>
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                resizeMode="cover"
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceAlt,
                }}
              />
            ) : null}
            <Field
              label="Descripción (opcional)"
              value={note}
              onChangeText={setNote}
              placeholder="Ej.: almuerzo con Pedro"
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={keep}
            />
            <Button
              label="Guardar para después"
              onPress={keep}
              loading={busy}
              height={50}
              style={{ borderRadius: 14 }}
            />
            <TouchableOpacity
              onPress={cancel}
              style={{
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt
                style={{
                  color: colors.danger.fg,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                Descartar foto
              </Txt>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
