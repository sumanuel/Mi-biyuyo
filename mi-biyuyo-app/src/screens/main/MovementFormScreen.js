import { usePlan } from "../../hooks/usePlan";
import { LockedBlock, PremiumPill } from "../../components/PremiumLock";
import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useData, errorMessage } from "../../contexts/DataContext";
import {
  Screen,
  Footer,
  Header,
  Txt,
  Input,
  Card,
  Tile,
  Chip,
  ChipRow,
  Label,
  Eyebrow,
  CcyOptions,
  ConvRows,
  Button,
  Field,
  Icon,
  Empty,
} from "../../components/ui";
import { META, dayRateTxt, isDebtType } from "../../utils/ledger";
import {
  CCY_KEYS,
  CCY_LABEL,
  CCY_PREFIX,
  CCY_TO_API,
  fmtIn,
  grp,
  nTxt,
  parseNum,
  todayStr,
  addDays,
  fullDate,
} from "../../utils/money";
import { qtyText } from "../../utils/text";
import { takePhoto, pickFile } from "../../utils/receipt";
import DateField from "../../components/DateField";
import { useFocusChain } from "../../hooks/useFocusChain";

const DUE_OPTS = [
  { l: "7 días", v: 7 },
  { l: "15 días", v: 15 },
  { l: "30 días", v: 30 },
  { l: "Sin fecha", v: null },
  { l: "Elegir fecha", v: "custom" },
];
// La API ya soporta deudas recurrentes; la opción está oculta en el formulario por ahora
const SHOW_RECURRING = false;
const DUE_NONE = 3;
const DUE_CUSTOM = 4;
// Pagos en cuotas: cantidad de cuotas ofrecidas y cada cuántos días vence cada una
const INST_OPTS = [0, 3, 6, 9, 12];
const INST_DAYS = 15;

