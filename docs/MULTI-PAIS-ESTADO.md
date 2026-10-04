# Multi-país: estado actual y qué sigue (4 de octubre de 2026)

Resumen: el soporte multi-país está **terminado y probado en local**, pero vive aislado en la rama `multi-pais-api`. Desde entonces `develop` recibió cuatro mejoras nuevas y las dos ramas **ya no se pueden fusionar sin resolver conflictos**. Falta integrarlas, probar en el teléfono y publicar.

Documentos de referencia (están en la rama `multi-pais-api`; para leerlos: `git show multi-pais-api:docs/<archivo>`):

- `docs/MULTI-PAIS-PLAN.md`: plan original, decisiones y estado por fase.
- `docs/MULTI-PAIS-PENDIENTES.md`: pasos para publicar, pruebas en el teléfono, limitaciones.

## 1. Dónde está cada cosa

| Rama | Qué contiene | Estado |
|---|---|---|
| `main` | Producción actual | Sin multi-país. Incluye orden de entidades, VES por defecto, bloqueo por huella sin perder la pantalla |
| `develop` | `main` + 4 mejoras: detalle por categoría en Estadísticas, cuotas y vencimiento manual, deudas recurrentes (ocultas en el formulario), gastos planificados | Probado en local, **no publicado** |
| `multi-pais-api` | Multi-país completo (API + app + métodos de pago por país) + arreglo de `isDebt` | Probado en local, **no fusionado** |

`multi-pais-api` lleva 7 commits que `develop` no tiene; `develop` lleva 13 que `multi-pais-api` no tiene.

## 2. Qué incluye el multi-país (ya hecho)

- Elegir país al registrarse (se fija y no se puede cambiar). Venezuela sigue igual: USD, bolívares (BCV) y USDT con tasas.
- Colombia, México, Perú, Chile, Argentina, Ecuador, República Dominicana, España y Estados Unidos usan una sola moneda, sin tasas, equivalencias, campanita ni «Brecha».
- Formato de números y símbolo por país, umbral de saldo bajo por país, métodos de pago por país, guía de 4 pasos en una moneda.
- Pruebas hechas: API 25/25, formato de números 41/41, métodos de pago 108/108, y revisión visual en el navegador de Venezuela (sin cambios) y Colombia (una moneda).

## 3. Conflictos previstos al fusionar `multi-pais-api` en `develop`

Simulación (`git merge-tree`): conflictos de contenido en 6 archivos.

| Archivo | Motivo probable (por revisar al resolver) |
|---|---|
| `mi-biyuyo-api/database/migrate.js` | Ambas ramas agregan migraciones al final del archivo |
| `mi-biyuyo-api/src/controllers/transactionController.js` | `develop` agregó cuotas, recurrentes y `DEBT_TYPES`; multi-pais-api cambió la conversión por modo y la línea de `isDebt` |
| `mi-biyuyo-api/src/controllers/paymentController.js` | `develop` agregó la creación de la siguiente deuda recurrente; multi-pais-api usa el contexto de modo |
| `mi-biyuyo-app/App.js` | Nuevas rutas (categoría, planificados) frente a cambios del vigilante de tasas |
| `mi-biyuyo-app/src/screens/main/EntitiesScreen.js` | `develop` agregó el arrastre para ordenar; multi-pais-api adaptó la pantalla al modo |
| `mi-biyuyo-app/src/utils/ledger.js` | `develop` agregó cuotas, planificados y recurrentes; multi-pais-api agregó el perfil de país |

Otros archivos se combinaron solos pero **hay que revisarlos**: `MovementFormScreen`, `PayScreen`, `DebtDetailScreen`, `StatsScreen`, `TransferScreen`, `HelpCenterScreen`, `DataContext`, `ui.js`.

## 4. Riesgo principal: funciones nuevas en modo «una moneda»

