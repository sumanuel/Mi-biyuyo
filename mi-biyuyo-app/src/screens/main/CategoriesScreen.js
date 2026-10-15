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
  Tile,
  TonePill,
  Button,
  Empty,
} from "../../components/ui";
import { META, TYPES } from "../../utils/ledger";
import { nTxt } from "../../utils/money";

/**
 * Mis categorías (Configuraciones > Perfil): crea, edita y elimina tus categorías, y elige
 * cuáles ves al registrar un movimiento. La visibilidad solo afecta a «Nuevo movimiento»:
 * en el resto de la app una categoría con movimientos se sigue mostrando.
 */
export default function CategoriesScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model, actions, showToast } = useData();
  const [type, setType] = useState(route.params?.type || "gasto");
  const [busyId, setBusyId] = useState(null);
  const t = colors[type];

  const list = model.cats.filter((c) => c.type === type && c.active);
  const own = list.filter((c) => c.own);
  const base = list.filter((c) => !c.own);
  const count = (id) => model.moves.filter((m) => m.cat.id === id).length;

  const toggle = async (c, visible) => {
    setBusyId(c.id);
    try {
      await actions.setCategoryHidden(c.id, !visible);
    } catch (err) {
      showToast(errorMessage(err));
    }
    setBusyId(null);
  };

  const row = (c) => {
    const n = count(c.id);
    const body = (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 14,
        }}
      >
        <Tile
          icon={c.icon}
          soft={t.soft}
          fg={t.fg}
          size={40}
          radius={12}
          iconSize={20}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt numberOfLines={1} style={{ fontSize: 14, fontWeight: "700" }}>
            {c.name}
          </Txt>
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            {n ? nTxt(n, "movimiento") : "Sin movimientos"}
            {c.own ? " · Tuya" : ""}
          </Txt>
        </View>
        {c.hidden ? <TonePill label="Oculta" toneName="neutral" /> : null}
        <Switch
          value={!c.hidden}
          disabled={busyId === c.id}
          onValueChange={(v) => toggle(c, v)}
          trackColor={{ true: t.strong }}
          accessibilityLabel={`Mostrar ${c.name} al registrar un movimiento`}
        />
      </View>
    );
    return c.own ? (
      <TouchableOpacity
        key={c.id}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("CategoryForm", { id: c.id })}
        accessibilityLabel={`Editar ${c.name}`}
      >
        {body}
      </TouchableOpacity>
    ) : (
      <View key={c.id}>{body}</View>
    );
  };

  const group = (title, items, hint) => (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 2 }}>
        <Txt style={{ fontSize: 14, fontWeight: "800" }}>
          {title} ({items.length})
        </Txt>
        {hint ? (
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <Card pad={0}>
        {items.map((c, i) => (
          <View
            key={c.id}
            style={{
              borderBottomWidth: i === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.divider,
            }}
          >
            {row(c)}
          </View>
        ))}
      </Card>
    </View>
  );

  return (
    <Screen
      contentStyle={{ paddingTop: 16, gap: 16 }}
      footer={
        <Footer>
          <Button
            label="Nueva categoría"
            bg={t.strong}
            height={54}
            onPress={() => navigation.navigate("CategoryForm", { type })}
          />
        </Footer>
      }
    >
      <Header title="Mis categorías" onBack={() => navigation.goBack()} />
      <Txt
        style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}
      >
        Crea tus propias categorías y elige cuáles ver al registrar un
        movimiento. Ocultar una categoría solo la quita de «Nuevo movimiento»:
        si tiene movimientos, se sigue mostrando en el resto de la app.
      </Txt>

      <View
        style={{
          flexDirection: "row",
          gap: 4,
          padding: 4,
          backgroundColor: colors.segment,
          borderRadius: 14,
        }}
      >
        {TYPES.map((k) => {
          const active = k === type;
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setType(k)}
              activeOpacity={0.8}
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors[k].strong : "transparent",
              }}
            >
              <Txt
                style={{
                  fontSize: 12.5,
                  fontWeight: "700",
                  color: active ? "#ffffff" : colors.textSecondary,
                }}
              >
                {META[k].short}
              </Txt>
            </TouchableOpacity>
          );
        })}
      </View>

      {own.length ? (
        group("Tus categorías", own, "Toca una para editarla o eliminarla.")
      ) : (
        <Empty text="Aún no creaste categorías de este tipo. Usa el botón de abajo para agregar la primera." />
      )}
      {group(
        "Predeterminadas",
        base,
        "Son de todos: solo puedes mostrarlas u ocultarlas.",
      )}
    </Screen>
  );
}
