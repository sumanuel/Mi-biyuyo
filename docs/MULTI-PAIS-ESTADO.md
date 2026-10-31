# Multi-país: estado y plan de integración (30 de octubre de 2026)

Resumen: el soporte multi-país está **terminado y probado en local**, pero vive aislado en la rama `multi-pais-api` desde el 1 de octubre. `develop` recibió muchísimas mejoras desde entonces y las dos ramas **ya no se pueden unir de forma mecánica**: hay 12 archivos en conflicto y, sobre todo, funciones nuevas pensadas para tres monedas (USD, VES, USDT) que deben adaptarse al modo de una sola moneda. Este documento recoge el estado, el plan por fases y la forma de trabajar.

Documentos de referencia (están **solo** en la rama `multi-pais-api`; para leerlos: `git show multi-pais-api:docs/<archivo>`):

- `docs/MULTI-PAIS-PLAN.md`: plan original, decisiones de diseño y estado por fase.
- `docs/MULTI-PAIS-PENDIENTES.md`: pasos para publicar, pruebas en el teléfono, limitaciones.

## 1. Qué es el multi-país (ya hecho en `multi-pais-api`)

- Elegir país al registrarse. **Se fija y no se puede cambiar después.**
- **Venezuela** (modo `multi`) sigue igual: USD, bolívares (BCV) y USDT con tasas, equivalencias y avisos.
- **El resto de países** (modo `single`) usan **una sola moneda**: sin tasas, equivalencias, campanita ni «Brecha». En `multi-pais-api` están Colombia, México, Perú, Chile, Argentina, Ecuador, República Dominicana, España y Estados Unidos; el alcance nuevo es más amplio: 23 países en modo `single` más Venezuela (ver la sección 7).
- Formato de números y símbolo por país, umbral de saldo bajo por país, métodos de pago por país, guía de 4 pasos en una moneda.
- Compatible hacia atrás: si no llega `country`, se asume Venezuela. Una app nueva contra una API vieja (y al revés) funciona.
- **Diseño del modo `single`:** la moneda base del usuario se guarda en las columnas actuales (`amount_usd`, `currency = 'USD'` como alias interno) y `amount_ves` / `amount_binance` quedan en 0. En la app, la clave interna `usd` pasa a significar «moneda base». Así no se tocan los `CASE currency` ni el contrato de `/ledger`.
- **API:** `users.country`, `users.mode`, `users.base_currency` (migración «v10», solo agrega columnas con valor por defecto), `countries.js`, `userContext.js`, conversión por modo y rutas de `/exchange-rates` con 403 en modo `single`.
- **App:** selector de país en el registro, `countries.js`, `paymentMethods.js`, `money.js` con formato por país y los selectores/tarjetas de tasas ocultos en modo `single`.
- Pruebas hechas en su momento (scripts puntuales, no están en el repositorio): API 25/25, formato de números 41/41, métodos de pago 108/108 y revisión visual de Venezuela y Colombia.

## 2. Dónde está cada cosa hoy

| Rama | Qué contiene | Estado |
|---|---|---|
| `main` | Producción actual (versión 1.1.0 y lo posterior ya fusionado) | Sin multi-país |
| `develop` | Igual a `main` | Sin multi-país |
| `multi-pais-api` | Multi-país completo (API + app + métodos de pago por país) + documentos | Probado en local, **no fusionado**, desactualizado respecto a `develop` |

Distancia entre `multi-pais-api` y `develop` (base común: 1 de octubre):

- `multi-pais-api`: 7 commits y 39 archivos propios.
- `develop`: **62 commits** y 55 archivos propios.
- Simulación de fusión (`git merge-tree`, sin tocar nada): **12 archivos en conflicto**.
  - **API (4):** `database/migrate.js`, `authController.js`, `paymentController.js`, `transactionController.js`.
  - **App (8):** `App.js`, `AboutScreen.js`, `EntitiesScreen.js`, `HelpCenterScreen.js`, `HomeScreen.js`, `PayScreen.js`, `SettingsScreen.js`, `ledger.js`.
  - Otros archivos se combinan solos pero **hay que revisarlos** (`MovementFormScreen`, `MovementDetailScreen`, `DebtDetailScreen`, `StatsScreen`, `TransferScreen`, `DataContext`, `ui.js`, `entityController`).
- El arreglo de `isDebt` (edición de deudas: validaciones que nunca se ejecutaban) que llevaba esa rama **ya está en `develop` y `main`** (`DEBT_TYPES`). No queda nada urgente dentro de `multi-pais-api`.

## 3. Por qué no basta con resolver los conflictos