Las cuatro mejoras de `develop` se construyeron pensando en USD / VES / USDT. Tras unirlas con multi-país hay que comprobar que funcionen para, por ejemplo, Colombia:

- **Cuotas:** la vista previa y el calendario usan `fx.money(ccy, …)` y `m.ccy`; en modo `single` la moneda interna es `usd` (alias de la moneda local). Revisar el monto por cuota y el formato.
- **Gastos planificados:** el selector de moneda del plan (`CCY_KEYS`) muestra USD / VES / USDT; en modo `single` debe ocultarse o mostrar solo la moneda local. Al registrar un plan, el prellenado usa la moneda guardada en el plan.
- **Detalle por categoría:** usa `DispTabs` y `disp`; en `single` el selector no se dibuja, comprobar que el total sale en la moneda local.
- **Recurrentes:** ocultos por ahora, pero la API de `develop` usa `convertToAll` con tasas; en modo `single` debe usar `convertFor`/`getUserCtx` como el resto de controladores.
- **API de planificados** (`/api/planned`) y **cuotas/recurrentes**: las monedas válidas son `USD`, `VES`, `BINANCE`; en `single` solo se acepta el alias `USD`.
- **Migraciones:** la de multi-país es la «v10» y las de esta sesión no están numeradas; se aplican todas con el mismo `migrate.js` (todo es idempotente), solo hay que mantener el orden al resolver el conflicto.

## 5. Plan recomendado

1. Crear una rama nueva desde `develop` (por ejemplo `integra-multi-pais`) para que `develop` quede intacta si algo sale mal.
2. Fusionar `multi-pais-api` en esa rama y resolver los 6 conflictos (sección 3), conservando la lógica de ambos lados.
3. Adaptar a modo `single` lo de la sección 4.
4. Probar en local con **dos usuarios**: Venezuela (demo) y uno de Colombia. Flujos mínimos: entidad, gasto, ingreso, por cobrar y por pagar con cuotas y abonos, transferencia, gasto planificado registrado, Estadísticas con detalle por categoría.
5. Fusionar a `develop`. Después, pruebas en el teléfono (lista de la sección 4 de `MULTI-PAIS-PENDIENTES.md`).
6. Revisar con alguien de cada país los nombres y campos de los métodos de pago.

## 6. Publicar en producción (cuando todo esté probado)

Estado de la BD de producción: tiene hasta `entities.sort_order` (migración aplicada el 3 de octubre de 2026).

Migraciones que faltan en producción (todas aditivas, no tocan datos existentes):

1. Cuotas: `transactions.installments`, `transactions.installment_days`.
2. Recurrentes: `transactions.recurring`, `transactions.recurrence_source`.
3. Gastos planificados: tablas `planned_expenses` y `planned_expense_items`.
4. Multi-país («v10»): `users.country`, `users.mode`, `users.base_currency`.

Orden: respaldo de la BD → `npm run migrate:prod` (usa `.env.production`) → fusionar a `main` → desplegar la API y reiniciarla → generar la app nueva. La API debe estar desplegada **antes** de que salga la app. Pendientes del servidor: las seis variables `EMAIL_*` y `NODE_ENV=production` en su `.env`.

## 7. Notas

- La opción «Repetir cada mes» está oculta (`SHOW_RECURRING = false` en `MovementFormScreen.js`); la API sigue soportándola.
- Idea pendiente, sin implementar: notificaciones locales a 3 y 1 día del vencimiento de las deudas (próxima cuota si tiene cuotas). Ver la propuesta en la conversación del 4 de octubre; no requiere servidor ni migraciones.
- Guía de trabajo local (rama `develop`, `.env` local, `migrate:prod`): [`DESARROLLO.md`](DESARROLLO.md).
- Limitaciones conocidas del multi-país: los avisos de tasas siguen siendo de Venezuela, las fechas van en día/mes/año para todos los países, y no hay pruebas automáticas en el repositorio.
