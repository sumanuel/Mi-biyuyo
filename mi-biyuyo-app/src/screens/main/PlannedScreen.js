import React from "react";
import { TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
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
import { fullDate, nTxt } from "../../utils/money";

/** Texto de la fecha prevista y su tono (ok | warn | danger | neutral). */
function whenOf(p) {
  if (p.dueIn === null) return { t: "Sin fecha", tone: "neutral" };
  if (p.dueIn < 0)
    return { t: "Era para hace " + nTxt(-p.dueIn, "día"), tone: "danger" };
  if (p.dueIn === 0) return { t: "Hoy", tone: "warn" };
  if (p.dueIn === 1) return { t: "Mañana", tone: "warn" };
  return {
    t: "En " + nTxt(p.dueIn, "día"),
    tone: p.dueIn <= 7 ? "warn" : "ok",
  };
}

/**
 * Gastos planificados: listas reutilizables (por ejemplo, la compra del súper) que se
 * preparan con anticipación y se registran como gasto con un toque. No afectan tu saldo
 * hasta que las registras, y se conservan para volver a usarlas.
 */
export default function PlannedScreen({ navigation }) {
  const { colors } = useTheme();
  const { model } = useData();
  const { fx } = model;
  const t = colors.gasto;

  const register = (p) => {
    const cat =
      model.catById[p.catId] ||
      model.cats.find((c) => c.type === "gasto" && c.active);
    if (!cat) return;
    navigation.navigate("MovementForm", { catId: cat.id, plan: p });
  };

  return (
    <Screen
      contentStyle={{ paddingTop: 16 }}
      footer={
        <Footer>
          <Button
            label="Nuevo gasto planificado"
            bg={t.strong}
            height={54}
            onPress={() => navigation.navigate("PlannedForm")}
          />
        </Footer>
      }
    >
      <Header title="Gastos planificados" onBack={() => navigation.goBack()} />
      <Txt
        style={{ fontSize: 13, lineHeight: 19, color: colors.textSecondary }}
      >
        Prepara tu lista con anticipación (por ejemplo, la compra del súper) y
        regístrala como gasto cuando llegue el momento. No afecta tu saldo hasta
        que la registras, y se conserva para volver a usarla.
      </Txt>

      {model.planned.length === 0 ? (
        <Empty text="Aún no tienes gastos planificados. Crea el primero con el botón de abajo." />
      ) : null}

      {model.planned.map((p) => {
        const w = whenOf(p);
        const cat = model.catById[p.catId];
        return (
          <Card key={p.id} style={{ gap: 12 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate("PlannedForm", { id: p.id })}
              accessibilityLabel={`Editar ${p.name}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Tile
                icon={cat?.icon || "list"}
                soft={t.soft}
                fg={t.fg}
                size={44}
                radius={14}
                iconSize={22}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt
                  numberOfLines={1}
                  style={{ fontSize: 16, fontWeight: "700" }}
                >
                  {p.name}
                </Txt>
                <Txt
                  numberOfLines={1}
                  style={{ fontSize: 12, color: colors.textSecondary }}
                >
                  {[
                    cat?.name,
                    p.items.length ? nTxt(p.items.length, "ítem") : null,
                    p.est > 0 ? "≈ " + fx.money(p.ccy, p.est) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sin detalle"}
                </Txt>
                {p.date ? (
                  <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                    {fullDate(p.date)}
                  </Txt>
                ) : null}
              </View>
              <TonePill label={w.t} toneName={w.tone} />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                label="Registrar"
                bg={t.strong}
                height={44}
                style={{ flex: 1, borderRadius: 12 }}
                onPress={() => register(p)}
              />
              <Button
                label="Editar"
                outline
                height={44}
                style={{ flex: 1, borderRadius: 12 }}
                onPress={() => navigation.navigate("PlannedForm", { id: p.id })}
              />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
