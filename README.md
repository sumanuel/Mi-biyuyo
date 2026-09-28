# Mi Biyuyo 💰

**Personal Finance Manager** — Full-stack mobile app para gestionar ingresos, gastos, préstamos y deudas con soporte multi-moneda (USD, Bs., Binance).

## 📦 Estructura del Proyecto

```
Mi-biyuyo/
├── mi-biyuyo-api/          # Backend: Express + PostgreSQL
│   ├── src/
│   │   ├── controllers/    # Lógica de negocio
│   │   ├── routes/         # Endpoints RESTful
│   │   ├── middleware/     # Auth, validación, error handling
│   │   ├── config/         # Configuración DB
│   │   └── utils/          # Conversión de monedas
│   ├── database/           # Migraciones y seeds
│   └── package.json
│
└── mi-biyuyo-app/          # Frontend: Expo SDK 57 React Native
    ├── src/
    │   ├── screens/        # Auth (login/register) + Main (dashboard, transacciones, etc.)
    │   ├── components/     # UI reutilizable (Card, ActionButton, etc.)
    │   ├── contexts/       # Auth, Theme, ExchangeRate
    │   ├── services/       # Llamadas API
    │   └── utils/          # Helpers (responsive, currency)
    ├── App.js              # Root: Stack + Bottom Tabs navigation
    └── package.json
```

## 🚀 Inicio Rápido

### Backend (Puerto 3001)

```bash
cd mi-biyuyo-api
npm install

# Crear y migrar BD PostgreSQL
node database/migrate.js
node database/seed.js

# Arranca el API
npm run dev
```

**Endpoints disponibles:**

- `/api/auth` — Login, register, forgot password
- `/api/categories` — CRUD categorías jerárquicas
- `/api/transactions` — CRUD transacciones + conversión 3 monedas
- `/api/transactions/:id/payments` — Abonos/pagos parciales
- `/api/exchange-rates` — Fetch externo (BCV/Binance) + manual
- `/api/stats` — Summary, by-category, trend 6 meses

### Frontend (Expo)

```bash
cd mi-biyuyo-app
npm install

# Inicia dev server
npm run start

# O directamente Android
npm run android
```

**Navegación:**

- **Auth**: Login → Register → Forgot Password
- **Main** (si autenticado):
  - `Dashboard` — Balance del mes, gráfica de tendencia, préstamos pendientes
  - `Transactions` — Historial agrupado por fecha, filtrable por tipo
  - `Categories` — Gestión de categorías personalizadas
  - `Profile` — Configuración de tema, logout

## 🛠️ Tecnologías

### Backend

- **Node.js + Express** — Servidor HTTP
- **PostgreSQL 14+** — Base de datos relacional
- **JWT** — Autenticación stateless
- **Validación** — express-validator
- **Manejo de errores** — Error handler centralizado

### Frontend

- **Expo SDK 57** — Framework React Native
- **React 19** — UI framework
- **React Navigation** — Stack + Bottom Tabs
- **AsyncStorage** — Persistencia local (token, usuario, tema)
- **Axios** — Cliente HTTP
- **react-native-chart-kit** — Gráficas de tendencia

## 💡 Características Principales

✅ **Multi-moneda**

- USD, VES (Bolívares), Binance (USDT)
- Conversión automática en todas las transacciones
- Tasas manuales o fetch externo (BCV + Binance P2P)

✅ **Categorías jerárquicas**

- 4 tipos: Ingresos, Gastos, Préstamos dados, Deudas
- 26 sub-categorías pre-cargadas
- Crear categorías personalizadas

✅ **Transacciones**

- Crear, editar, eliminar
- Descripción, categoría, contraparte, fecha, notas
- Préstamos/deudas con abonos parciales
- Auto-marca como "pagado" al completarse

✅ **Estadísticas**

- Balance mensual (USD + VES + Binance)
- Gráfica de tendencia 6 meses
- Desglose por categoría
- Lista de pendientes (préstamos/deudas activos)

✅ **UI/UX**

- Tema claro/oscuro (persiste localmente)
- Diseño responsivo + touch-friendly
- Empty states explícitos
- Animaciones suaves

## 📋 Requisitos Previos

- **Node.js 18+**
- **npm o yarn**
- **PostgreSQL 14+** (local con psql en PATH, o Docker)
- **Expo CLI** (`npm install -g expo-cli`)
- **Android SDK** (para compilar APK) o emulador
- **Git**

## 🔐 Seguridad

- JWT en headers (`Authorization: Bearer <token>`)
- Contraseñas hasheadas (bcrypt)
- Validación de entrada en todos los endpoints
- CORS configurado en el backend
- Manejo de errores que no expone detalles internos

## 📖 API Documentation

### Auth

**POST /auth/login**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
→ { "token": "jwt...", "user": {...} }
```

**POST /auth/register**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
→ { "token": "jwt...", "user": {...} }
```

### Transactions

**POST /transactions**

```json
{
  "category_id": 5,
  "amount": 100,
  "currency": "USD",
  "description": "Pago por servicios",
  "date": "2026-09-28",
  "counterpart_name": "Acme Corp"
}
→ { "id": "uuid", "amount_usd": 100, "amount_ves": ..., "amount_binance": ... }
```

**GET /transactions?type=expense&limit=30&offset=0**

```json
→ { "data": [...], "total": 125 }
```

## 🗂️ Estructura de la Base de Datos

| Tabla            | Descripción                                           |
| ---------------- | ----------------------------------------------------- |
| `users`          | Usuarios registrados (email, password_hash)           |
| `categories`     | Categorías jerárquicas (parent_id para subcategorías) |
| `transactions`   | Movimientos (3 monedas: usd, ves, binance)            |
| `payments`       | Abonos/pagos parciales de transacciones               |
| `exchange_rates` | Tasas de cambio (USD→VES, Binance→VES)                |

## 🐛 Troubleshooting

**"Error: EADDRINUSE: address already in use :::3001"**

- Cambiar puerto en `.env` o matar proceso: `lsof -ti :3001 | xargs kill -9`

**"Cannot find module '@expo/vector-icons'"**

- Ejecutar: `npx expo install @expo/vector-icons`

**"psql: command not found"**

- Agregar PostgreSQL `bin` al PATH o usar ruta completa:
  ```bash
  "C:\Program Files\PostgreSQL\14\bin\psql.exe" -U postgres -c "CREATE DATABASE mi_biyuyo;"
  ```

**"Bundle error: Module not found"**

- Ejecutar: `npx expo export --platform android` para diagnóstico completo

## 📝 Próximos Pasos

- [ ] Validación de email (confirm token)
- [ ] 2FA (Two-Factor Authentication)
- [ ] Export de datos (CSV/PDF)
- [ ] Notificaciones push (pending reminders)
- [ ] Sincronización en la nube (Firestore/Supabase)
- [ ] Calendario de transacciones
- [ ] Budget tracking y alertas
- [ ] Soporte para múltiples cuentas bancarias

## 📄 Licencia

MIT — Ver [LICENSE](mi-biyuyo-app/LICENSE)

## 👤 Autor

**Sumanuel** — [@sumanuel](https://github.com/sumanuel)

---

## 💬 Soporte

Para reportar bugs o sugerir features, abre un issue en:  
https://github.com/sumanuel/Mi-biyuyo/issues

¡Gracias por usar Mi Biyuyo! 🎉
