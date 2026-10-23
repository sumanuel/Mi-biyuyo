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
      "En Últimos movimientos y en el Historial, cada movimiento muestra debajo cuánto te quedó justo después de hacerlo: el saldo de la entidad que usaste (por ejemplo, «Banesco USD 831.30») y «Mi saldo», el total de tus entidades que suman. Así sigues cómo evoluciona tu dinero. Las transferencias muestran solo Mi saldo, y si la entidad no suma a Mi saldo, solo ves el de la entidad. Los saldos se valoran con la tasa de hoy, igual que Mi saldo, así que el más reciente coincide con lo que ves arriba.",
    ],
  },
  {
    title: "Registrar ingresos y gastos",
    body: [
      "Toca Registrar (+) y elige la categoría. Escribe el monto, elige la moneda del registro, la fecha y la entidad de donde sale o entra el dinero.",
      "La moneda del registro empieza en VES · BCV; si lo necesitas, cámbiala a USD o USDT antes de guardar.",
      "Abajo verás el equivalente en las tres monedas con la tasa del día. Esa tasa queda guardada con el movimiento.",
      "¿No encuentras la categoría que necesitas? Al final de la lista de categorías está el botón «Nueva categoría»: crea una del tipo que tengas abierto (ingreso, gasto, por cobrar o por pagar) sin salir de Registrar.",
      "Puedes adjuntar un recibo con foto o archivo.",
    ],
  },
  {
    title: "Gastos planificados",
    body: [
      "¿Vas a ir al súper en unos días y ya tienes tu lista? Entra a Registrar > Gastos, toca «Gastos planificados» y crea uno: ponle el nombre que quieras (por ejemplo, «Compra del súper»), la categoría, una fecha prevista si quieres y los ítems, cada uno con cantidad y monto opcional.",
      "Cuando llegue el momento, toca «Registrar»: se abre el formulario de gasto ya relleno con el monto estimado y los ítems. Ajusta lo que haga falta (por ejemplo, los precios reales) y guarda.",
      "Un plan no afecta tu saldo hasta que lo registras, y se conserva para volver a usarlo cuantas veces quieras. Puedes tener todos los que necesites; para cambiarlo o borrarlo, tócalo en la lista.",
    ],
  },
  {
    title: "Mis categorías",
    body: [
      "Ve a Ajustes > Perfil > Mis categorías. Ahí ves las categorías de cada tipo (ingresos, gastos, por cobrar y por pagar): las tuyas y las predeterminadas.",
      "Toca «Nueva categoría» para crear una: se crea en el tipo que tengas abierto (la pestaña en la que estás), y solo le pones un nombre y eliges un icono. También puedes crearla desde Registrar, con el botón «Nueva categoría» del final de la lista. Las que creas son solo tuyas: puedes editarlas (nombre e icono) o eliminarlas tocándolas en la lista; el tipo no se puede cambiar.",
      "Si la categoría que eliminas tiene movimientos, la app te pide a cuál otra categoría del mismo tipo quieres pasarlos, y los mueve antes de eliminarla.",
      "El interruptor de cada categoría decide si aparece al registrar un movimiento. Es solo para ver lo que realmente usas: una categoría oculta con movimientos se sigue mostrando en el historial, las estadísticas y los detalles. Las predeterminadas no se pueden editar ni eliminar, pero sí ocultar.",
    ],
  },
  {
    title: "Ordenar tus categorías",
    body: [
      "En Registrar puedes poner las categorías en el orden que prefieras, para tener a mano las que más usas.",
      "Mantén presionada una categoría un instante, arrástrala al lugar que quieras y suéltala. Las demás se acomodan solas, y si la lista es larga se desplaza cuando llegas al borde de la pantalla.",
      "Las categorías que ocultaste en «Mis categorías» no aparecen aquí. Cada tipo (gastos, ingresos, por cobrar y por pagar) tiene su propio orden. Se guarda en tu cuenta, así que lo conservas si cambias de teléfono.",
    ],
  },
  {
    title: "Por cobrar y por pagar",
    body: [
      "Por cobrar es lo que te deben (por ejemplo, un préstamo que hiciste). Por pagar es lo que tú debes.",
      "Escribe la persona y el vencimiento (7, 15, 30 días o sin fecha). En Por pagar, «¿Recibiste el dinero?» es Sí si fue un préstamo que entró a una entidad, y No para servicios, cuotas o compras a crédito.",
      "Para cobrar o pagar de a poco, abre la deuda y toca «Registrar cobro» o «Registrar pago». Cuando se salda pasa a la pestaña Canceladas.",
      "Si te equivocas en un cobro o un pago, abre la deuda y toca «Eliminar» junto a ese abono en el «Historial de abonos». Es irreversible, pero la deuda recupera ese saldo pendiente (si estaba saldada vuelve a Pendientes) y el dinero vuelve a la entidad con la que lo registraste. Después puedes registrarlo de nuevo con el monto correcto.",
      "En una deuda por cuotas, cada abono del historial indica a qué cuota corresponde: «Cuota 1 de 3», «Cuotas 1 a 2 de 3», «abono a la cuota 2» si solo cubre una parte, o «completa la cuota 2» si termina de pagar una que ya tenía abono.",
      "Toca una deuda de la lista (Pendientes o Canceladas) para ver su detalle sin editarla: «Datos de la deuda» muestra quién te debe o a quién le debes, la descripción, la categoría, la fecha de registro, el vencimiento y la entidad; más abajo, el saldo, las cuotas y el historial de abonos.",
      "Además de 7, 15 o 30 días, puedes elegir una fecha de vencimiento en el calendario («Elegir fecha»).",
      "Si el comercio cobra en cuotas, elige 3, 6, 9 o 12 cuotas: se reparte el monto en partes iguales, una cada 15 días desde la fecha de la primera cuota. En el detalle de la deuda ves cada cuota; tus pagos las van cubriendo en orden y el vencimiento que se muestra es el de la próxima cuota.",
      "Al registrar un pago de una deuda en cuotas, en «Cuotas a pagar» eliges cuántas pagar: 1 cuota, 2, 3… o todas. El monto se llena solo con lo que falta de esas cuotas (y se recalcula si cambias la moneda). Si ya habías abonado algo a la siguiente cuota, se paga lo que falta. También puedes escribir el monto que quieras, o usar «Saldo total» y «Mitad».",
    ],
  },
  {
    title: "Detalle de las compras",
    body: [
      "En un gasto abre «Detalle de la compra» y agrega los ítems: pan, queso, vino… Es opcional, pero muy útil.",
      "Cada ítem tiene su casilla «Cantidad» (empieza en 1; puedes poner 2, 0,5, 1,25…). El monto del ítem sigue siendo el total de esa línea: si compraste 3 quesos por 15, pones cantidad 3 y monto 15.",
      "Si activas «Asignar monto a cada ítem», cada uno lleva su monto (la suma no puede pasar del total).",
      "Con eso, en Estadísticas > Ítems más comprados ves qué compras más y en qué fechas compraste cada cosa. También ves la cantidad total del período: por ejemplo, si compraste jamón 2, 3 y 1 vez, aparece «Cantidad total: 6». Los ítems sin cantidad (por ejemplo, los registrados antes de existir esta casilla) cuentan como 1. Al tocar el ítem ves la cantidad y el monto de cada compra, además del monto total y los promedios por compra y por unidad cuando hay montos asignados. Las compras de ese ítem que no tienen monto se estiman con el último precio por unidad que tenga (monto ÷ cantidad de su compra más reciente con monto) y aparecen marcadas como «Estimado»; si el ítem nunca tuvo monto, no se calcula nada.",
      "No te preocupes por cómo escribes cada ítem: «Jamón», «jamon» y «jamones» cuentan como el mismo (se ignoran mayúsculas, tildes y el plural). Se muestra con la forma que más has usado. Las búsquedas del Historial funcionan igual.",
    ],
  },
  {
    title: "Estadísticas e historial",
    body: [
      "En Estadísticas elige Este mes, Mes anterior, Últimos 3 meses o tus propias fechas Desde/Hasta. Verás ingresos, gastos, categorías con más gasto e ítems más comprados.",
      "Toca una categoría de «Gastos por categoría» o «Ingresos por fuente» para ver todos sus movimientos del período; desde ahí puedes abrir cualquiera.",
      "«Situación actual» (distribución del saldo y deudas) siempre muestra cómo estás hoy, sin importar el período.",
      "En el Historial filtras por tipo y fechas, y buscas por ítem, categoría o persona.",
    ],
  },
  {
    title: "Editar o eliminar un movimiento",
    body: [
      "Abre un movimiento y toca «Editar movimiento». Se conservan las tasas del día en que lo registraste.",
      "En una deuda que ya tiene abonos no se puede cambiar la moneda ni bajar el monto por debajo de lo abonado.",
      "Al eliminar un movimiento, los saldos de las entidades se recalculan. La app te avisa antes, porque eliminar es irreversible.",
      "Para eliminar una cuenta por cobrar o por pagar, ábrela y toca «Eliminar cuenta por cobrar» (o «por pagar») al final del detalle. Se elimina junto con todos sus abonos, y los saldos de tus entidades quedan como si esa deuda nunca se hubiera registrado: se devuelve el dinero que salió o entró al registrarla y con cada abono.",
    ],
  },
  {
    title: "Seguridad de tu cuenta",
    body: [
      "Al registrarte confirmas tu correo con un código de 6 dígitos.",
      "En Ajustes > Seguridad puedes activar el desbloqueo con huella o Face ID (si tu teléfono lo permite). Después podrás entrar con un toque desde el inicio de sesión.",
      "Si sales a otra app (por ejemplo WhatsApp) en medio de un registro y vuelves, la app pide la huella, pero al desbloquear sigues en la misma pantalla y con lo que ya habías escrito.",
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