Lo construido desde el 1 de octubre asume tres monedas. Tras unir ambas ramas, cada una de estas funciones debe revisarse para el modo `single` (por ejemplo, Colombia):

| Función nueva en `develop` | Qué hay que adaptar en modo `single` |
|---|---|
| Moneda para mostrar los montos (Ajustes > Apariencia) y `defaultDisp` | Ocultar el selector; la única moneda es la base |
| Saldo grande de Inicio que sigue la moneda elegida y filas de otras monedas | Un solo valor, sin filas de BCV / Binance |
| Tarjetas del resumen (Ingresos, Gastos, Por cobrar, Por pagar) | Formato y símbolo por país |
| Exportar a Excel (columnas USD, VES, USDT, tasas en el Resumen) | Una sola columna de monto y sin tasas |
| Saldo tras cada movimiento (`trail`, usa `fx`) | Comprobar que sale en la moneda local |
| Cantidad, total y promedios de ítems, estimación por último precio | Montos en la moneda local |
| Cuotas, pago por cuotas, abonos, eliminar abonos | Selector de moneda del pago, formato |
| Gastos planificados | Selector de moneda del plan (`CCY_KEYS`) |
| Recurrentes (ocultos) y API de planificados | `convertToAll` con tasas → usar el contexto de modo; solo moneda `USD` alias |
| Detalle por categoría, Datos de la deuda, Mis categorías | Revisar textos y selectores de moneda |
| Acerca de («USD · VES · USDT»), Centro de ayuda, introducción | Variantes de texto por modo |

## 4. Forma de trabajo

- **El multi-país no se fusiona a `develop` ni a `main` hasta que todo esté hecho y se hayan hecho pruebas suficientes** (decisión del 31 de octubre de 2026). Se trabaja siempre en ramas propias, nunca directamente en `main` ni en `develop`; `--no-ff` al fusionar.
- **Rama base de la integración:** `integra-multi-pais`, creada desde `develop`. Cada fase puede tener su rama hija desde ella (por ejemplo `integra-multi-pais-api`, `integra-multi-pais-app`) y se borra al fusionarla.
- **Cada paso se prueba con la API local y la app con Expo antes de avanzar:**
  - API local con la base local: variables `DB_*`/`JWT_*` del primer bloque de `mi-biyuyo-api/.env.localdb.bak`, `DB_SSL=false`, `NODE_ENV=development`, `PORT=3011` y `EMAIL_*`/`SMTP_*` vacíos (`dotenv` no pisa variables ya definidas). Nunca confiar en `.env`: apunta a producción.
  - App web: `EXPO_PUBLIC_API_URL=http://localhost:3011/api npx expo start --web --port 8082`.
  - App en el teléfono (Expo Go): `.env.development.local` con la IP actual del PC (`ipconfig`), por ejemplo `http://192.168.1.6:3001/api`, y `npx expo start -c`.
  - Usuarios de prueba en la base local: Venezuela (`demo@mibiyuyo.test`) y uno de Colombia que se creará en la Fase 1.
- Los cambios de base de datos se prueban primero en la base **local**; en producción solo cuando se pida expresamente («corre la migración en producción»).
- **Las demás mejoras de la app siguen yendo a `develop` y `main` como hasta ahora.** Cada vez que `develop` cambie, se trae a la rama de integración (`git merge develop`) y se adapta lo nuevo al modo `single`. Las funciones nuevas se construyen ya pensando en el modo de una moneda.

## 5. Plan por fases

### Fase 1: API (se puede publicar sola) — hecha en local el 31 de octubre de 2026

Rama `integra-multi-pais` (desde la del documento). Probada con la API y la base **locales**: `npm run test:multipais` → 41 de 41.

- [x] Crear `integra-multi-pais`.
- [x] Traer `countries.js` (ahora con los 24 países), `userContext.js`, `currencyConverter.js` (`convertFor`, `toUsdFor`) y los cambios de controladores (auth, entidades, tasas, abonos, movimientos, transferencias).
- [x] Resolver los 4 conflictos de la API (`migrate.js`, `authController`, `paymentController`, `transactionController`) conservando la lógica de ambos lados (cuotas, recurrentes, cantidad de ítems, `DEBT_TYPES`).
- [x] Adaptar lo de `develop` al modo de una moneda: deudas recurrentes (`recurrence.js` usa el modo) y gastos planificados (en `single` solo vale la moneda base `USD`; `VES` y `BINANCE` → 422).
- [x] Migración «v10» (`users.country`, `users.mode`, `users.base_currency`) aplicada en la base **local**. **No** está en producción.
- [x] Script de pruebas `mi-biyuyo-api/tests/multi-pais.test.js` (sin dependencias): registro con y sin país y con país inexistente, `/auth/me`, país fijo, `/exchange-rates` (403 en `single`), entidades, gasto, ingreso y por cobrar con cuotas y abonos, eliminar abono, editar una deuda por debajo de lo abonado, recurrente que se renueva, transferencia con comisión, gastos planificados, ítems con cantidad y `/ledger`, en Colombia (`single`) y Venezuela (`multi`, con tasas). Se niega a correr contra producción (exige `env != production` y `DB_HOST` local) y borra sus usuarios de prueba.
- [x] La app actual (sin país) sigue funcionando contra esta API: el usuario demo existente queda como Venezuela, modo `multi`, con sus tasas.
- [ ] Pendiente de la fase: revisar si la app necesita el perfil del país dentro de la respuesta de `/ledger` (hoy lo recibe en el inicio de sesión y en `/auth/me`).

