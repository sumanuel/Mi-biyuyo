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
  grp,
  nTxt,
  parseNum,
  todayStr,
  addDays,
  fullDate,
} from "../../utils/money";
import { takePhoto, pickFile } from "../../utils/receipt";
import DateField from "../../components/DateField";
import { useFocusChain } from "../../hooks/useFocusChain";

const DUE_OPTS = [
  { l: "7 días", v: 7 },
  { l: "15 días", v: 15 },
  { l: "30 días", v: 30 },
  { l: "Sin fecha", v: null },
];
const SUG_GASTO = [
  "Queso",
  "Jamón",
  "Pan",
  "Leche",
  "Huevos",
  "Vino",
  "Aceitunas",
  "Pollo",
  "Frutas",
  "Refresco",
];
const SUG_PAGAR = ["Cuota", "Intereses", "Seguro", "Comisión"];

export default function MovementFormScreen({ navigation, route }) {
  const chain = useFocusChain();
  const { colors } = useTheme();
  const { model, actions, showToast } = useData();
  const { fx } = model;

  // Edición: parte de un movimiento existente y conserva las tasas del día en que se registró
  const editing = model.moveById[route.params?.editId] || null;
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
  const lockCcy =
    !!editing && isDebtType(editing.type) && editing.pays.length > 0;
  const paidNat = lockCcy ? model.paidNative(editing) : 0;

  const initItems = editing
    ? editing.items.map((it, i) => ({
        id: "e" + i,
        name: it.name,
        amt:
          it.usd > 0 && origOk
            ? nat(it.usd * (editing.amount / editing.usd))
            : "",
      }))
    : [];
  const [ccy, setCcy] = useState(editing ? editing.ccy : "usd");
  const [amount, setAmount] = useState(editing ? nat(editing.amount) : "");
  const [desc, setDesc] = useState(editing?.hasDesc ? editing.title : "");
  const [person, setPerson] = useState(editing?.person || "");
  const [date, setDate] = useState(editing ? editing.date : todayStr());
  const [entId, setEntId] = useState(editing ? editing.ent : null);
  // -1 = conservar el vencimiento actual (solo al editar)
  const [dueIdx, setDueIdx] = useState(
    editing ? (editing.dueDate ? -1 : 3) : 2,
  );
  const [cashPagar, setCashPagar] = useState(editing ? editing.cash : false);
  const [items, setItems] = useState(initItems);
  const [itemsOpen, setItemsOpen] = useState(initItems.length > 0);
  const [iName, setIName] = useState("");
  const [itemsAmt, setItemsAmt] = useState(initItems.some((i) => i.amt));
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
  const entSel = entId && model.entById[entId] ? entId : model.ents[0]?.id;
  // Por cobrar: el dinero ya salió. Por pagar: solo suma al saldo si el usuario lo recibió.
  const cash = type !== "pagar" || cashPagar;
  const needsEnt = !isDebt || cash;
  const noEnts = model.ents.length === 0;

  const itemsSumUsd = itemsAmt
    ? items.reduce((a, it) => a + toUsdE(ccy, parseNum(it.amt)), 0)
    : 0;
  const missing = itemsAmt
    ? items.filter((it) => parseNum(it.amt) <= 0).length
    : 0;
  const overItems = itemsAmt && itemsSumUsd > usdVal + 0.005;
  const itemsInvalid =
    showItems && itemsAmt && items.length > 0 && (missing > 0 || overItems);
  const rateMissing = !readyF(ccy);
  const belowPaid = lockCcy && amtNum > 0 && amtNum < paidNat - 0.01;

  let itemsMsg = "";
  let itemsMsgDanger = false;
  if (items.length && !itemsAmt)
    itemsMsg = `${nTxt(items.length, "ítem")} sin monto. El total sigue siendo ${fx.money(ccy, amtNum)}.`;
  if (items.length && itemsAmt) {
    const rest = fromUsdE(ccy, Math.max(0, usdVal - itemsSumUsd));
    if (overItems) {
      itemsMsg = `La suma de los ítems supera el total en ${fx.money(ccy, fromUsdE(ccy, itemsSumUsd - usdVal))}.`;
      itemsMsgDanger = true;
    } else if (missing > 0) {
      itemsMsg = `Falta el monto de ${nTxt(missing, "ítem")}.`;
      itemsMsgDanger = true;
    } else {
      itemsMsg =
        `Detallado ${fx.money(ccy, fromUsdE(ccy, itemsSumUsd))} de ${fx.money(ccy, amtNum)}` +
        (rest > 0.005
          ? `. Sin detallar ${fx.money(ccy, rest)}.`
          : ". Todo detallado.");
    }
  }

  const canSave =
    amtNum > 0 &&
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
      { id: `i${Date.now()}-${prev.length}`, name: n, amt: "" },
    ]);
    setIName("");
  };
  const sugg = (type === "pagar" ? SUG_PAGAR : SUG_GASTO)
    .filter(
      (n) => !items.some((it) => it.name.toLowerCase() === n.toLowerCase()),
    )
    .slice(0, 6);

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
      const v = dueIdx >= 0 ? DUE_OPTS[dueIdx].v : null;
      const body = {
        category_id: cat.id,
        amount: amtNum,
        currency: CCY_TO_API[ccy],
        description: desc.trim() || null,
        date,
        counterpart_name: isDebt ? person.trim() || null : null,
        entity_id: needsEnt ? entSel : null,
        cash: isDebt ? cash : true,
        due_date: !isDebt
          ? null
          : dueIdx === -1
            ? editing.dueDate
            : v !== null
              ? addDays(date, v)
              : null,
        items: showItems
          ? items.map((it) => ({
              name: it.name,
              amount:
                itemsAmt && parseNum(it.amt) > 0 ? parseNum(it.amt) : null,
            }))
          : [],
      };
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
      {model.ents.map((e) => (
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
            .filter((c) => c.type === type && c.active)
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
        <ConvRows title="EQUIVALENCIAS" rows={convRows} tint={tint} />
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
        {...chain(2, { last: true })}
      />

      {showItems ? (
        <Card style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() => setItemsOpen((v) => !v)}
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
            <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
              {items.length ? nTxt(items.length, "ítem") : "Opcional"}
            </Txt>
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
                  onSubmitEditing={() => addNamed(iName)}
                  placeholder="Ej: queso, jamón, vino"
                  accessibilityLabel="Nuevo ítem"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 48,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    paddingHorizontal: 14,
                    fontSize: 15,
                  }}
                />
                <TouchableOpacity
                  onPress={() => addNamed(iName)}
                  style={{
                    minHeight: 48,
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
              <ChipRow>
                {sugg.map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => addNamed(n)}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 14,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: colors.disabled,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Txt style={{ fontSize: 13, fontWeight: "600" }}>+ {n}</Txt>
                  </TouchableOpacity>
                ))}
              </ChipRow>
              <View>
                {items.map((it) => (
                  <View
                    key={it.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.divider,
                    }}
                  >
                    <Txt
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: 14, fontWeight: "600" }}
                    >
                      {it.name}
                    </Txt>
                    {itemsAmt ? (
                      <Input
                        value={it.amt}
                        onChangeText={(v) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === it.id ? { ...x, amt: v } : x,
                            ),
                          )
                        }
                        keyboardType="decimal-pad"
                        placeholder="0,00"
                        accessibilityLabel={`Monto de ${it.name}`}
                        style={{
                          width: 92,
                          minHeight: 40,
                          borderWidth: 1,
                          borderColor:
                            parseNum(it.amt) <= 0
                              ? colors.danger.border
                              : colors.border,
                          borderRadius: 10,
                          backgroundColor: colors.surface,
                          paddingHorizontal: 10,
                          textAlign: "right",
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      />
                    ) : null}
                    <TouchableOpacity
                      onPress={() =>
                        setItems((prev) => prev.filter((x) => x.id !== it.id))
                      }
                      accessibilityLabel={`Quitar ${it.name}`}
                      style={{
                        width: 44,
                        height: 44,
                        alignItems: "center",
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
                ))}
              </View>
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
              <TouchableOpacity
                onPress={() => setItemsAmt((v) => !v)}
                accessibilityRole="switch"
                accessibilityState={{ checked: itemsAmt }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 48,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: itemsAmt ? tint.strong : colors.disabled,
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      top: 3,
                      left: itemsAmt ? 21 : 3,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: "#ffffff",
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontSize: 14, fontWeight: "700" }}>
                    Asignar monto a cada ítem
                  </Txt>
                  <Txt
                    style={{
                      fontSize: 12,
                      lineHeight: 16,
                      color: colors.textSecondary,
                    }}
                  >
                    Cada ítem lleva su monto y la suma no puede pasar del total.
                    Da estadísticas más precisas.
                  </Txt>
                </View>
              </TouchableOpacity>
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
          <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
            Opcional
          </Txt>
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
                onPress={() => attach(fn)}
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
          <Txt style={{ fontSize: 14, fontWeight: "700" }}>Vencimiento</Txt>
          <ChipRow>
            {editing?.dueDate ? (
              <Chip
                label={fullDate(editing.dueDate)}
                active={dueIdx === -1}
                color={tint.strong}
                onPress={() => setDueIdx(-1)}
              />
            ) : null}
            {DUE_OPTS.map((o, i) => (
              <Chip
                key={o.l}
                label={o.l}
                active={i === dueIdx}
                color={tint.strong}
                onPress={() => setDueIdx(i)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}
    </Screen>
  );
}
