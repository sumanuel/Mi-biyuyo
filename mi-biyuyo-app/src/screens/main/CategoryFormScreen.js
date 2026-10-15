import React, { useState } from "react";
import { Switch, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Card,
  Chip,
  ChipRow,
  Field,
  Button,
  Icon,
} from "../../components/ui";
import { useFocusChain } from "../../hooks/useFocusChain";
import { confirm } from "../../utils/confirm";
import { META, TYPES, TYPE_TO_DB } from "../../utils/ledger";
import { nTxt } from "../../utils/money";

// Iconos que se pueden elegir para una categoría (claves del catálogo de la app)
const ICONS = [
  "food",
  "car",
  "home",
  "zap",
  "cap",
  "cross",
  "bus",
  "shirt",
  "game",
  "paw",
  "phone",
  "scissors",
  "plane",
  "tv",
  "shield",
  "receipt",
  "bank",
  "card",
  "store",
  "bag",
  "laptop",
  "briefcase",
  "people",
  "user",
  "sueldo",
  "bono",
  "trend",
  "globe",
  "swap",
  "undo",
  "wallet",
  "calendar",
  "stats",
  "bell",
  "more",
];
const PER_ROW = 6;

/** Crear o editar una categoría propia: nombre, tipo (solo al crear), icono y visibilidad. */
export default function CategoryFormScreen({ navigation, route }) {
  const chain = useFocusChain();
  const { colors } = useTheme();
  const { model, actions, showToast } = useData();

  const editing = model.catById[route.params?.id]?.own
    ? model.catById[route.params.id]
    : null;
  const [type, setType] = useState(
    editing ? editing.type : route.params?.type || "gasto",
  );
  const [name, setName] = useState(editing?.name || "");
  const [icon, setIcon] = useState(editing?.icon || "more");
  const [visible, setVisible] = useState(editing ? !editing.hidden : true);
  const [busy, setBusy] = useState(false);
  // Eliminar: si la categoría tiene movimientos, se elige a cuál otra pasarlos
  const [removing, setRemoving] = useState(false);
  const [target, setTarget] = useState(null);
  const t = colors[type];

  const movements = editing
    ? model.moves.filter((m) => m.cat.id === editing.id).length
    : 0;
  const targets = editing
    ? model.cats.filter(
        (c) => c.type === type && c.active && c.id !== editing.id,
      )
    : [];
  const canSave = name.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      if (editing) {
        await actions.updateCategory(editing.id, { name: name.trim(), icon });
        if (visible !== !editing.hidden)
          await actions.setCategoryHidden(editing.id, !visible);
      } else {
        await actions.createCategory({
          name: name.trim(),
          type: TYPE_TO_DB[type],
          icon,
          hidden: !visible,
        });
      }
      showToast(editing ? "Categoría actualizada" : "Categoría creada");
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  const doDelete = async (reassignTo) => {
    setBusy(true);
    try {
      const r = await actions.deleteCategory(editing.id, reassignTo);
      showToast(
        r?.reassigned
          ? `Categoría eliminada. ${nTxt(r.reassigned, "movimiento")} pasaron a «${model.catById[reassignTo]?.name}»`
          : "Categoría eliminada",
      );
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (movements > 0) {
      setRemoving(true);
      return;
    }
    const ok = await confirm(
      "Eliminar categoría",
      `Se eliminará «${editing.name}».`,
    );
    if (ok) doDelete();
  };

  const rows = [];
  for (let i = 0; i < ICONS.length; i += PER_ROW)
    rows.push(ICONS.slice(i, i + PER_ROW));

  return (
    <Screen
      contentStyle={{ paddingTop: 16, gap: 16 }}
      footer={
        <Footer>
          <Button
            label={
              busy
                ? "Guardando…"
                : editing
                  ? "Guardar cambios"
                  : "Crear categoría"
            }
            bg={t.strong}
            height={54}
            disabled={!canSave}
            onPress={save}
          />
        </Footer>
      }
    >
      <Header
        title={editing ? "Editar categoría" : "Nueva categoría"}
        onBack={() => navigation.goBack()}
      />

      <Field
        label="Nombre"
        value={name}
        onChangeText={setName}
        maxLength={40}
        placeholder="Ej: Gimnasio"
        {...chain(0, { last: true })}
      />

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Tipo</Txt>
        {editing ? (
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            {META[type].plural} (el tipo no se puede cambiar).
          </Txt>
        ) : (
          <ChipRow>
            {TYPES.map((k) => (
              <Chip
                key={k}
                label={META[k].plural}
                active={k === type}
                color={colors[k].strong}
                onPress={() => setType(k)}
              />
            ))}
          </ChipRow>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Icono</Txt>
        <Card pad={8}>
          {rows.map((r, ri) => (
            <View key={ri} style={{ flexDirection: "row" }}>
              {r.map((k) => {
                const on = k === icon;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setIcon(k)}
                    accessibilityLabel={`Icono ${k}`}
                    accessibilityState={{ selected: on }}
                    style={{ flex: 1, height: 52, padding: 3 }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: on ? t.strong : "transparent",
                      }}
                    >
                      <Icon
                        name={k}
                        size={22}
                        color={on ? "#ffffff" : colors.text}
                        stroke={2}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
              {r.length < PER_ROW
                ? Array.from({ length: PER_ROW - r.length }).map((_, i) => (
                    <View key={"x" + i} style={{ flex: 1, height: 52 }} />
                  ))
                : null}
            </View>
          ))}
        </Card>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>
            Mostrar al registrar un movimiento
          </Txt>
          <Txt
            style={{
              fontSize: 12,
              lineHeight: 17,
              color: colors.textSecondary,
            }}
          >
            Si la ocultas, no sale en «Nuevo movimiento», pero sus movimientos
            se siguen viendo en el resto de la app.
          </Txt>
        </View>
        <Switch
          value={visible}
          onValueChange={setVisible}
          trackColor={{ true: t.strong }}
          accessibilityLabel="Mostrar al registrar un movimiento"
        />
      </View>

      {editing && !removing ? (
        <Button
          label="Eliminar categoría"
          outline
          height={48}
          style={{ borderRadius: 14 }}
          onPress={remove}
        />
      ) : null}

      {editing && removing ? (
        <Card style={{ gap: 12 }}>
          <Txt style={{ fontSize: 15, fontWeight: "800" }}>
            «{editing.name}» tiene {nTxt(movements, "movimiento")}
          </Txt>
          <Txt
            style={{
              fontSize: 13,
              lineHeight: 19,
              color: colors.textSecondary,
            }}
          >
            Elige a qué categoría de {META[type].plural.toLowerCase()} quieres
            pasarlos antes de eliminarla.
          </Txt>
          <ChipRow>
            {targets.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                active={c.id === target}
                color={t.strong}
                onPress={() => setTarget(c.id)}
              />
            ))}
          </ChipRow>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label="Cancelar"
              outline
              height={46}
              style={{ flex: 1, borderRadius: 12 }}
              onPress={() => {
                setRemoving(false);
                setTarget(null);
              }}
            />
            <Button
              label={`Pasar y eliminar`}
              bg={colors.danger.fg}
              height={46}
              disabled={!target || busy}
              style={{ flex: 1, borderRadius: 12 }}
              onPress={() => doDelete(target)}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
