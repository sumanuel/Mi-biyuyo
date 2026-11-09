# Suscripción: matriz de pruebas en el teléfono (Expo Go)

Todo se prueba contra la **base y la API locales**, nunca contra producción. Lo que ya cubren las pruebas automáticas (`npm run test:suscripcion` y `npm run test:pagos`, 189 comprobaciones) no se repite aquí: esto es lo que conviene ver con tus ojos en el teléfono.

## 1. Preparar el entorno

Desde `mi-biyuyo-api`, con una rama que **no** sea `develop` ni `main` (así usa la base local):

```bash
SUBSCRIPTIONS_ENABLED=true ADMIN_KEY=clave-de-prueba-local-0123456789 npm start
```

Desde `mi-biyuyo-app`, con la IP de tu PC (hoy `192.168.1.9`; cámbiala si es otra):

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.9:3001/api npx expo start --lan -c
```

- Teléfono en la misma wifi, y el firewall de Windows debe permitir los puertos 3001 y 8081.
- Abre «Mi Biyuyo» en Expo Go. Entra con `demo@mibiyuyo.test` (usuario de prueba local).
- El panel de administración: `http://192.168.1.9:3001/admin/` desde cualquier navegador de tu red, con la clave de arriba.

## 2. Poner al usuario en cada estado

```bash
npm run plan:set -- demo@mibiyuyo.test <estado> [días]
```

| Estado | Qué simula |
|---|---|
| `none` | Usuario anterior a la función: recibe su prueba al entrar |
| `trial [días]` | En prueba, quedan N días (14 por defecto) |
| `free` | Prueba terminada, plan Gratis |
| `premium [días]` | Premium vigente (30 días por defecto) |
| `premium-vence` | Premium que vence en 2 días (aviso de Inicio) |
| `premium-vencido` | Premium que venció ayer (pasa a Gratis) |

Después de cambiar el estado, **cierra y vuelve a abrir la app** (o jala hacia abajo para recargar) para que lea el plan nuevo.

## 3. Qué comprobar en cada estado

Marca cada casilla en el teléfono.

### Prueba (`trial 9`)
- [ ] Inicio: aviso «Prueba Premium: te quedan 9 días»; al tocarlo abre Mi plan.
- [ ] Crear una 2.ª entidad, transferir, crear por cobrar y por pagar, abonar, planificar un gasto.
- [ ] Crear y usar una categoría propia; registrar con ítems y con recibo.
- [ ] Estadísticas: se ven todas las secciones. Exportar a Excel funciona.
- [ ] Ajustes > Mi plan muestra «Prueba Premium» y los días.
- [ ] Filtros: todas las opciones se pueden elegir, incluidos Mes anterior, Mes específico y Desde / Hasta.
- [ ] Inicio: corona **con contorno** y «Prueba» junto al nombre; al tocarla abre Mi plan.

### Gratis (`free`)
- [ ] Inicio: aviso «Tu prueba Premium terminó».
- [ ] Entidades: solo la primera sin etiqueta; las demás dicen «Solo lectura» y siguen sumando a Mi saldo.
- [ ] Abrir una entidad en solo lectura: no deja transferir ni ajustar saldo y explica por qué.
- [ ] Registrar un gasto o un ingreso en la primera entidad: funciona.
- [ ] Registrar: «Por cobrar» y «Por pagar» muestran el bloque Premium; «Gastos planificados» tiene la etiqueta.
- [ ] Una deuda que ya existía se puede abrir y ver; «Registrar pago» y «Editar deuda» llevan a Mi plan.
- [ ] Formulario de gasto: «Detalle de la compra» y «Recibo» tienen la etiqueta Premium y llevan a Mi plan.
- [ ] Categorías propias: no salen al registrar; «Nueva categoría» lleva a Mi plan. Los movimientos antiguos conservan su categoría.
- [ ] Estadísticas: solo Balance del período, Ahorro / Brecha Binance y Distribución del saldo; el resto, bloqueado.
- [ ] Botón «Filtros»: solo «Últimos 30 días» y «Este mes» se pueden elegir; «Mes anterior», «Mes específico» y «Desde / Hasta» muestran la etiqueta Premium y llevan a Mi plan.
- [ ] Inicio: no hay corona junto al nombre.
- [ ] Ajustes > Exportar a Excel lleva a Mi plan.
- [ ] Nada se borró: mismos saldos, deudas, planes y categorías que en Premium.

### Premium (`premium 25`)
- [ ] Todo lo de Prueba funciona; las entidades que estaban en solo lectura vuelven a ser normales.
- [ ] Mi plan dice «Premium hasta» con la fecha correcta y el botón es «Renovar Premium».
- [ ] Sin aviso en Inicio (solo aparece si vence en 7 días o menos).
- [ ] Inicio: corona **dorada llena** junto al nombre; al tocarla abre Mi plan.

### Premium por vencer (`premium-vence`) y vencido (`premium-vencido`)
- [ ] `premium-vence`: Inicio avisa «Tu Premium vence en 2 días».
- [ ] `premium-vencido`: si tenías elegido «Mes anterior» u otro período Premium, vuelve solo a «Últimos 30 días»; pasa a Gratis como arriba; al pagar o canjear un código, todo vuelve **sin salir de la app** (jala para recargar si hace falta).

## 4. Pagos y códigos
- [ ] Mi plan > Activar Premium: elegir Mensual/Anual y cada método; el monto de Pago móvil sale en bolívares con la tasa del día y los de Zinli/PayPal en USD.
- [ ] «Copiar datos de pago» copia los datos y el monto.
- [ ] «Ya pagué» sin referencia no deja enviar. Con referencia (y con y sin captura): queda «En revisión» en Mi plan.
- [ ] En el panel `/admin`: el pago aparece con el correo, el monto esperado contra el pagado y el comprobante.
- [ ] **Aprobar:** en la app, Mi plan pasa a Premium con la fecha correcta.
- [ ] **Rechazar** otro pago con un motivo: la app muestra «Rechazado» y el motivo.
- [ ] Enviar dos veces la misma referencia: la app avisa que ya fue registrada.
- [ ] Panel > Códigos: generar uno de 10 días; canjearlo en Mi plan (se acepta en minúsculas y sin guiones) y los días se suman. Canjearlo otra vez falla.
- [ ] Panel > Usuarios: regalar días de Premium y sumar/restar días de prueba se reflejan en la app.
- [ ] Panel > Configuración: cambiar los días de prueba solo afecta a las cuentas **nuevas**.

## 5. Con la función apagada (como hoy)
Reinicia la API **sin** `SUBSCRIPTIONS_ENABLED=true` y deja al usuario en `free`:
- [ ] No hay avisos de plan ni «Mi plan» en Ajustes.
- [ ] Todo se puede usar: varias entidades, por cobrar y por pagar, categorías propias, estadísticas completas y Excel.

## 6. Legal
- [ ] Ajustes > Acerca de > «Términos, privacidad y reembolsos» abre el texto completo.
- [ ] En «Activar Premium», el enlace «Al pagar aceptas…» abre ese mismo texto.

## 7. Al terminar
```bash
npm run plan:set -- demo@mibiyuyo.test none
```
Detén la API y Expo. Si algo falla, anota la pantalla y el estado en el que estabas.
