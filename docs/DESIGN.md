# Mi Biyuyo · Guía de diseño

Fuente de verdad visual: `Mi Biyuyo · Prototipo.html` (29 pantallas, 390×844). Este documento resume lo necesario para que cualquier persona o IA reproduzca el diseño **sin abrir el HTML de 13 MB**. Las capturas de cada pantalla están en [`docs/screens/`](screens/).

> Regla de oro: toda la interfaz usa los tokens de `mi-biyuyo-app/src/contexts/ThemeContext.js` y los componentes de `mi-biyuyo-app/src/components/ui.js`. No se escriben colores ni tamaños sueltos en las pantallas.

## 1. Tokens

### Color (modo claro)

| Token | Valor | Uso |
|---|---|---|
| `page` | `#f4f7fb` | fondo de pantalla |
| `surface` | `#ffffff` | tarjetas, campos |
| `surfaceAlt` | `#f6f9f7` | filas de equivalencias |
| `text` | `#183127` | texto principal |
| `textSecondary` | `#5a6b61` | subtítulos, etiquetas |
| `muted` / `placeholder` | `#8a94a6` | placeholders |
| `border` | `#d8e3db` | borde de tarjetas y campos |
| `divider` | `#edf2ee` | separadores dentro de tarjetas |
| `chip` | `#eef2ef` | fondo de barras de progreso y chips inactivos |
| `segment` | `#e6ede8` | fondo de pestañas segmentadas |
| `disabled` | `#9fb3a6` | botones y toggles desactivados |
| `accent` | `#1f7a59` | botón principal, pestaña activa, FAB |
| `accentDark` | `#15533d` | tarjeta "Mi saldo" |
| `link` | `#245fd1` | enlaces y acciones de texto |

Cada tipo de movimiento tiene tres tonos (`strong` botones/bordes · `fg` texto e iconos · `soft` fondos):

| Tipo | strong | fg | soft |
|---|---|---|---|
| Ingreso | `#1f7a59` | `#0f5a3f` | `#e8f5ef` |
| Gasto | `#b8431a` | `#a83a12` | `#fdece4` |
| Por cobrar | `#245fd1` | `#1d4fb0` | `#e8f0fb` |
| Por pagar | `#4a3aa7` | `#4a3aa7` | `#f0edfb` |

Estados: `ok` (`#e8f5ef`/`#0f5a3f`) · `warn` (`#fff5de`/`#8a5a00`, borde `#f0d9a3`) · `danger` (`#ffe9e6`/`#a8342a`, borde `#e9a19a`) · `info` (`#ebf3ff`/`#245fd1`).
Gráficos: ingresos `#2a78d6`, gastos `#eb6834`.
Tipos de entidad: efectivo verde, banco azul, billetera digital violeta, otro ámbar (`colors.kind`).

El modo oscuro (`COLORS.dark`) es una derivación propia; el prototipo solo define modo claro.

### Tipografía
**Plus Jakarta Sans** (400, 500, 600, 700, 800) cargada con `expo-font`. Se usa siempre `<Txt>` / `<Input>` (mapean `fontWeight` → familia) y `fontVariant: tabular-nums` para cifras.
Tamaños usados: 10–11 (etiquetas menores) · 12 · 13 · 14 · 15 · 16 · 20 (título de detalle) · 22 (título de pantalla, 800, tracking −0.02em) · 26–36 (cifras grandes, 800).
Las pantallas de **acceso** usan la fuente del sistema (Roboto en Android), como en el prototipo.

### Forma
Radios: 10 (segmento/campo pequeño) · 12 (campos, iconos) · 14 (filas, botones secundarios) · 16 (tarjetas, botón principal) · 20 (tarjeta de saldo) · 24 (acceso) · 999 (chips y pastillas).
Tarjeta estándar: fondo `surface`, borde 1 px `border`, radio 16, padding 16. Alto mínimo táctil: 44 px. Botón principal: 52–54 px.

## 2. Componentes (`src/components/ui.js`)

| Componente | Patrón del prototipo |
|---|---|
| `Screen` / `Footer` | pantalla con scroll y barra inferior fija con el botón principal |
| `Header` | botón atrás 44×44 + título 20/800 |
| `Card`, `ListCard` | tarjeta y lista con divisores |
| `Tile` | cuadro de icono con fondo suave (40 px, radio 12) |
| `Pill` / `TonePill` | etiqueta redondeada 11/700 |
| `Chip`, `ChipRow` | selección única (activo = color del tipo, texto blanco) |
| `Segmented`, `DispTabs` | pestañas USD · VES BCV · VES Binance |
| `CcyOptions` | 3 tarjetas de moneda con tasa |
| `ConvRows` | equivalencias en las 3 monedas |
| `MovRow` | fila de movimiento (icono, título, subtítulo, monto) |
| `ProgressBar`, `AlertRow`, `Toast`, `Button`, `Field` | resto de piezas |

