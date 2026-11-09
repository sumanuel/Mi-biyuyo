# Suscripción y pagos: plan de trabajo (2 de noviembre de 2026)

Estado: **solo plan, nada implementado.** Este documento recoge las decisiones tomadas, lo que se propone por defecto donde falta una decisión y las fases para construirlo. Se trabaja en ramas aparte; nada llega a `develop` ni a `main` sin pruebas, y la base de producción solo se toca cuando se ordena.

## 1. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Distribución | **APK directo** (sin tiendas por ahora) |
| Mercado | **Solo Venezuela** por ahora |
| Modelo | **Gratis + Premium**. Prueba gratis con todo el Premium; al terminar, el usuario pasa a Gratis salvo que pague |
| Precio (de prueba) | **2,50 USD al mes** y **20 USD al año**. Son valores de prueba: tienen que poder cambiarse sin redesplegar (tabla en la base, no en el código) |
| Días de prueba | **Los defines tú** en una tabla de configuración (`app_settings`) y puedes subirlos o bajarlos cuando quieras, sin redesplegar. Valor inicial: 14 días (ver §3.2 y §3.7) |
| Moneda de los precios | USD (la base de la app). Los pagos en bolívares se calculan con la tasa BCV del momento |
| Categorías propias | Si el usuario creó categorías propias, al acabar la prueba **ya no las puede usar** (los movimientos que ya registró se conservan) |

## 2. Qué incluye cada plan

### Gratis
- **1 entidad.**
- Registrar **ingresos y gastos**; ver Inicio, Historial y detalle de cada movimiento.
- **Estadísticas limitadas:** *Balance del período* (con sus ingresos y gastos), *Brecha Binance* (ahorro) y *Distribución del saldo*.
- Ajustes de apariencia, ocultar saldo, bloqueo con huella, ayuda, «Acerca de».
- Categorías **predeterminadas** de la app.
- Ajustar saldo de la entidad (es una corrección básica; ver §3.4).

### Premium (incluido durante la prueba)
- **Más de una entidad**, transferencias entre entidades, archivar y restaurar entidades.
- **Por cobrar y por pagar**, con abonos, cuotas, vencimientos y recurrentes.
- **Gastos planificados.**
- **Detalle de la compra** (ítems con cantidad y costo) y **recibos adjuntos**.
- **Categorías propias** (crear, editar y usar).
- **Estadísticas completas:** *Flujo del período*, *Gastos por categoría* (y su detalle), *Ingresos por fuente*, *Ítems más comprados* y *Por cobrar y por pagar*.
- **Exportar a Excel.**

> Los puntos en cursiva de «Estadísticas» salen de las secciones que existen hoy en `StatsScreen`. Los ítems, el recibo y archivar no estaban en tu lista; los puse en Premium por coherencia (ítems más comprados ya es Premium y archivar exige varias entidades). Se pueden mover a Gratis sin cambiar el diseño (ver §7).

## 3. Diseño

### 3.1 Estado del plan de un usuario
En `users` se agregan dos fechas:
- `trial_ends_at`: fin de la prueba gratis.
- `premium_until`: hasta cuándo tiene Premium pagado.

`trial_ends_at` se fija **una sola vez**, al empezar la prueba del usuario: `inicio + trial_days`, con `trial_days` leído de la tabla de configuración en ese momento (§3.7).

El plan **no se guarda como texto**, se calcula en el servidor cada vez:
- `premium`, si `premium_until` es futuro;
- `trial`, si `trial_ends_at` es futuro;
- `free`, en cualquier otro caso.

Así no hay un proceso que "venza" cuentas: basta comparar con la hora actual. Un pago nuevo suma al vencimiento actual, no lo reemplaza: `premium_until = max(ahora, premium_until) + duración` (30 días el mensual, 365 el anual).

