import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth, useProfile } from "../../contexts/AuthContext";
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
import { useFocusChain } from "../../hooks/useFocusChain";

/** Mi perfil: nombre editable y correo (solo lectura). */
export default function ProfileScreen({ navigation }) {
  const chain = useFocusChain();
  const { colors } = useTheme();
  const { user, updateUser } = useAuth();
  const profile = useProfile();
  const { showToast } = useData();
  const [name, setName] = useState(user?.name || "");
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() && name.trim() !== user?.name;

  const save = async () => {
    setBusy(true);
    try {
      await updateUser({ name: name.trim() });
      showToast("Perfil actualizado");
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err, "No se pudo actualizar el perfil"));
      setBusy(false);
    }
  };

  return (
    <Screen
      data={false}
      contentStyle={{ paddingTop: 16 }}
      footer={
        <Footer>
          <Button
            label="Guardar cambios"
            onPress={save}
            disabled={!dirty}
            height={54}
            loading={busy}
          />
        </Footer>
      }
    >
      <Header title="Mi perfil" onBack={() => navigation.goBack()} />
      <Card style={{ alignItems: "center", gap: 6 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt style={{ color: "#ffffff", fontSize: 26, fontWeight: "800" }}>
            {(user?.name || "U")[0].toUpperCase()}
          </Txt>
        </View>
        <Txt style={{ fontSize: 17, fontWeight: "800" }}>{user?.name}</Txt>
        <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
          {user?.email}
        </Txt>
      </Card>
      <Field
        label="Nombre"
        value={name}
        onChangeText={setName}
        placeholder="Tu nombre"
        {...chain(0, { last: true })}
      />
      <Field
        label="Correo"
        value={user?.email || ""}
        editable={false}
        inputStyle={{ color: colors.textSecondary }}
      />
      <Field
        label="País y moneda"
        hint="(no se puede cambiar)"
        value={`${profile.name} · ${profile.single ? `${profile.currencyName} (${profile.currency})` : "Dólar, bolívares y USDT"}`}
        editable={false}
        inputStyle={{ color: colors.textSecondary }}
      />
    </Screen>
  );
}
