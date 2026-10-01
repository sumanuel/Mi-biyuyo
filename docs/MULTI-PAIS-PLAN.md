# Plan: Mi Biyuyo multi-país (Venezuela tal como está + otros países con una sola moneda)

> Copia del plan aprobado, guardada en el repositorio. Los pasos para publicar y las pruebas pendientes están en [`MULTI-PAIS-PENDIENTES.md`](MULTI-PAIS-PENDIENTES.md).

## Estado de avance (1 de octubre de 2026)

Todo el trabajo está en la rama `multi-pais-api` (sin fusionar a `main`). La migración v10 solo se aplicó en la base **local**, no en producción.

| Fase | Estado | Notas |
|---|---|---|
| 0 — Arreglos previos | Hecha | `isDebt` corregido (`loan_given`/`debt`), upsert de tasas |
| 1 — Base de datos y API | Hecha | Migración v10, país/modo en auth, modo single sin tasas. 25 pruebas de API pasan (Colombia y Venezuela) |
| 2 — Capa de perfil en la app | Hecha | Formato por país, ocultar equivalencias/tasas en modo single, guía de 4 pasos, umbral por país. 41 pruebas de formato pasan |
| 3 — Registro y experiencia | Hecha, con una excepción | Selector de país y perfil listos. **Falta** `seed_demo.js` con variantes de CO/MX |
| 4 — Pruebas y despliegue | Parcial | Hubo scripts puntuales, pero no hay pruebas automáticas en el repositorio. **Falta** probar en teléfono y desplegar |
| Extra — Métodos de pago por país | Hecha | `src/config/paymentMethods.js`; 108 comprobaciones pasan. Revisar nombres y campos con gente de cada país |

---

## Contexto

Hoy la app y la API asumen la economía venezolana: USD como base, equivalencia en VES (tasa BCV) y USDT (Binance P2P), tasas por usuario y avisos diarios de tasa. Se quiere:

1. Elegir el **país** (se fija al registrarse) y mostrar la **moneda de ese país**.
2. **Venezuela** sigue exactamente igual (3 monedas, tasas, avisos).
3. **Otro país**: una sola moneda local, sin equivalencias en USD/USDT y sin tasas.
4. Decidir si conviene **otra app** o **ampliar esta**.

Decisiones ya tomadas con el usuario: lista corta de países (LatAm + España + EE. UU.), el país **no se puede cambiar** después de registrarse, y solo español con **formato numérico por país**.

## Recomendación: modificar esta app (una sola base de código), no clonarla

| Criterio | Una app con "perfil de país" | App nueva (clon) |
|---|---|---|
| Mantenimiento | Un solo código: cada arreglo sirve a todos | Dos códigos que divergen; cada bug se arregla dos veces |
| Tiendas / builds | 1 ficha, 1 build | 2 fichas, 2 pipelines, 2 servidores o 2 despliegues |
| Esfuerzo | Medio: el formato y la moneda están concentrados en pocos módulos | Alto al inicio y creciente |
| Riesgo para Venezuela | Controlable: el modo "multi" no cambia | Ninguno, pero se duplica todo |
| Cuándo clonar | Solo si se quiere otra marca, otro público o un modelo de negocio distinto | — |

Los hallazgos del código respaldan esto: el acoplamiento está en ~30 de 59 archivos, pero el núcleo duro son ~8 (`money.js`, `ledger.js`, `ExchangeRateContext`, `rateWatcher`, `MovementForm`, `Pay`, `Transfer`, `EntityForm`). Es un cambio grande pero acotado, no una reescritura.

## Diseño elegido (el de menor costo y riesgo)

- **Un "perfil de país"** por usuario: `country` (ISO), `mode` (`multi` = Venezuela, `single` = resto), moneda, símbolo, decimales, separadores y valores por defecto (umbral de saldo bajo y su paso).
- **Modo single reutiliza el modelo actual con un alias**: la moneda base del usuario se guarda en las columnas existentes (`amount_usd`, `currency='USD'`) como "monto en moneda base", con `amount_ves`/`amount_binance` en 0 y sin tasas. Así no se cambian los `CASE currency` de `paymentController`/`transactionController`, ni el contrato de `/ledger`. En la app, la clave interna `usd` pasa a significar "moneda base" y solo se muestra esa.
- **Compatibilidad hacia atrás**: los usuarios y apps actuales no cambian (por defecto `VE`/`multi`). Una app nueva contra una API vieja también funciona (si no llega `country`, se asume Venezuela).
- Si más adelante hace falta un modo con dos monedas (p. ej. Argentina con dólar), se evalúa renombrar las columnas a `amount_base`; no es necesario ahora.

Países iniciales (archivo compartido `countries` en API y app): VE (multi), CO (COP), MX (MXN), PE (PEN), CL (CLP, 0 decimales), AR (ARS), EC (USD), DO (DOP), ES (EUR), US (USD).

## Fases

### Fase 0 — Arreglos previos (afectan a producción hoy)
- `transactionController.update` (`mi-biyuyo-api/src/controllers/transactionController.js`, ~L250): `isDebt` compara `category_type` con `"cobrar"/"pagar"`, pero la base guarda `loan_given`/`debt` (ver `TYPE_FROM_DB` en `ledger.js`). Resultado: las validaciones del servidor al editar deudas (no cambiar moneda con abonos, no bajar del monto abonado, recalcular estado pagada/activa) **nunca se ejecutan**. Corregir a `['loan_given','debt']`.
- `exchangeRateController.update/fetch`: usar upsert si el usuario no tiene fila.
- Ignorar `statsController` (no lo usa la app; la suma de pendientes podría duplicar con varios abonos).