### Fase 2: App — hecha en local el 31 de octubre de 2026 (falta probar en el teléfono)

Rama `integra-multi-pais-app` (hija de `integra-multi-pais`). Probada en la web con la API y la base **locales**, con usuarios de Colombia, Portugal y Venezuela.

- [x] Aplicar el cambio de la app de `multi-pais-api` (selector de país con búsqueda en el registro, `countries.js`, `paymentMethods.js`, `money.js` por país, perfil en `AuthContext`, modo de una moneda) y resolver los 8 conflictos: `App.js`, `AboutScreen`, `EntitiesScreen`, `HelpCenterScreen`, `HomeScreen`, `PayScreen`, `SettingsScreen`, `ledger.js`.
- [x] 24 países en la app (iguales a los de la API) con símbolo, separadores, decimales (Chile y Paraguay sin decimales) y umbral de saldo bajo por país. Métodos de pago: los 10 originales + Brasil (Pix), Portugal (MB WAY), Costa Rica (SINPE Móvil) y Panamá (Yappy); el resto usa un conjunto genérico (cuenta bancaria y billetera móvil). Antes un país sin métodos propios caía en los de Venezuela.
- [x] Adaptado a una sola moneda lo nuevo de `develop`:
  - Moneda inicial de los formularios (Registrar, Pagar, Transferir, planes): la del país en vez de «VES · BCV».
  - Gastos planificados: sin selector de moneda.
  - Preferencia «Moneda para mostrar los montos»: oculta; `disp` siempre es la base (se ignora lo que haya guardado una cuenta de Venezuela en el mismo equipo).
  - Inicio: tarjetas del resumen con el monto completo (símbolo detrás en España y Portugal) y sin filas de otras monedas.
  - Excel: una sola columna de monto (`Monto (COP)`), decimales del país y sin tasas; el de Venezuela no cambió.
  - Decimales según el país al precargar pagos por cuotas, «Mitad», «Saldo total» y planes (antes fijos en 2).
  - Se quitaron las tarjetas vacías que dejaban las equivalencias en 3 monedas (detalle de deuda, de movimiento, de entidad, guardado, formulario de entidad).
  - Ayuda y «Acerca de» con textos por modo.
- [x] Probado en la web: Colombia (registrar gasto con `45.500,50`, saldo, deuda en 6 cuotas, pago por cuotas, Estadísticas, Ajustes sin tasas, Excel de una columna), Portugal (símbolo detrás), registro con selector de país y Venezuela (Inicio, formulario con selector de moneda, Ajustes con tasas, Excel con tres monedas) sin cambios.
- [x] `npm run check:countries` (app): 236 comprobaciones; países y monedas iguales a los de la API y formato y lectura de montos de los 24 países.
- [x] `database/seed_demo_single.js` (API): crea un usuario de prueba de cualquier país (`demo.<país>@mibiyuyo.test`, contraseña `Demo1234!`) con datos variados, solo en local.
- [ ] Pendiente: probar en el teléfono con Expo Go (teclado, formato al escribir, tarjetas del resumen con cifras largas) y revisar con Chile (sin decimales) y Paraguay en pantalla.
- [ ] Pendiente: traducir o adaptar textos de la introducción y la guía de primeros pasos para Portugal y Brasil (hoy todo en español, por decisión).

### Fase 3: Pruebas y publicación

