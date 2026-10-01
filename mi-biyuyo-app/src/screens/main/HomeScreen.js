import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import {
  Screen,
  Txt,
  H1,
  H2,
  Card,
  ListCard,
  Tile,
  TonePill,
  Pill,
  SectionHead,
  AlertRow,
  MovRow,
  Icon,
  Divider,
  EyeButton,
  OnlyMulti,
} from "../../components/ui";
import { go } from "../../navigation/helpers";
import {
  KIND_ICON,
  alertsOf,
  balanceNote,
  byRecent,
  feed,
  pillOf,
} from "../../utils/ledger";
import { addDays, grp, maskMoney, nTxt, todayStr } from "../../utils/money";
import { useRateNotifications } from "../../contexts/RateNotificationsContext";
import { useGuide } from "../../contexts/GuideContext";

const MAX_ENTITIES = 2;
const MAX_MOVEMENTS = 20;

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { model, dv, threshold, showToast, hideBalance, toggleHideBalance } =
    useData();
  const { unread } = useRateNotifications();
  const guide = useGuide();
  const shown = (text) => (hideBalance ? maskMoney(text) : text);
  const { fx } = model;

  // Abre el historial en el tipo tocado y en los mismos 30 días del resumen
  const last30 = (filter) =>
    go(navigation, "History", {
      filter,
      from: addDays(todayStr(), -29),
      to: todayStr(),
      ts: Date.now(),
    });
  const m30 = model.moves.filter((m) => m.d < 30);
  const incomes = m30.filter((m) => m.type === "ingreso");
  const expenses = m30.filter((m) => m.type === "gasto");
  const cobr = model.moves.filter(
    (m) => m.type === "cobrar" && model.pendOf(m) > 0.005,
  );
  const pag = model.moves.filter(
    (m) => m.type === "pagar" && model.pendOf(m) > 0.005,
  );
  const overdue = (list) =>
    list.filter((m) => m.dueIn !== null && m.dueIn < 0).length;
  const cobrTot = cobr.reduce((a, m) => a + model.pendOf(m), 0);
  const pagTot = pag.reduce((a, m) => a + model.pendOf(m), 0);
  const pc = pillOf(cobr.length, overdue(cobr));
  const pp = pillOf(pag.length, overdue(pag));
  const alerts = alertsOf(model, dv, threshold);
  const sorted = model.moves.slice().sort(byRecent);
  const recent = feed(model, sorted, true, dv).slice(0, MAX_MOVEMENTS);
  const open = (nav) => go(navigation, nav.name, nav.params);

  const rateCard = (label, value, unit = "USD") => (
    <TouchableOpacity
      onPress={() => navigation.navigate("ExchangeRate")}
      activeOpacity={0.85}
      accessibilityLabel={`Ver ${label}`}
    >
      <Card
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        pad={0}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 14,
            paddingHorizontal: 16,
            flex: 1,
          }}
        >
          <Tile soft={colors.info.bg}>
            <Txt
              style={{ fontSize: 12, fontWeight: "800", color: colors.link }}
            >
              VES
            </Txt>
          </Tile>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textSecondary,
              }}
            >
              {label}
            </Txt>
            <Txt style={{ fontSize: 16, fontWeight: "700" }}>
              1 {unit} = {value}
            </Txt>
          </View>
          <Icon
            name="chevronRight"
            size={18}
            color={colors.textSecondary}
            stroke={2}
          />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const stat = (label, value, pill, toneKey, onPress) => (
    <Card onPress={onPress} style={{ flex: 1, gap: 6 }} pad={14}>
      <Txt
        style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "600" }}
      >
        {label}
      </Txt>
      <Txt style={{ fontSize: 20, fontWeight: "800" }}>{value}</Txt>
      {pill}
    </Card>
  );

  return (
    <Screen pull contentStyle={{ gap: 18 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ gap: 2 }}>
          <Txt
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              fontWeight: "500",
            }}
          >
            Panel de control
          </Txt>
          <H1 style={{ fontSize: 24 }}>{user?.name || "Mi Biyuyo"}</H1>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("GettingStarted")}
            accessibilityLabel="Ayuda"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="help" size={20} color={colors.text} stroke={2} />
            {guide.showDot ? (
              <View
                style={{
                  position: "absolute",
                  top: -3,
                  right: -3,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: colors.accent,
                  borderWidth: 2,
                  borderColor: colors.page,
                }}
              />
            ) : null}
          </TouchableOpacity>
          <OnlyMulti>
            <TouchableOpacity
              onPress={() => navigation.navigate("RateNotifications")}
              accessibilityLabel="Notificaciones"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="bell" size={20} color={colors.text} stroke={2} />
              {unread > 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    paddingHorizontal: 4,
                    backgroundColor: colors.gasto.strong,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "#ffffff",
                    }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </Txt>
                </View>
              ) : null}
            </TouchableOpacity>
          </OnlyMulti>
        </View>
      </View>

      {guide.showCard ? (
        <Card style={{ gap: 10, borderColor: colors.accent, borderWidth: 1.5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Tile icon="shield" soft={colors.chip} fg={colors.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={{ fontSize: 15, fontWeight: "800" }}>
                Empieza aquí
              </Txt>
              <Txt style={{ fontSize: 12, color: colors.textSecondary }}>
                {guide.doneCount} de {guide.total} pasos listos
              </Txt>
            </View>
          </View>
          <Txt
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: colors.textSecondary,
            }}
          >
            {fx.single
              ? "Para sacarle provecho a Mi Biyuyo, primero crea tus entidades con su saldo y empieza a registrar tus movimientos. Toca la guía y te llevamos paso a paso."
              : "Para sacarle provecho a Mi Biyuyo, primero registra las tasas BCV y Binance y crea tus entidades con su saldo. Toca la guía y te llevamos paso a paso."}
          </Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate("GettingStarted")}
              activeOpacity={0.85}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 12,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt
                style={{ color: "#ffffff", fontSize: 14, fontWeight: "800" }}
              >
                Ver guía
              </Txt>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={guide.dismiss}
              activeOpacity={0.85}
              style={{
                minHeight: 44,
                paddingHorizontal: 18,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt style={{ fontSize: 14, fontWeight: "700" }}>Ahora no</Txt>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      <View
        style={{
          backgroundColor: colors.accentDark,
          borderRadius: 20,
          padding: 20,
          gap: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: -8,
          }}
        >
          <Txt
            style={{
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.96,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            MI SALDO
          </Txt>
          <EyeButton hidden={hideBalance} onPress={toggleHideBalance} />
        </View>
        <Txt
          style={{
            fontSize: 36,
            fontWeight: "800",
            letterSpacing: -0.72,
            color: "#ffffff",
          }}
        >
          {shown(fx.money("usd", model.balance))}
        </Txt>
        <Txt
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.85)",
            marginTop: -8,
          }}
        >
          {balanceNote(model)}
        </Txt>
        <OnlyMulti>
          <View style={{ gap: 8 }}>
            {[
              ["BCV", fx.money("bcv", fx.fromUsd("bcv", model.balance))],
              [
                "Binance P2P",
                fx.money("bin", fx.fromUsd("bin", model.balance)),
              ],
            ].map(([label, value]) => (
              <View
                key={label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}
              >
                <Txt style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                  {label}
                </Txt>
                <Txt
                  style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}
                >
                  {fx.ready(label === "BCV" ? "bcv" : "bin")
                    ? shown(value)
                    : "Sin tasa"}
                </Txt>
              </View>
            ))}
          </View>
        </OnlyMulti>
      </View>

      {alerts.length ? (
        <View style={{ gap: 8 }}>
          {alerts.map((a) => (
            <AlertRow
              key={a.key}
              title={a.title}
              sub={a.sub}
              onPress={() => open(a.nav)}
            />
          ))}
        </View>
      ) : null}

      <OnlyMulti>
        <View style={{ gap: 10 }}>
          {rateCard("Tasa BCV", "VES " + grp(fx.rate, ".", ","))}
          {rateCard(
            "Tasa Binance P2P",
            "VES " + grp(fx.rateB, ".", ","),
            "USDT",
          )}
        </View>
      </OnlyMulti>

      <View style={{ gap: 10 }}>
        <SectionHead
          title="Resumen operativo"
          action="Ver estadísticas"
          onAction={() => go(navigation, "Stats")}
        />
        <Txt
          style={{ fontSize: 12, color: colors.textSecondary, marginTop: -8 }}
        >
          Ingresos y gastos de los últimos 30 días
        </Txt>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {stat(
            "Ingresos",
            fx.money("usd", model.sum(m30, "ingreso")),
            <Pill
              label={nTxt(incomes.length, "ingreso")}
              bg={colors.ok.bg}
              fg={colors.ok.fg}
            />,
            null,
            () => last30("ingreso"),
          )}
          {stat(
            "Gastos",
            fx.money("usd", model.sum(m30, "gasto")),
            <Pill
              label={nTxt(expenses.length, "gasto")}
              bg={colors.gasto.soft}
              fg={colors.gasto.fg}
            />,
            null,
            () => last30("gasto"),
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {stat(
            "Por cobrar",
            fx.money("usd", cobrTot),
            <TonePill label={pc.t} toneName={pc.tone} />,
            null,
            () => go(navigation, "Receivables"),
          )}
          {stat(
            "Por pagar",
            fx.money("usd", pagTot),
            <TonePill label={pp.t} toneName={pp.tone} />,
            null,
            () => go(navigation, "Payables"),
          )}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHead
          title="Mis entidades"
          action="Ver todas"
          onAction={() => go(navigation, "Entities")}
        />
        <ListCard>
          {model.ents.length === 0 ? (
            <Txt
              style={{
                padding: 16,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              Aún no tienes entidades. Crea una para empezar a llevar tu saldo.
            </Txt>
          ) : (
            model.ents.slice(0, MAX_ENTITIES).map((e, i) => {
              const k = colors.kind[e.kind] || colors.kind.otro;
              return (
                <View key={e.id}>
                  {i > 0 ? <Divider /> : null}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate("EntityDetail", { id: e.id })
                    }
                    accessibilityLabel={`${e.name}, saldo ${dv(model.entBal(e))}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Tile
                      icon={KIND_ICON[e.kind] || "card"}
                      soft={k.soft}
                      fg={k.fg}
                    />
                    <Txt
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: 14, fontWeight: "700" }}
                    >
                      {e.name}
                    </Txt>
                    <Txt style={{ fontSize: 14, fontWeight: "800" }}>
                      {dv(model.entBal(e))}
                    </Txt>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ListCard>
      </View>

      <View style={{ gap: 10 }}>
        <H2>Accesos clave</H2>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            go(navigation, "Pick", { type: "gasto", ts: Date.now() })
          }
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            padding: 16,
            backgroundColor: colors.accent,
            borderRadius: 16,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="plus" size={22} color="#ffffff" stroke={2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
              Ingresar gasto
            </Txt>
            <Txt style={{ fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
              Elige la categoría y registra el monto
            </Txt>
          </View>
          <Icon name="chevronRight" size={18} color="#ffffff" stroke={2} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            ["ingreso", "arrowUp", "Ingresar ingreso", colors.ingreso.strong],
            ["cobrar", "swap", "Registrar por cobrar", colors.cobrar.strong],
            ["pagar", "card", "Registrar por pagar", colors.pagar.strong],
          ].map(([type, icon, label, color]) => (
            <Card
              key={type}
              onPress={() => go(navigation, "Pick", { type, ts: Date.now() })}
              pad={0}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  minHeight: 96,
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <Icon name={icon} size={22} color={color} stroke={2} />
                <Txt
                  style={{ fontSize: 13, fontWeight: "600", lineHeight: 16 }}
                >
                  {label}
                </Txt>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHead
          title="Últimos movimientos"
          action="Ver todos"
          onAction={() =>
            go(navigation, "History", { filter: "all", ts: Date.now() })
          }
        />
        <ListCard>
          {recent.length === 0 ? (
            <Txt
              style={{ padding: 16, fontSize: 13, color: colors.textSecondary }}
            >
              Todavía no hay movimientos.
            </Txt>
          ) : (
            recent.map((r, i) => (
              <View key={r.key}>
                {i > 0 ? <Divider /> : null}
                <MovRow row={r} onPress={() => open(r.nav)} />
              </View>
            ))
          )}
        </ListCard>
      </View>
    </Screen>
  );
}