### 3.2 Tablas nuevas
- `subscription_plans`: código (`monthly`, `annual`), precio en USD, días, activo. Se siembra con 2,50 y 20.
- `subscription_payments`: usuario, plan, monto en USD, método, referencia, monto pagado y moneda, tasa usada, comprobante (opcional), estado (`pending`, `approved`, `rejected`), motivo de rechazo, fechas de solicitud y revisión.
- `redeem_codes`: código único, plan o días que otorga, quién lo usó y cuándo, vencimiento del código.
- `app_settings`: configuración que tú ajustas sin tocar código, en filas `clave` / `valor` (con quién y cuándo la cambió). Se siembra con `trial_days = 14` (prueba de un usuario nuevo) y `trial_days_existing = 14` (prueba de los usuarios que ya existen al activar la función, §3.5). Más adelante admite otros parámetros sin migrar.
- `payment_receivers`: los datos de **tus** cuentas para cobrar (Pago Móvil, Binance Pay, Zinli, PayPal, etc.), editables sin redesplegar.

Se guarda el **precio y la tasa del momento** en cada pago, para que un cambio de precio futuro no afecte lo ya cobrado.

### 3.3 Quién manda: el servidor
Las reglas se aplican en la **API**; la app solo muestra candados y avisos. La API devuelve el estado del plan junto con `/ledger`, `/auth/me` y el inicio de sesión, así la app se actualiza con cada recarga.

Cuando un usuario Gratis intenta algo Premium, la API responde con un error `402` y un código `PLAN_REQUIRED` más la función que se pidió. La app lo recibe y abre la pantalla de planes.

**Se aplica en el servidor:**
- Crear una segunda entidad (con una activa ya hay tope).
- Crear transferencias.
- Crear por cobrar, por pagar y sus abonos; cuotas y recurrentes.
- Crear o editar gastos planificados.
- Crear categorías propias y **registrar movimientos con una categoría propia**.
- Registrar movimientos con ítems, o con recibo adjunto.
- Registrar movimientos en una entidad que quedó bloqueada (ver §3.4).
- Los endpoints de estadísticas que solo usan las secciones Premium (`/stats/by-category`, `/stats/trend`).

**Solo se aplica en la app** (el servidor no puede impedirlo porque se calcula en el teléfono con datos del propio usuario):
- Las secciones de Estadísticas.
- Exportar a Excel.

Es una limitación aceptada: quien manipule el APK podría ver esas dos cosas sin pagar, pero no podrá crear datos Premium.

### 3.4 Qué pasa al acabar la prueba (la parte delicada)
Principio: **nunca se borra ni se oculta información del usuario.** Se congela lo que excede el plan Gratis.

| Situación al vencer | Qué ocurre |
|---|---|
| Tiene más de 1 entidad | Sigue **viendo todas** y todas suman a Mi saldo. La **primera** (según su orden) queda activa; las demás pasan a *solo lectura*: se ven y se consultan, pero no reciben movimientos. Si paga, vuelven a la normalidad |
| Tiene por cobrar o por pagar | Se **ven** (lista, detalle, historial de abonos), pero no se pueden registrar nuevos abonos ni deudas |
| Tiene gastos planificados | Se ven; no se crean ni usan |
| Creó categorías propias | No se pueden elegir al registrar. Los movimientos antiguos siguen mostrándola. Si paga, vuelven a estar disponibles |
| Tiene movimientos con ítems o recibos | Se siguen viendo; no se agregan nuevos |
| Estadísticas y Excel | Solo las secciones y la exportación Gratis |

Ajustar saldo queda en Gratis porque es una corrección, no una función extra, y archivar una entidad ya requiere Premium porque en Gratis hay una sola.

### 3.5 Usuarios que ya existen
Hoy todos tienen todo gratis. Propuesta: al activar la función, cada usuario existente recibe una prueba de `trial_days_existing` días (por defecto la misma que un usuario nuevo), contada desde **la primera vez que el usuario entra después de activar la función** (se concede al calcular su plan por primera vez; no hay que correr ningún proceso masivo), con un aviso claro en la app y por correo. Los usuarios nuevos reciben la prueba al verificar su correo.