export default function MovementFormScreen({ navigation, route }) {
  const chain = useFocusChain();
  const { colors } = useTheme();
  const { model, actions, showToast, convOpen, setConvOpen } = useData();
  const { can, gate } = usePlan();
  const canItems = can("items");
  const canReceipts = can("receipts");
  const { fx } = model;

  // Edición: parte de un movimiento existente y conserva las tasas del día en que se registró
  const editing = model.moveById[route.params?.editId] || null;
  // Gasto planificado que se está registrando: precarga moneda, monto, descripción e ítems
  const plan = !editing ? route.params?.plan || null : null;
  const [catId, setCatId] = useState(
    editing ? editing.cat.id : route.params?.catId,
  );
  const [catOpen, setCatOpen] = useState(false);
  const cat = model.catById[catId] || (editing ? editing.cat : null);
  const type = cat ? cat.type : "gasto";
  const meta = META[type];
  const tint = colors[type];
  const isDebt = isDebtType(type);
  const showItems = type === "gasto" || type === "pagar";

  // Factores originales (unidades de cada moneda por 1 USD) del movimiento editado
  const origOk = !!editing && editing.usd > 0;
  const origF = (k) =>
    origOk && editing.val[k] > 0 ? editing.val[k] / editing.usd : 0;
  const useOrig = (k) => !editing || origF(k) > 0;
  const toUsdE = (k, n) =>
    useOrig(k) ? (editing ? n / origF(k) : fx.toUsd(k, n)) : fx.toUsd(k, n);
  const fromUsdE = (k, usd) =>
    useOrig(k)
      ? editing
        ? usd * origF(k)
        : fx.fromUsd(k, usd)
      : fx.fromUsd(k, usd);
  const readyF = (k) => (editing ? origF(k) > 0 || fx.ready(k) : fx.ready(k));
  // Sin perder decimales (USDT guarda hasta 4): guardar sin cambios no altera el monto
  const nat = (n) =>
    n > 0 ? String(Math.round(n * 10000) / 10000).replace(".", ",") : "";
  // Costo unitario de un ítem a partir del monto de su línea; el USD se guarda con 4 decimales,
  // así que se quita el ruido (50,0015 -> 50) cuando el valor está a menos de 0,1 % de 2 decimales
  const costNat = (line, qty) => {
    const raw = line / (qty > 0 ? qty : 1);
    if (!(raw > 0)) return "";
    const r = Math.round(raw * 100) / 100;
    return nat(r > 0 && Math.abs(r - raw) <= raw * 0.001 ? r : raw);
  };
  const lockCcy =
    !!editing && isDebtType(editing.type) && editing.pays.length > 0;
  const paidNat = lockCcy ? model.paidNative(editing) : 0;

  const planItems = plan
    ? plan.items.map((it, i) => ({
        id: "p" + i,
        name: it.name,
        qty: it.qty ? qtyText(it.qty) : "1",
        cost: costNat(it.amt, it.qty),
      }))
    : [];
  const initItems = plan
    ? planItems
    : editing
      ? editing.items.map((it, i) => ({
          id: "e" + i,
          name: it.name,
          qty: it.qty ? qtyText(it.qty) : "1",
          cost:
            it.usd > 0 && origOk
              ? costNat(it.usd * (editing.amount / editing.usd), it.qty)
              : "",
        }))
      : [];
  const [ccy, setCcy] = useState(
    editing ? editing.ccy : plan ? plan.ccy : "bcv",
  );
  const [amount, setAmount] = useState(
    editing
      ? nat(editing.amount)
      : plan && plan.est > 0
        ? fmtIn(plan.est, plan.ccy === "bin" ? 3 : 2)
        : "",
  );
  const [desc, setDesc] = useState(
    editing?.hasDesc ? editing.title : plan ? plan.name : "",
  );
  const [person, setPerson] = useState(editing?.person || "");
  const [date, setDate] = useState(editing ? editing.date : todayStr());
  const [entId, setEntId] = useState(editing ? editing.ent : null);
  // -1 = conservar el vencimiento actual (solo al editar)
  const [dueIdx, setDueIdx] = useState(
    editing ? (editing.dueBase ? -1 : DUE_NONE) : 2,
  );
  const [dueCustom, setDueCustom] = useState(
    editing?.dueBase || addDays(editing ? editing.date : todayStr(), 30),
  );
  const [inst, setInst] = useState(editing?.inst || 0);
  const [rec, setRec] = useState(!!editing?.recurring);
  const [cashPagar, setCashPagar] = useState(editing ? editing.cash : false);
  const [items, setItems] = useState(initItems);
  const [itemsOpen, setItemsOpen] = useState(initItems.length > 0);
  const [iName, setIName] = useState("");
  const [receipt, setReceipt] = useState(
    editing?.receipt ? { name: editing.receipt, existing: true } : null,
  );
  const [busy, setBusy] = useState(false);

  if (!cat) {
    return (
      <Screen>
        <Header title="Nuevo movimiento" onBack={() => navigation.goBack()} />
        <Empty text="Elige primero una categoría." />
      </Screen>
    );
  }

  const amtNum = parseNum(amount);
  const usdVal = toUsdE(ccy, amtNum);
  const pickable = model.ents.filter(
    (e) => !e.locked || (editing && e.id === editing.ent),
  );
  const entSel = entId && model.entById[entId] ? entId : pickable[0]?.id;
  // Por cobrar: el dinero ya salió. Por pagar: solo suma al saldo si el usuario lo recibió.
  const cash = type !== "pagar" || cashPagar;
  const needsEnt = !isDebt || cash;
  const noEnts = pickable.length === 0;

  // Subtotal de cada ítem = cantidad x costo unitario (el costo es opcional)
  const lineOf = (it) => {
    const c = parseNum(it.cost);
    const q = parseNum(it.qty);
    return c > 0 ? Math.round(c * (q > 0 ? q : 1) * 10000) / 10000 : 0;
  };
  const itemsSum = items.reduce((a, it) => a + lineOf(it), 0);
  const itemsSumUsd = items.reduce((a, it) => a + toUsdE(ccy, lineOf(it)), 0);
  const withCost = items.filter((it) => lineOf(it) > 0).length;
  const overItems = withCost > 0 && itemsSumUsd > usdVal + 0.005;
  const itemsInvalid = showItems && overItems;
  const rateMissing = !readyF(ccy);
  const belowPaid = lockCcy && amtNum > 0 && amtNum < paidNat - 0.01;

  let itemsMsg = "";
  let itemsMsgDanger = false;
  if (items.length && !withCost)
    itemsMsg = `Pon el costo unitario para detallar el gasto. El total sigue siendo ${fx.money(ccy, amtNum)}.`;
  if (withCost) {
    const rest = fromUsdE(ccy, Math.max(0, usdVal - itemsSumUsd));
    if (overItems) {
      itemsMsg = `La suma de los ítems supera el total en ${fx.money(ccy, fromUsdE(ccy, itemsSumUsd - usdVal))}.`;
      itemsMsgDanger = true;
    } else {
      itemsMsg =
        `Detallado ${fx.money(ccy, itemsSum)} de ${fx.money(ccy, amtNum)}` +
        (rest > 0.005
          ? `. Sin detallar ${fx.money(ccy, rest)}.`
          : ". Todo detallado.");
    }
  }

  // Vencimiento (con cuotas, es la fecha de la primera cuota)
  const dueDateOf = () => {
    if (!isDebt) return null;
    if (dueIdx === -1) return editing.dueBase;
    if (dueIdx === DUE_CUSTOM) return dueCustom;
    const v = DUE_OPTS[dueIdx].v;
    return v !== null ? addDays(date, v) : null;
  };
  const firstDue = dueDateOf();
  const dueBad = isDebt && dueIdx === DUE_CUSTOM && dueCustom < date;
  const lastDue =
    inst && firstDue ? addDays(firstDue, INST_DAYS * (inst - 1)) : null;

  const canSave =
    amtNum > 0 &&
    !dueBad &&
    !itemsInvalid &&
    !rateMissing &&
    !belowPaid &&
    !(needsEnt && noEnts) &&
    !busy;

  const addNamed = (name) => {
    const n = String(name || "").trim();
    if (!n) return;
    setItems((prev) => [
      ...prev,
      { id: `i${Date.now()}-${prev.length}`, name: n, qty: "1", cost: "" },
    ]);
    setIName("");
  };
  const attach = async (fn) => {
    try {
      const r = await fn();
      if (r) setReceipt(r);
    } catch (err) {
      showToast(errorMessage(err, "No se pudo adjuntar el recibo"));
    }
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const body = {
        category_id: cat.id,
        amount: amtNum,
        currency: CCY_TO_API[ccy],
        description: desc.trim() || null,
        date,
        counterpart_name: isDebt ? person.trim() || null : null,
        entity_id: needsEnt ? entSel : null,
        cash: isDebt ? cash : true,
        due_date: dueDateOf(),
        recurring: isDebt && rec,
        installments: isDebt && inst ? inst : null,
        installment_days: isDebt && inst ? INST_DAYS : null,
      };
      if (!showItems) body.items = [];
      else if (canItems)
        body.items = items.map((it) => ({
          name: it.name,
          quantity: parseNum(it.qty) > 0 ? parseNum(it.qty) : null,
          amount: lineOf(it) > 0 ? lineOf(it) : null,
        }));
      // Recibo: sin cambios si ya existía y no se tocó
      if (!receipt?.existing) {
        body.receipt_name = receipt ? receipt.name : null;
        body.receipt_data = receipt ? receipt.data : null;
      }
      if (editing) {
        await actions.updateMovement(editing.id, body);
        showToast("Movimiento actualizado");
        navigation.goBack();
      } else {
        const created = await actions.createMovement(body);
        navigation.replace("MovementSaved", { id: created.id });
      }
    } catch (err) {
      showToast(errorMessage(err));
      setBusy(false);
    }
  };

  const entChips = (
    <ChipRow>
      {pickable.map((e) => (
        <Chip
          key={e.id}
          label={e.name}
          active={e.id === entSel}
          color={tint.strong}
          onPress={() => setEntId(e.id)}
        />
      ))}
    </ChipRow>
  );
  const entQ = {
    ingreso: "¿En qué entidad entró?",
    gasto: "¿De qué entidad salió?",
    cobrar: "¿De qué entidad salió el dinero?",
    pagar: "¿En qué entidad entró el dinero?",
  }[type];
  const entBlock = noEnts ? (
    <Card style={{ gap: 8 }}>
      <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
        Necesitas al menos una entidad (efectivo, banco…) para registrar el
        movimiento.
      </Txt>
      <Button
        label="Crear entidad"
        height={44}
        onPress={() => navigation.navigate("EntityForm")}
      />
    </Card>
  ) : (
    <View style={{ gap: 8 }}>
      <Label>{entQ}</Label>
      {entChips}
    </View>
  );

  const convRows = CCY_KEYS.map((k) => ({
    label: CCY_LABEL[k],
    sub:
      k === ccy
        ? "Moneda del registro"
        : editing
          ? dayRateTxt(editing.val, k) || fx.rateTxt(k)
          : fx.rateTxt(k),
    value: readyF(k) ? fx.money(k, fromUsdE(k, usdVal)) : "Sin tasa",
    active: k === ccy,
  }));

  return (
    <Screen
      contentStyle={{ gap: 16, paddingTop: 16 }}
      footer={
        <Footer>
          <Button
            label={editing ? "Guardar cambios" : meta.saveLabel}
            onPress={save}
            disabled={!canSave}
            bg={tint.strong}
            height={54}
            loading={busy}
          />
        </Footer>
      }
    >
      <Header
        title={editing ? "Editar movimiento" : meta.formTitle}
        onBack={() => navigation.goBack()}
      />

      <Card
        pad={0}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <Tile
          icon={cat.icon}
          soft={tint.soft}
          fg={tint.fg}
          size={44}
          radius={14}
          iconSize={22}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              fontWeight: "600",
            }}
          >
            {meta.label}
          </Txt>
          <Txt style={{ fontSize: 16, fontWeight: "700" }}>{cat.name}</Txt>
        </View>
        <TouchableOpacity
          onPress={() =>
            editing ? setCatOpen((v) => !v) : navigation.goBack()
          }
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 8,
          }}
        >
          <Txt style={{ color: colors.link, fontSize: 13, fontWeight: "700" }}>
            Cambiar
          </Txt>
        </TouchableOpacity>
      </Card>
      {editing && catOpen ? (
        <ChipRow>
          {model.cats
            .filter(
              (c) =>
                c.type === type && c.active && (!c.hidden || c.id === cat.id),
            )
            .map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                active={c.id === cat.id}
                color={tint.strong}
                onPress={() => {
                  setCatId(c.id);
                  setCatOpen(false);
                }}
              />
            ))}
        </ChipRow>
      ) : null}

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>
          Moneda del registro
        </Txt>
        <CcyOptions
          tint={tint}
          options={CCY_KEYS.map((k) => ({
            label: CCY_LABEL[k],
            sub:
              editing && origF(k) > 0
                ? dayRateTxt(editing.val, k) || fx.rateShort(k)
                : fx.rateShort(k),
            active: k === ccy,
            onPress: () => {
              if (!lockCcy) setCcy(k);
            },
          }))}
        />
        {lockCcy ? (
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            Esta deuda ya tiene abonos: no se puede cambiar su moneda.
          </Txt>
        ) : null}
        {belowPaid ? (
          <Txt style={{ fontSize: 12, color: colors.danger.fg }}>
            El monto no puede ser menor a lo ya abonado (
            {fx.money(ccy, paidNat)}).
          </Txt>
        ) : null}
        {editing ? (
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            Se conservan las tasas del {fullDate(editing.date)}, día en que se
            registró.
          </Txt>
        ) : null}
        {rateMissing ? (
          <Txt style={{ fontSize: 12, color: colors.danger.fg }}>
            Configura la tasa de esta moneda en Ajustes para poder registrar.
          </Txt>
        ) : null}
      </View>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Txt
            style={{
              fontSize: 16,
              fontWeight: "800",
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
            accessibilityLabel="Monto"
            {...chain(0)}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "right",
              fontSize: 34,
              fontWeight: "800",
              letterSpacing: -0.68,
              padding: 0,
            }}
          />
        </View>
        <View style={{ height: 1, backgroundColor: colors.divider }} />
        <ConvRows
          title="EQUIVALENCIAS"
          rows={convRows}
          tint={tint}
          collapsible
          open={convOpen}
          onToggle={setConvOpen}
        />
      </Card>

      {isDebt ? (
        <Field
          label={meta.personLabel}
          value={person}
          onChangeText={setPerson}
          placeholder="Nombre de la persona"
          {...chain(1)}
        />
      ) : null}

      <Field
        label="Descripción"
        hint="(opcional)"
        value={desc}
        onChangeText={setDesc}
        placeholder={meta.descHint}
        {...chain(2, { last: !(showItems && itemsOpen) })}
      />

      {showItems ? (
        <Card style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() => (canItems ? setItemsOpen((v) => !v) : gate("items"))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ expanded: itemsOpen }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              minHeight: 32,
            }}
          >
            <Txt style={{ flex: 1, fontSize: 14, fontWeight: "700" }}>
              Detalle de la compra
            </Txt>
            {canItems ? (
              <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                {items.length ? nTxt(items.length, "ítem") : "Opcional"}
              </Txt>
            ) : (
              <PremiumPill />
            )}
            <View
              style={{ transform: [{ rotate: itemsOpen ? "90deg" : "0deg" }] }}
            >
              <Icon
                name="chevronRight"
                size={18}
                color={colors.textSecondary}
                stroke={2}
              />
            </View>
          </TouchableOpacity>
          {itemsOpen ? (
            <>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Input
                  value={iName}
                  onChangeText={setIName}
                  {...chain(3, { last: true })}
                  onSubmitEditing={() => addNamed(iName)}
                  placeholder="Ej: queso, harina, café"
                  accessibilityLabel="Nuevo ítem"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 36,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    paddingHorizontal: 14,
                    fontSize: 14,
                  }}
                />
                <TouchableOpacity
                  onPress={() => addNamed(iName)}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: tint.strong,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt
                    style={{
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    Agregar
                  </Txt>
                </TouchableOpacity>
              </View>
              <View>
                {items.map((it, idx) => {
                  const line = lineOf(it);
                  const costBad = parseNum(it.cost) > 0 && overItems;
                  return (
                    <View
                      key={it.id}
                      style={{
                        gap: 6,
                        paddingVertical: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.divider,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Txt
                          numberOfLines={2}
                          style={{ flex: 1, fontSize: 15, fontWeight: "700" }}
                        >
                          {it.name}
                        </Txt>
                        <TouchableOpacity
                          onPress={() =>
                            setItems((prev) =>
                              prev.filter((x) => x.id !== it.id),
                            )
                          }
                          accessibilityLabel={`Quitar ${it.name}`}
                          style={{
                            width: 44,
                            height: 28,
                            alignItems: "flex-end",
                            justifyContent: "center",
                          }}
                        >
                          <Icon
                            name="close"
                            size={18}
                            color={colors.textSecondary}
                            stroke={2}
                          />
                        </TouchableOpacity>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-end",
                          gap: 8,
                        }}
                      >
                        <View style={{ width: 52, gap: 4 }}>
                          <Txt
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: colors.textSecondary,
                            }}
                          >
                            Cantidad
                          </Txt>
                          <Input
                            value={it.qty}
                            onChangeText={(v) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === it.id ? { ...x, qty: v } : x,
                                ),
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="1"
                            accessibilityLabel={`Cantidad de ${it.name}`}
                            {...chain(10 + idx * 2)}
                            style={{
                              minHeight: 32,
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 10,
                              backgroundColor: colors.surface,
                              paddingHorizontal: 8,
                              textAlign: "right",
                              fontSize: 14,
                              fontWeight: "700",
                            }}
                          />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                          <Txt
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: colors.textSecondary,
                            }}
                          >
                            Costo unit. (opcional)
                          </Txt>
                          <Input
                            value={it.cost}
                            onChangeText={(v) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === it.id ? { ...x, cost: v } : x,
                                ),
                              )
                            }
                            keyboardType="decimal-pad"
                            placeholder="0,00"
                            accessibilityLabel={`Costo unitario de ${it.name}`}
                            {...chain(11 + idx * 2, {
                              last: idx === items.length - 1,
                            })}
                            style={{
                              minHeight: 32,
                              borderWidth: 1,
                              borderColor: costBad
                                ? colors.danger.border
                                : colors.border,
                              borderRadius: 10,
                              backgroundColor: colors.surface,
                              paddingHorizontal: 8,
                              textAlign: "right",
                              fontSize: 14,
                              fontWeight: "700",
                            }}
                          />
                        </View>
                        <View
                          style={{
                            minWidth: 108,
                            alignItems: "flex-end",
                            gap: 4,
                            paddingBottom: 7,
                          }}
                        >
                          <Txt
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: colors.textSecondary,
                            }}
                          >
                            Subtotal
                          </Txt>
                          <Txt
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color:
                                line > 0
                                  ? colors.text
                                  : colors.textSecondary,
                            }}
                          >
                            {line > 0 ? fx.money(ccy, line) : "—"}
                          </Txt>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
              {items.length > 0 && itemsSum > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 4,
                  }}
                >
                  <Txt style={{ fontSize: 15, fontWeight: "700" }}>Total</Txt>
                  <Txt
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: tint.strong,
                    }}
                  >
                    {fx.money(ccy, itemsSum)}
                  </Txt>
                </View>
              ) : null}
              {itemsMsg ? (
                <Txt
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    lineHeight: 18,
                    color: itemsMsgDanger
                      ? colors.danger.fg
                      : colors.textSecondary,
                  }}
                >
                  {itemsMsg}
                </Txt>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>Recibo</Txt>
          {canReceipts ? (
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              Opcional
            </Txt>
          ) : (
            <PremiumPill />
          )}
        </View>
        {receipt ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Tile
              icon="receipt"
              soft={colors.ok.bg}
              fg={colors.ok.fg}
              radius={10}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: "700" }}
              >
                {receipt.name}
              </Txt>
              <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                Adjunto listo
              </Txt>
            </View>
            <TouchableOpacity
              onPress={() => setReceipt(null)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <Txt
                style={{
                  color: colors.danger.fg,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                Quitar
              </Txt>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              ["Tomar foto", "camera", takePhoto],
              ["Elegir archivo", "clip", pickFile],
            ].map(([label, icon, fn]) => (
              <TouchableOpacity
                key={label}
                onPress={() => (canReceipts ? attach(fn) : gate("receipts"))}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Icon name={icon} size={18} color={colors.text} stroke={2} />
                <Txt style={{ fontSize: 14, fontWeight: "700" }}>{label}</Txt>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Card>

      <View style={{ gap: 8 }}>
        <Txt style={{ fontSize: 14, fontWeight: "700" }}>Fecha</Txt>
        <DateField value={date} onChange={setDate} tint={tint} />
      </View>

      {!isDebt ? entBlock : null}

      {type === "pagar" ? (
        <View style={{ gap: 8 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>{meta.cashQ}</Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              [true, "Sí"],
              [false, "No"],
            ].map(([v, l]) => (
              <TouchableOpacity
                key={l}
                onPress={() => setCashPagar(v)}
                accessibilityState={{ selected: cashPagar === v }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: cashPagar === v ? tint.strong : colors.border,
                  backgroundColor: cashPagar === v ? tint.soft : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Txt style={{ fontSize: 14, fontWeight: "700" }}>{l}</Txt>
              </TouchableOpacity>
            ))}
          </View>
          <Txt
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              lineHeight: 17,
            }}
          >
            {cashPagar
              ? "Sí: es un préstamo o crédito y el dinero ya entró; se suma a Mi saldo."
              : "No: no entró dinero y no afecta Mi saldo. Úsalo para servicios, alquiler, colegio, tarjetas o compras a cuotas."}
          </Txt>
        </View>
      ) : null}
      {isDebt && cash ? entBlock : null}

      {isDebt ? (
        <View style={{ gap: 8 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>Pago en cuotas</Txt>
          <ChipRow>
            {INST_OPTS.map((n) => (
              <Chip
                key={n}
                label={n === 0 ? "Sin cuotas" : `${n} cuotas`}
                active={n === inst}
                color={tint.strong}
                onPress={() => {
                  setInst(n);
                  // Con cuotas la primera suele vencer en 15 días y siempre lleva fecha
                  if (
                    n > 0 &&
                    (dueIdx === DUE_NONE || (!editing && dueIdx === 2))
                  )
                    setDueIdx(1);
                }}
              />
            ))}
          </ChipRow>
          {inst ? (
            <Txt
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                lineHeight: 17,
              }}
            >
              {amtNum > 0
                ? `${inst} cuotas de ${fx.money(ccy, amtNum / inst)}, una cada ${INST_DAYS} días.`
                : `${inst} cuotas, una cada ${INST_DAYS} días.`}
              {firstDue && lastDue
                ? ` Primera: ${fullDate(firstDue)} · Última: ${fullDate(lastDue)}.`
                : ""}
            </Txt>
          ) : null}
        </View>
      ) : null}

      {isDebt ? (
        <View style={{ gap: 8 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>
            {inst ? "Primera cuota" : "Vencimiento"}
          </Txt>
          <ChipRow>
            {editing?.dueBase ? (
              <Chip
                label={fullDate(editing.dueBase)}
                active={dueIdx === -1}
                color={tint.strong}
                onPress={() => setDueIdx(-1)}
              />
            ) : null}
            {DUE_OPTS.map((o, i) =>
              (inst || rec) && i === DUE_NONE ? null : (
                <Chip
                  key={o.l}
                  label={o.l}
                  active={i === dueIdx}
                  color={tint.strong}
                  onPress={() => setDueIdx(i)}
                />
              ),
            )}
          </ChipRow>
          {dueIdx === DUE_CUSTOM ? (
            <>
              <DateField
                value={dueCustom}
                onChange={setDueCustom}
                min={date}
                max={addDays(todayStr(), 3650)}
                tint={tint}
              />
              {dueBad ? (
                <Txt style={{ fontSize: 12, color: colors.danger.fg }}>
                  La fecha no puede ser anterior a la del movimiento.
                </Txt>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
      {/* Repetición mensual oculta por ahora (por cobrar y por pagar). Para mostrarla de nuevo: SHOW_RECURRING = true */}
      {SHOW_RECURRING && isDebt ? (
        <View style={{ gap: 8 }}>
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>
            Repetir cada mes
          </Txt>
          <ChipRow>
            {[
              [false, "No"],
              [true, "Sí, cada mes"],
            ].map(([v, l]) => (
              <Chip
                key={l}
                label={l}
                active={rec === v}
                color={tint.strong}
                onPress={() => {
                  setRec(v);
                  // Repetir necesita una fecha de vencimiento
                  if (v && dueIdx === DUE_NONE) setDueIdx(2);
                }}
              />
            ))}
          </ChipRow>
          <Txt
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              lineHeight: 17,
            }}
          >
            {rec
              ? "Cuando la saldes se crea sola la del mes siguiente, con el mismo monto y el vencimiento un mes después. La nueva no mueve dinero de tus entidades: el dinero se registra al " +
                (type === "pagar" ? "pagar." : "cobrar.")
              : "Útil para internet, colegio, suscripciones o un alquiler que cobras cada mes."}
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}
