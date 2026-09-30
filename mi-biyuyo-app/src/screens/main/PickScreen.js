import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import { Screen, Txt, H1, Tile, Icon } from "../../components/ui";
import { META, TYPES } from "../../utils/ledger";

/** Elegir tipo de movimiento y categoría (pestaña "Registrar"). */
export default function PickScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { model } = useData();
  const [type, setType] = useState(route.params?.type || "gasto");

  // Los accesos rápidos de Inicio y Deudas llegan con un tipo distinto.
  useEffect(() => {
    if (route.params?.type) setType(route.params.type);
  }, [route.params?.type, route.params?.ts]);

  const meta = META[type];
  const t = colors[type];
  const cats = model.cats.filter((c) => c.type === type && c.active);

  return (
    <Screen scroll={false}>
      <View style={{ padding: 16, paddingTop: 20, paddingBottom: 12, gap: 14 }}>
        <H1>Nuevo movimiento</H1>
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
        <View style={{ gap: 2 }}>
          <Txt style={{ fontSize: 17, fontWeight: "800" }}>{meta.question}</Txt>
          <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
            {meta.hint}
          </Txt>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 20,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
        }}
        showsVerticalScrollIndicator={false}
      >
        {cats.map((c) => (
          <TouchableOpacity
            key={c.id}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("MovementForm", { catId: c.id })}
            style={{
              width: "31.4%",
              flexGrow: 1,
              minHeight: 104,
              paddingVertical: 12,
              paddingHorizontal: 6,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Tile
              icon={c.icon}
              soft={t.soft}
              fg={t.fg}
              size={48}
              radius={16}
              iconSize={24}
            />
            <Txt
              style={{
                fontSize: 12.5,
                fontWeight: "600",
                lineHeight: 15,
                textAlign: "center",
              }}
            >
              {c.name}
            </Txt>
          </TouchableOpacity>
        ))}
        {cats.length === 0 ? (
          <Txt style={{ color: colors.textSecondary, padding: 8 }}>
            No hay categorías para este tipo.
          </Txt>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