### 3.6 Interruptor general
Una variable `SUBSCRIPTIONS_ENABLED`. Apagada, la API trata a todos como Premium y la app no muestra planes: es lo que permite desplegar el código **sin cambiar nada para los usuarios** y encender el cobro cuando todo esté probado.

### 3.7 Días de prueba ajustables
Los días de prueba viven en la tabla `app_settings`, no en el código:

| Clave | Para quién | Valor inicial |
|---|---|---|
| `trial_days` | Usuarios nuevos, al verificar su correo | 14 |
| `trial_days_existing` | Usuarios que ya existen, una sola vez al activar la función | 14 |

- **Cómo se cambia:** desde la página de administración (§4), con validación (entero entre 0 y 365; **0 = sin prueba**: el usuario nuevo entra directo en Gratis). Si la página no estuviera disponible, también se puede editar la fila a mano en la base.
- **Qué afecta el cambio:** **solo a los usuarios que empiecen la prueba después**. Quien ya está en prueba conserva su fecha de fin (`trial_ends_at`) para que nadie vea que su plazo cambia de un día para otro. El valor usado queda guardado en el usuario (`trial_days_granted`), así se sabe qué prueba recibió cada uno.
- **Para quien ya está en prueba:** en la misma página hay dos acciones aparte, con confirmación: *regalar o quitar días a un usuario* (por correo) y *ajustar la prueba de todos los que están en prueba ahora* (suma o resta N días a su `trial_ends_at`, sin pasar de hoy hacia atrás). Así puedes extender una prueba o cortarla de forma deliberada.
- **Visible para el usuario:** el banner de Inicio y «Mi plan» leen `trial_ends_at`, así que muestran los días restantes reales sin importar cuántos días se hayan configurado.

## 4. Cómo se paga (APK, Venezuela)

No hay tienda ni pasarela automática, así que el pago es **semiautomático con comprobación humana**:

1. En **Ajustes > Mi plan** el usuario elige mensual o anual y un método.
2. La app muestra **tus datos de pago** (de `payment_receivers`) y el **monto exacto**: en USD para Binance Pay, Zinli o PayPal; en bolívares (precio × tasa BCV del momento) para Pago Móvil.
3. El usuario toca **«Ya pagué»** e indica referencia, fecha y monto, con captura opcional. Se crea un pago en estado `pending`.
4. Tú lo revisas y lo **apruebas o rechazas** (con motivo). Al aprobar, se extiende `premium_until` y la app muestra "Plan Premium hasta el …". El usuario recibe un correo de confirmación.
5. Alternativa: **código de canje**. Tú generas un código; el usuario lo pega en Mi plan y se activa al momento. Sirve para pagos hechos fuera de la app, regalos y pruebas tuyas.

### Cómo apruebas los pagos
Se propone una **página de administración mínima**, servida por la propia API y protegida con una clave (`ADMIN_KEY`) y límite de intentos:
- ver pagos pendientes con su comprobante, aprobar o rechazar;
- generar códigos de canje;
- regalar días a un usuario por su correo;
- cambiar precios y los datos de cobro;
- **cambiar los días de prueba** (`trial_days`, `trial_days_existing`) y, si se quiere, ajustar la prueba de quienes ya están en prueba (§3.7).

Se prefiere a un script en terminal porque estos scripts se conectan directo a la base de producción, y esa conexión depende de tu IP (hoy mismo la migración está detenida por eso). La página usa la conexión que la API ya tiene desde el servidor.

## 5. Fases

Cada fase se trabaja en su rama, se prueba en local (API local + base local + Expo) y se fusiona solo cuando lo pidas.

### Fase 0: decisiones pendientes (§7)
- [ ] Confirmar el valor inicial de los días de prueba (hoy 14; luego lo ajustas tú, §3.7) y los demás puntos de §7.

