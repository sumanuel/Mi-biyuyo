import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Screen, Header, Txt, Card, Icon } from "../../components/ui";

const TOPICS = [
  {
    title: "Tasas de cambio (BCV y Binance)",
    body: [
      "El dólar (USD) es la moneda base. Mi Biyuyo necesita dos tasas: BCV (bolívares por 1 USD) y Binance P2P (bolívares por 1 USDT). Con ellas convierte todo entre USD, VES y USDT.",
      "Ve a Ajustes > Tasas de cambio. Puedes escribirlas a mano o tocar «Obtener tasas en línea» para traerlas.",
      "Activa la consulta diaria para que, a las 7:00 a. m., la app revise las tasas y te avise en la campanita. Tú decides si las actualizas.",
      "Sin tasas no puedes registrar en bolívares ni en USDT.",
    ],
  },
  {
    title: "Entidades y saldos",
    body: [
      "Una entidad es el lugar donde está tu dinero: efectivo, un banco, una billetera digital, etc. Se crean en Entidades > Nueva entidad.",
      "Elige su moneda (USD, VES o USDT) y su saldo inicial. El saldo inicial se registra como el primer movimiento de la entidad.",
      "«Sumar a Mi saldo» decide si el saldo de esa entidad cuenta en tu saldo total. Si lo desmarcas, la entidad sigue funcionando pero no suma.",
      "Con «Transferir» mueves dinero entre entidades, con comisión opcional. También puedes definir una alerta de saldo bajo.",
      "Para ordenar tus entidades, mantén presionada una, arrástrala al lugar que prefieras y suéltala. El orden se guarda en tu cuenta.",
    ],
  },
  {
    title: "Registrar ingresos y gastos",
    body: [
      "Toca Registrar (+) y elige la categoría. Escribe el monto, elige la moneda del registro, la fecha y la entidad de donde sale o entra el dinero.",
      "Abajo verás el equivalente en las tres monedas con la tasa del día. Esa tasa queda guardada con el movimiento.",
      "Puedes adjuntar un recibo con foto o archivo.",
    ],
  },
  {
    title: "Ordenar tus categorías",
    body: [
      "En Registrar puedes poner las categorías en el orden que prefieras, para tener a mano las que más usas.",
      "Mantén presionada una categoría un instante, arrástrala al lugar que quieras y suéltala. Las demás se acomodan solas, y si la lista es larga se desplaza cuando llegas al borde de la pantalla.",
      "Cada tipo (gastos, ingresos, por cobrar y por pagar) tiene su propio orden. Se guarda en tu cuenta, así que lo conservas si cambias de teléfono.",
    ],
  },
  {
    title: "Por cobrar y por pagar",
    body: [
      "Por cobrar es lo que te deben (por ejemplo, un préstamo que hiciste). Por pagar es lo que tú debes.",
      "Escribe la persona y el vencimiento (7, 15, 30 días o sin fecha). En Por pagar, «¿Recibiste el dinero?» es Sí si fue un préstamo que entró a una entidad, y No para servicios, cuotas o compras a crédito.",
      "Para cobrar o pagar de a poco, abre la deuda y toca «Registrar cobro» o «Registrar pago». Cuando se salda pasa a la pestaña Canceladas.",
    ],
  },
  {
    title: "Detalle de las compras",
    body: [
      "En un gasto abre «Detalle de la compra» y agrega los ítems: pan, queso, vino… Es opcional, pero muy útil.",
      "Si activas «Asignar monto a cada ítem», cada uno lleva su monto (la suma no puede pasar del total).",
      "Con eso, en Estadísticas > Ítems más comprados ves qué compras más y en qué fechas compraste cada cosa.",
      "En Estadísticas, toca una categoría de «Gastos por categoría» o «Ingresos por fuente» para ver todos sus movimientos del período y abrir cualquiera.",
    ],
  },
  {
    title: "Estadísticas e historial",
    body: [
      "En Estadísticas elige Este mes, Mes anterior, Últimos 3 meses o tus propias fechas Desde/Hasta. Verás ingresos, gastos, categorías con más gasto e ítems más comprados.",
      "«Situación actual» (distribución del saldo y deudas) siempre muestra cómo estás hoy, sin importar el período.",
      "En el Historial filtras por tipo y fechas, y buscas por ítem, categoría o persona.",
    ],
  },
  {
    title: "Editar o eliminar un movimiento",
    body: [
      "Abre un movimiento y toca «Editar movimiento». Se conservan las tasas del día en que lo registraste.",
      "En una deuda que ya tiene abonos no se puede cambiar la moneda ni bajar el monto por debajo de lo abonado.",
      "Al eliminar un movimiento, los saldos de las entidades se recalculan.",
    ],
  },
  {
    title: "Seguridad de tu cuenta",
    body: [
      "Al registrarte confirmas tu correo con un código de 6 dígitos.",
      "En Ajustes > Seguridad puedes activar el desbloqueo con huella o Face ID (si tu teléfono lo permite). Después podrás entrar con un toque desde el inicio de sesión.",
      "El ojito junto a Mi saldo oculta los montos cuando alguien mira tu pantalla.",
    ],
  },
  {
    title: "¿Por qué Mi saldo cambia si cambian las tasas?",
    body: [
      "Los movimientos conservan la tasa del día en que los registraste, pero Mi saldo, tus entidades en VES o USDT y lo que está pendiente por cobrar o pagar se valoran con la tasa de hoy. Por eso pueden cambiar cuando se actualizan las tasas.",
    ],
  },
  {
    title: "¿Por qué una entidad aparece en negativo?",
    body: [
      "Porque registraste gastos o pagos desde esa entidad por más de lo que tenía. Revisa si falta un ingreso, un saldo inicial o una transferencia hacia ella.",
    ],
  },
];

/** Centro de ayuda: temas desplegables. */
export default function HelpCenterScreen({ navigation }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(0);

  return (
    <Screen data={false} contentStyle={{ gap: 10, paddingTop: 16 }}>
      <Header title="Centro de ayuda" onBack={() => navigation.goBack()} />
      <Txt style={{ fontSize: 13, color: colors.textSecondary }}>
        Toca un tema para ver cómo funciona.
      </Txt>
      {TOPICS.map((t, i) => {
        const isOpen = open === i;
        return (
          <Card key={t.title} pad={0}>
            <TouchableOpacity
              onPress={() => setOpen(isOpen ? -1 : i)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                minHeight: 52,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Txt style={{ flex: 1, fontSize: 14, fontWeight: "700" }}>
                {t.title}
              </Txt>
              <View
                style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
              >
                <Icon
                  name="chevronRight"
                  size={18}
                  color={colors.textSecondary}
                  stroke={2}
                />
              </View>
            </TouchableOpacity>
            {isOpen ? (
              <View
                style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 14 }}
              >
                {t.body.map((p) => (
                  <Txt
                    key={p}
                    style={{
                      fontSize: 13,
                      lineHeight: 19,
                      color: colors.textSecondary,
                    }}
                  >
                    {p}
                  </Txt>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