- [ ] Lista de pruebas en el teléfono: registrar una cuenta de otro país (entidad, gasto, ingreso, por cobrar con abonos, transferencia con comisión, editar, Estadísticas, Excel, saldo tras cada movimiento), formato de números con el teclado del teléfono (`1.500.000,50`, `12,5`, `12.5`), sin USD / USDT / tasas / campanita.
- [ ] Revisar los métodos de pago de cada país con alguien de ese país.
- [ ] Solo cuando todo esté hecho y las pruebas sean suficientes: fusionar `integra-multi-pais` a `develop` y, cuando se pida, a `main`. **Antes de ese momento, ni `develop` ni `main` reciben nada del multi-país.**
- [ ] Producción (en este orden): **respaldo de la base** → migración (`npm run migrate:prod`, usa `.env.production`; verificar que apunta a `172.83.152.51` con `DB_SSL=true`) → fusionar a `main` → desplegar la API y reiniciarla → generar el APK. La API debe estar desplegada **antes** de que salga la app.
- [ ] Borrar `multi-pais-api` (local y GitHub) y las ramas de integración al terminar.

## 6. Estado de la base de producción

Migraciones **ya aplicadas** en producción: orden de entidades (`sort_order`), cuotas, recurrentes, gastos planificados, categorías ocultas y cantidad de ítems (`quantity`, con valor por defecto 1).

Falta solo la migración de **multi-país** («v10»): `users.country`, `users.mode`, `users.base_currency`. Es aditiva: los usuarios actuales quedan como Venezuela, modo `multi`.

## 7. Decisiones y alcance

**Países (decisión del 31 de octubre de 2026):** Sudamérica, Centroamérica, Estados Unidos, Portugal y España, y se **mantienen México y República Dominicana** de la lista original. Venezuela sigue en modo `multi`; los otros 23 en modo `single` (una moneda).

| Región | Países (moneda) |
|---|---|
| Sudamérica | Argentina (ARS), Bolivia (BOB), Brasil (BRL), Chile (CLP, sin decimales), Colombia (COP), Ecuador (USD), Guyana (GYD), Paraguay (PYG, sin decimales), Perú (PEN), Surinam (SRD), Uruguay (UYU) y **Venezuela (multi)** |
| Centroamérica | Belice (BZD), Costa Rica (CRC), El Salvador (USD), Guatemala (GTQ), Honduras (HNL), Nicaragua (NIO), Panamá (USD) |
| Norteamérica y Caribe | México (MXN), República Dominicana (DOP) |
| Otros | Estados Unidos (USD), Portugal (EUR), España (EUR) |

Otros países del Caribe (Cuba, Puerto Rico, Haití, etc.) quedan fuera por ahora.

**Idioma:** solo español por ahora, con moneda, símbolo y formato numérico por país. Portugal y Brasil verán los textos en español; la traducción al portugués se deja como etapa aparte (Guyana, Surinam y Belice tienen otros idiomas oficiales, mismo caso).

**Métodos de pago:** `paymentMethods.js` tiene los de los 10 países originales. Para los nuevos se usará un conjunto genérico (efectivo, banco, billetera digital) y se añadirán los propios de cada país después (por ejemplo, Pix en Brasil, MB WAY en Portugal, SINPE Móvil en Costa Rica, Yape en Perú).

**Integración:** el multi-país **no se integra a `develop` ni a `main` hasta que se hagan pruebas suficientes** (ver sección 4). Mientras tanto las demás mejoras siguen yendo a `develop` y `main`, y se sincronizan hacia la rama de integración.

**Otras decisiones vigentes:**

- Argentina con el uso cotidiano del dólar queda como limitación conocida (se evaluaría renombrar `amount_usd` a `amount_base`). Lo mismo aplica a otros países con uso habitual del dólar (Bolivia, Uruguay, Perú, etc.).
- **País fijo:** no se puede cambiar después de registrarse. Quien se mude, crea otra cuenta.
- Fechas en día/mes/año para todos los países.
- **Pruebas automáticas:** no hay en el repositorio. Conviene dejar, al menos, los scripts de la API por modo y de formato de números para que futuras fusiones sean más seguras. Como ahora son 24 países, también un script que compruebe el formato de moneda de cada uno (decimales, separadores, símbolo).

## 8. Pendientes del servidor y notas

- El `.env` del servidor debe tener `EMAIL_*` (o `SMTP_*`) y `NODE_ENV=production`; revisar `https://mi-biyuyo.system-meek.com/health?mail=check` después de desplegar.
- Los avisos y textos de las tasas (vigilante diario) siguen siendo de Venezuela; en modo `single` no se activan.
- La introducción previa al registro usa un texto neutro porque aún no se conoce el país.
- «Repetir cada mes» sigue oculto (`SHOW_RECURRING = false` en `MovementFormScreen.js`); la API lo soporta.
- Idea pendiente, sin implementar: notificaciones locales a 3 y 1 día del vencimiento de las deudas.
- Guía de trabajo local (`develop`, `.env` local, `migrate:prod`): [`DESARROLLO.md`](DESARROLLO.md).