### Fase 1: API (modelo y reglas)
- [x] Migración: `users.trial_ends_at` y `premium_until`; tablas `subscription_plans`, `subscription_payments`, `redeem_codes`, `payment_receivers` y `app_settings`; siembra de los dos planes y de `trial_days` / `trial_days_existing`; columna `users.trial_days_granted`.
- [x] Utilidad que calcula el plan de un usuario y la lista de funciones permitidas.
- [x] Prueba gratis al verificar el correo, con los días leídos de `app_settings` (0 = sin prueba); interruptor `SUBSCRIPTIONS_ENABLED`.
- [x] Estado del plan dentro de `/ledger`, `/auth/me` y el inicio de sesión; `GET /api/subscription`.
- [x] Aplicar las reglas de §3.3 en entidades, transferencias, deudas, abonos, planificados, categorías, movimientos (categoría propia, ítems, recibo) y estadísticas, con error `402 PLAN_REQUIRED`.
- [x] Reglas de §3.4 (entidades bloqueadas, categorías propias fuera de uso).
- [x] Pruebas automáticas (`npm run test:suscripcion`) con usuarios en cada estado: prueba, premium, vencido, y fechas movidas a mano.

### Fase 2: app
- [ ] Contexto del plan en `DataContext` y utilidad `can("función")`.
- [ ] Pantalla **Mi plan** (Ajustes): plan actual, días de prueba restantes, qué incluye cada plan, precios.
- [ ] Pantalla de **planes / paywall** que se abre al tocar algo Premium o al recibir `PLAN_REQUIRED`.
- [ ] Candados en las entradas Premium (por cobrar, por pagar, transferir, planificados, categorías propias, exportar).
- [ ] Estadísticas limitadas (solo las tres secciones Gratis) con las demás bloqueadas.
- [ ] Entidades bloqueadas en solo lectura; categorías propias fuera del selector.
- [ ] Banner de prueba en Inicio («Te quedan N días») y aviso al vencer.
- [ ] Textos de ayuda y «Acerca de».

### Fase 3: pagos
- [x] Endpoints y pantalla para **solicitar pago** (método, referencia, monto, captura) y ver su estado.
- [x] **Códigos de canje.**
- [x] **Página de administración** con `ADMIN_KEY`: pagos pendientes, aprobar o rechazar, códigos, regalar días, precios, datos de cobro y **días de prueba** (con sus validaciones y las acciones sobre quienes ya están en prueba).
- [x] Correos: pago recibido, aprobado, rechazado y aviso de vencimiento próximo.
- [x] Pruebas del flujo completo y de seguridad (un usuario no ve pagos de otro, la página admin rechaza sin clave, un código no se usa dos veces).

### Fase 4: pruebas y publicación
- [ ] Matriz de pruebas por estado (§6) en el teléfono con Expo Go. *Lista en `docs/SUSCRIPCION-PRUEBAS.md`; falta correrla en el teléfono.*
- [x] Probar el vencimiento moviendo fechas en la base local (automatizado en `npm run test:pagos` y `npm run plan:set` para probar a mano).
- [ ] Publicar (manual completo en `docs/SUSCRIPCION-PUBLICACION.md`) en este orden, **solo cuando lo ordenes**: respaldo → `migrate:prod` → desplegar la API con `SUBSCRIPTIONS_ENABLED=false` → compilar el APK → verificar → encender la función y avisar a los usuarios.
- [x] Términos de uso y política de reembolsos escritos antes de cobrar (borrador en la app y en `docs/TERMINOS-Y-REEMBOLSOS.md`; **falta tu revisión**).

### Fase 5: más adelante (no ahora)
- Automatizar la conciliación (Binance Pay u otra API) para no aprobar a mano.
- Google Play y App Store con RevenueCat cuando se publique en tiendas (esas tiendas exigen su propio cobro dentro de la app).
- Precios y métodos por país cuando se integre multi-país.