Iconos: `src/components/icons.js` (trazos SVG de 1 path, `viewBox 24`, `strokeWidth 1.8`). Las categorías guardan la **clave** del icono en la base de datos.

## 3. Reglas de negocio visibles en la UI

- Todo se almacena en **USD**. Cada movimiento recuerda la moneda en la que se registró: `usd`, `bcv` (VES a tasa BCV) o `bin` (VES a tasa Binance P2P). `amount_usd = monto / tasa`.
- **Mi saldo** = suma del saldo de todas las entidades. Saldo de entidad = saldo inicial + ingresos − gastos ± cobros/pagos ± transferencias.
- **Por cobrar / por pagar** solo mueven saldo si el dinero ya cambió de manos (`cash = true`). Cada abono descuenta el pendiente y puede registrarse en cualquier moneda.
- Una **transferencia** no es ingreso ni gasto; la comisión sale de la entidad de origen.
- Un gasto puede detallarse por **ítems**; si se asigna monto por ítem, la suma no puede superar el total.
- Formatos: `USD 1,387.80` (coma miles, punto decimal) y `VES 208.170,00` (punto miles, coma decimal).

## 4. Pantallas

| # | Captura | Pantalla en la app | Archivo |
|---|---|---|---|
| 1 | `01-inicio` | Inicio | `screens/main/HomeScreen.js` |
| 2 | `02-historial` | Historial | `HistoryScreen.js` |
| 3 | `03-ajustes` | Ajustes | `SettingsScreen.js` |
| 4 | `04-carga` | Pantalla de carga | `auth/SplashScreen.js` |
| 5–7 | `05-acceso`, `06-registro`, `07-recuperar-contrasena` | Acceso (3 modos) | `auth/AuthScreen.js` |
| 8 | `08-estadisticas` | Estadísticas | `StatsScreen.js` |
| 9–12 | `09…12-elegir-*` | Elegir categoría (por tipo) | `PickScreen.js` |
| 13–16 | `13…16-form-*` | Registrar movimiento (por tipo) | `MovementFormScreen.js` |
| 17 | `17-movimiento-guardado` | Movimiento guardado | `MovementSavedScreen.js` |
| 18–19 | `18-lista-por-cobrar`, `19-lista-por-pagar` | Lista de deudas | `DebtsScreen.js` |
| 20–21 | `20-detalle-por-pagar`, `21-detalle-por-cobrar` | Detalle de deuda | `DebtDetailScreen.js` |
| 22–23 | `22-registrar-cobro`, `23-registrar-pago` | Registrar abono | `PayScreen.js` |
| 24 | `24-entidades` | Entidades | `EntitiesScreen.js` |
| 25 | `25-entidad-detalle` | Detalle de entidad | `EntityDetailScreen.js` |
| 26 | `26-entidad-nueva` | Nueva / editar entidad | `EntityFormScreen.js` |
| 27 | `27-transferencia` | Transferencia | `TransferScreen.js` |
| 28–29 | `28-detalle-gasto`, `29-gasto-con-items` | Detalle de movimiento | `MovementDetailScreen.js` |

Además (no están en el prototipo, se añadieron con el mismo estilo): **Tasas de cambio** (`ExchangeRateScreen.js`) y **Mi perfil** (`ProfileScreen.js`).

Navegación: 5 pestañas (Inicio · Entidades · **Registrar** · Estadísticas · Ajustes). Historial y Deudas viven dentro del navegador de pestañas y conservan la barra inferior; el resto son pantallas de pila sin barra.

## 5. Datos y API

Base PostgreSQL (`mi-biyuyo-api`). Tablas nuevas/ampliadas: `entities`, `transfers`, `transaction_items`, y columnas `entity_id`, `cash`, `due_date`, `receipt_*` en `transactions`, `entity_id`/`rate` en `transaction_payments`, `code` en `categories`.

Endpoints usados por la app: `GET /api/ledger` (todo el estado), `POST/DELETE /api/transactions`, `POST /api/transactions/:id/payments`, `/api/entities`, `/api/transfers`, `/api/exchange-rates`.

## 6. Cómo verlo funcionando

```bash
# API (puerto 3001)
cd mi-biyuyo-api && npm run migrate && npm run seed && npm run seed:demo && npm start
# App (web para revisar, o Expo Go en el móvil)
cd mi-biyuyo-app && npx expo start --web
```
Usuario demo: `demo@mibiyuyo.test` / `Demo1234!` (mismos datos que el prototipo: saldo USD 1,387.80).
En un móvil físico, ajusta la IP de `API_BASE_URL` en `src/services/api/client.js`.

## 7. Qué entregar a otra IA para modificar el diseño

1. Este archivo y la carpeta `docs/screens/` (capturas), **no** el HTML de 13 MB.
2. La pantalla concreta a cambiar y su captura.
3. La restricción: cambiar solo `ThemeContext.js`, `ui.js` y la pantalla; no tocar la lógica de `utils/ledger.js` ni los servicios.
