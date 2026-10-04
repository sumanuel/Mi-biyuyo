import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Input,
  Card,
  Chip,
  ChipRow,
  Button,
  Icon,
} from "../../components/ui";
import DateField from "../../components/DateField";
import { useFocusChain } from "../../hooks/useFocusChain";
import { confirm } from "../../utils/confirm";
import {
  CCY_KEYS,
  CCY_LABEL,
  CCY_PREFIX,
  CCY_TO_API,
  addDays,
  fmtIn,
  parseNum,
  todayStr,
} from "../../utils/money";

const fmt = (n, ccy) => (n > 0 ? fmtIn(n, ccy === "bin" ? 3 : 2) : "");

/** Crear o editar un gasto planificado (lista reutilizable con ítems y montos opcionales). */
export default function PlannedFormScreen({ navigation, route }) {
  const chain = useFocusChain();
  const { colors } = useTheme();
  const { model, actions, showToast } = useData();
  const t = colors.gasto;

  const editing = model.planned.find((p) => p.id === route.params?.id) || null;
  const cats = model.cats.filter((c) => c.type === "gasto" && c.active);

  const [name, setName] = useState(editing?.name || "");
  const [catId, setCatId] = useState(editing?.catId || cats[0]?.id || null);
  const [hasDate, setHasDate] = useState(!!editing?.date);
  const [date, setDate] = useState(editing?.date || addDays(todayStr(), 3));
  const [ccy, setCcy] = useState(editing?.ccy || "bcv");
  const [amount, setAmount] = useState(
    editing ? fmt(editing.amount, editing.ccy) : "",
  );
  const [items, setItems] = useState(
    (editing?.items || []).map((i, k) => ({
      id: "e" + k,
      name: i.name,
      amt: fmt(i.amt, editing.ccy),
    })),
  );
  const [iName, setIName] = useState("");
  const [busy, setBusy] = useState(false);

  const addItem = () => {
    const n = iName.trim();
    if (!n) return;
    setItems((prev) => [
      ...prev,
      { id: `i${Date.now()}-${prev.length}`, name: n, amt: "" },
    ]);
    setIName("");
  };

  const sum = items.reduce((a, i) => a + parseNum(i.amt), 0);
  const est = parseNum(amount) > 0 ? parseNum(amount) : sum;
  const canSave = name.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        category_id: catId,
        planned_date: hasDate ? date : null,
        currency: CCY_TO_API[ccy],
        amount: parseNum(amount) > 0 ? parseNum(amount) : null,
        items: items.map((i) => ({
          name: i.name,
          amount: parseNum(i.amt) > 0 ? parseNum(i.amt) : null,
        })),
      };
      if (editing) await actions.updatePlanned(editing.id, body);
      else await actions.createPlanned(body);
      showToast(editing ? "Plan actualizado" : "Gasto planificado guardado");
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm(
      "Eliminar plan",
      "Se eliminará «" +
        editing.name +
        "». Tus gastos ya registrados no cambian.",
    );
    if (!ok) return;
    try {
      await actions.deletePlanned(editing.id);
      showToast("Plan eliminado");
      navigation.goBack();
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const field = {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
  };
  const label = (txt, hint) => (
    <View style={{ gap: 2 }}>
      <Txt style={{ fontSize: 14, fontWeight: "700" }}>{txt}</Txt>
      {hint ? (
        <Txt style={{ fontSize: 12, color: colors.textSecondary }}>{hint}</Txt>
      ) : null}
    </View>
  );

  return (
    <Screen
      contentStyle={{ paddingTop: 16, gap: 16 }}
      footer={
        <Footer>
          <Button
            label={busy ? "Guardando…" : "Guardar plan"}
            bg={t.strong}
            height={54}
            disabled={!canSave}
            onPress={save}
          />
        </Footer>
      }
    >
      <Header
        title={editing ? "Editar plan" : "Nuevo gasto planificado"}
        onBack={() => navigation.goBack()}
      />

      <View style={{ gap: 8 }}>
        {label("Nombre")}
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Ej: Compra del súper"
          accessibilityLabel="Nombre del plan"
          {...chain(0)}
          style={field}
        />
      </View>

      <View style={{ gap: 8 }}>
        {label("Categoría", "La que se usará al registrarlo como gasto.")}
        <ChipRow scroll>
          {cats.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              active={c.id === catId}
              color={t.strong}
              onPress={() => setCatId(c.id)}
            />
          ))}
        </ChipRow>
      </View>

      <View style={{ gap: 8 }}>
        {label("Moneda de los montos")}
        <ChipRow>
          {CCY_KEYS.map((k) => (
            <Chip
              key={k}
              label={CCY_LABEL[k]}
              active={k === ccy}
              color={t.strong}
              onPress={() => setCcy(k)}
            />
          ))}
        </ChipRow>
      </View>

      <View style={{ gap: 8 }}>
        {label(
          "Monto estimado",
          "Opcional. Si lo dejas vacío se usa la suma de los ítems con monto.",
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.textSecondary,
            }}
          >
            {CCY_PREFIX[ccy]}
          </Txt>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0,00"
            accessibilityLabel="Monto estimado"
            {...chain(1)}
            style={{ ...field, flex: 1, minWidth: 0, textAlign: "right" }}
          />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {label(
          "Lista de ítems",
          "Lo que piensas comprar. El monto de cada ítem es opcional.",
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Input
            value={iName}
            onChangeText={setIName}
            onSubmitEditing={addItem}
            placeholder="Ej: queso, jamón, vino"
            accessibilityLabel="Nuevo ítem"
            returnKeyType="done"
            blurOnSubmit={false}
            style={{ ...field, flex: 1, minWidth: 0 }}
          />
          <TouchableOpacity
            onPress={addItem}
            accessibilityLabel="Agregar ítem"
            style={{
              minHeight: 48,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: t.strong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt style={{ color: "#fff", fontWeight: "700" }}>Agregar</Txt>
          </TouchableOpacity>
        </View>
        {items.length ? (
          <Card pad={0} style={{ paddingHorizontal: 12 }}>
            {items.map((it, i) => (
              <View
                key={it.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 8,
                  borderBottomWidth: i === items.length - 1 ? 0 : 1,
                  borderBottomColor: colors.divider,
                }}
              >
                <Txt
                  numberOfLines={1}
                  style={{ flex: 1, fontSize: 14, fontWeight: "600" }}
                >
                  {it.name}
                </Txt>
                <Input
                  value={it.amt}
                  onChangeText={(v) =>
                    setItems((prev) =>
                      prev.map((x) => (x.id === it.id ? { ...x, amt: v } : x)),
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  accessibilityLabel={`Monto de ${it.name}`}
                  style={{
                    ...field,
                    width: 100,
                    minHeight: 40,
                    textAlign: "right",
                  }}
                />
                <TouchableOpacity
                  onPress={() =>
                    setItems((prev) => prev.filter((x) => x.id !== it.id))
                  }
                  accessibilityLabel={`Quitar ${it.name}`}
                  style={{
                    width: 36,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name="close"
                    size={16}
                    color={colors.textSecondary}
                    stroke={2}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        ) : null}
        {est > 0 ? (
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            Total estimado: {model.fx.money(ccy, est)}
          </Txt>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        {label("Fecha prevista", "Opcional: cuándo piensas hacerlo.")}
        <ChipRow>
          <Chip
            label="Sin fecha"
            active={!hasDate}
            color={t.strong}
            onPress={() => setHasDate(false)}
          />
          <Chip
            label="Elegir fecha"
            active={hasDate}
            color={t.strong}
            onPress={() => setHasDate(true)}
          />
        </ChipRow>
        {hasDate ? (
          <DateField
            value={date}
            onChange={setDate}
            min={todayStr()}
            max={addDays(todayStr(), 3650)}
            tint={t}
          />
        ) : null}
      </View>

      {editing ? (
        <Button
          label="Eliminar plan"
          outline
          height={48}
          style={{ borderRadius: 14 }}
          onPress={remove}
        />
      ) : null}
    </Screen>
  );
}