## 6. Pruebas previstas
Para cada plan (**prueba, premium, vencido**) comprobar en API y en app:
- crear la 2.ª entidad, transferir, crear por cobrar y por pagar, abonar, planificar, crear y usar categoría propia, registrar con ítems y con recibo, ver cada sección de Estadísticas, exportar a Excel;
- paso de premium a vencido: entidades en solo lectura, deudas visibles pero bloqueadas, categorías propias fuera del selector, nada borrado;
- paso de vencido a premium (pago o código): todo vuelve;
- pago: solicitud, aprobación, rechazo, doble aprobación, código usado dos veces, pago de un usuario que ya tiene Premium (suma, no reemplaza);
- **días de prueba ajustables:** cambiar `trial_days` (subir, bajar, 0) y comprobar que un usuario nuevo recibe exactamente esos días, que quien ya estaba en prueba no cambia, que valores inválidos (negativos, texto, más de 365) se rechazan, y que las acciones de regalar/quitar días mueven `trial_ends_at` como se espera;
- con `SUBSCRIPTIONS_ENABLED=false`: todo funciona como hoy.

## 7. Puntos abiertos (con lo que haré si no se dice otra cosa)

| Punto | Propuesta por defecto |
|---|---|
| Duración de la prueba | **14 días** de valor inicial; la defines tú en `app_settings` (§3.7). Un valor para nuevos y otro para existentes |
| Efecto de cambiar los días | Solo a quienes empiecen la prueba después; para los que ya están en prueba hay acciones aparte y con confirmación |
| Prueba para usuarios existentes | La misma que a nuevos, desde el día de activación |
| Ítems del detalle de compra y recibos | Premium |
| Ajustar saldo | Gratis |
| Entidad que queda activa al vencer | La primera de su orden |
| Mensual y anual | 30 y 365 días; anual = 20 USD (equivale a casi 4 meses gratis frente a pagar mensual) |
| Métodos de pago a ofrecer primero | Pago Móvil (en bolívares), Binance Pay / USDT y Zinli o PayPal, según cuáles uses |
| Vigencia de la tasa en un pago en bolívares | La tasa del momento de la solicitud, válida 24 horas |

## 8. Riesgos y cosas a vigilar

- **Reglas solo en la app** (Estadísticas y Excel): aceptado, ver §3.3.
- **Pruebas repetidas con correos nuevos:** se limita a cuentas con correo verificado; si se vuelve un problema, se añade control por dispositivo.
- **Pagos falsos o comprobantes dudosos:** se aprueba a mano; guardar referencia y captura; revisar duplicados de referencia.
- **Tasa BCV desactualizada:** el monto en bolívares se fija al solicitar y se muestra con su hora.
- **Usuarios molestos por la congelación:** por eso nada se borra y el paso a Gratis es reversible pagando.
- **Cambio de precios:** cada pago guarda el precio y la tasa del momento.
- **Dependencia de la base de producción para administrar:** por eso la página de administración va dentro de la API.
- **Migraciones en producción:** solo cuando lo ordenes. Las de ajustes de saldo y archivado ya se aplicaron; esta función añadirá nuevas (incluida `app_settings`).
- **Cambiar los días de prueba a mitad de camino:** puede sentirse injusto si baja el plazo de alguien que ya estaba en prueba; por eso el cambio solo aplica a pruebas nuevas y ajustar las existentes es una acción explícita.
- **Cumplimiento:** términos, privacidad y recibos; revisar con quien corresponda antes de cobrar.

## 9. Relación con otros trabajos

- **Multi-país:** ahora los precios son en USD para Venezuela. Con otros países habrá que definir precio y método por país (Fase 5).
- **Ramas:** cada fase en su propia rama desde `develop`, probando con la API y la base locales (el cargador por rama ya usa la base local fuera de `develop` y `main`).