### Fase 1 — Base de datos y API
- Migración v10: `users.country` (default `'VE'`), `users.mode` (default `'multi'`), `users.base_currency` (default `'USD'`); backfill de usuarios existentes.
- `register` acepta y valida `country` contra la lista; devuelve `country/mode/base_currency` en register, login, verify-email y `me`. `updateProfile` **no** permite cambiarlos.
- `currencyConverter.js`: en modo single, `convertToAll` devuelve el monto como base (sin tasas ni errores 422).
- `transaction`/`payment`/`transfer`/`entity` controllers: leer el modo del usuario; en single no pedir tasas, aceptar solo la moneda base (`entityController` hoy fuerza `ves` si no es `usd`/`usdt`: corregir).
- `exchangeRateController`: en single responder 403/204 y no crear fila de tasas en `register`.
- Mensajes de correo: mantener marca, sin menciones a Venezuela.

### Fase 2 — Capa de perfil en la app
- Nuevo `src/config/countries.js` (mismo contenido que el de la API) y `src/contexts/` o dentro de `AuthContext`: exponer `profile` (país, modo, símbolo, decimales, separadores).
- `src/utils/money.js`: `makeFx(rates, profile)`; `money()` formatea según el perfil; `grp`, `parseNum`, `fmtIn` y `maskMoney` por país (hoy `parseNum` falla con "1.234,56" y los separadores están fijos en ~9 pantallas). `CCY_KEYS` depende del modo.
- `src/utils/ledger.js` (`buildModel`): en single, `val` usa solo la base; ocultar `dayRateTxt`/brecha; saldo y deudas sin conversión de tasas.
- `src/components/ui.js`: `DispTabs`, `CcyOptions` y `ConvRows` no se dibujan en modo single (o devuelven `null`).
- Pantallas (patrón repetido): ocultar selector de moneda y equivalencias en `Home` (tarjetas BCV/Binance/tasas), `Entities`, `EntityDetail`, `EntityForm` (moneda única), `MovementForm`, `MovementDetail/Saved`, `Pay`, `Transfer`, `Stats` (sin "brecha"), `History`, `Items`, `Debts/DebtDetail`.
- Tasas y avisos: en single no montar `ExchangeRateProvider` real, `DailyRateWatcher`, `RateNotificationsProvider` ni la tarea en segundo plano; ocultar la campanita de tasas y las filas de Ajustes. `GuideContext`: el paso "tasas" no existe en single (guía de 4 pasos).
- Umbral de saldo bajo por país (hoy "USD 50", pasos de 10): valor y paso desde el perfil (p. ej. COP 50.000, paso 10.000).
- Textos: `HelpCenterScreen`, `GettingStartedScreen`, `OnboardingScreen`, `AboutScreen` con variantes por modo (helper pequeño `copy(mode)`); sin infraestructura de i18n completa porque solo es español.

### Fase 3 — Registro y experiencia
- `AuthScreen` (modo registro): selector de país con búsqueda, vista previa «Tu moneda: Peso colombiano (COP, $)» y aviso de que no se puede cambiar después.
- Mostrar el país y la moneda en `Perfil` (solo lectura).
- `seed_demo.js`: variantes para CO/MX para pruebas.

### Fase 4 — Pruebas y despliegue
- Pruebas unitarias de formato (`money`, `parseNum`, redondeo por país) y de la API por modo.
- Orden de despliegue: migración v10 → API → app. Es retrocompatible, no hay corte.

## Riesgos principales
1. `buildModel`/`val {usd,bcv,bin}` y todo el cálculo de saldos, deudas y estadísticas (se mitiga tratando `usd` como base).
2. `originalRates` y `update` en `transactionController` (reconstruyen tasas del día; con tasa 1 o ceros se rompe la división).
3. Vocabularios distintos: movimientos usan `usd/bcv/bin`, entidades `usd/ves/usdt` (`ENT_CCY`).
4. Formularios con lógica densa (`MovementForm`, `Pay`, `Transfer`, `EntityForm`).
5. Textos de Venezuela dispersos en ayuda, onboarding y "Acerca de".

## Verificación
- **Regresión Venezuela**: usuario demo (`demo@mibiyuyo.test`) en navegador y teléfono: saldo, movimientos, edición, deudas, transferencias, estadísticas y avisos iguales a hoy (USD 1,387.80 de base).
- **Modo single**: registrar usuarios de CO, MX y CL; crear entidades, ingresos, gastos, deuda con abonos, transferencia con comisión; comprobar que no aparecen USD/USDT/tasas/campanita, que los decimales (CLP 0) y separadores son correctos y que el saldo cuadra.
- **API**: `curl` por modo (crear movimiento sin tasas en single, 403 en `/exchange-rates` en single, `PUT /profile` rechaza cambiar país).
- **Compatibilidad**: app nueva contra API sin migrar y app vieja contra API nueva.
- Fase 0: editar una deuda con abonos y comprobar que el servidor rechaza bajar el monto o cambiar la moneda.
