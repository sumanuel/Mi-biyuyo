# Multi-país: estado y pendientes para publicar

Estado a 1 de octubre de 2026. Mi Biyuyo pasa de ser solo para Venezuela a elegir país al registrarse:
Venezuela sigue igual (USD, bolívares y USDT con tasas) y el resto de países usa **una sola moneda**, sin tasas ni equivalencias.

## 1. Dónde está cada cosa

Todo el trabajo está en la rama **`multi-pais-api`** (integración). **`main` no se ha tocado** y sigue en `b8ce66f`.

| Rama | Contenido | Estado |
|---|---|---|
| `multi-pais-api` | API (país, modo, arreglos de deudas) + app (selector de país, modo una moneda) + métodos de pago por país | Subida a GitHub, **sin fusionar a `main`** |
| `multi-pais-app` | App multi-país | Ya incluida en `multi-pais-api`; se puede borrar |
| `metodos-pago-pais` | Métodos de pago por país | Ya incluida en `multi-pais-api`; se puede borrar |

Plan completo (fases y decisiones): `C:\Users\user\.claude\plans\clever-leaping-nebula.md`.

## 2. Qué cambia

- **API:** `users.country`, `users.mode` (`multi` = Venezuela, `single` = resto), `users.base_currency` (migración v10). El país no se puede cambiar después. En modo `single` no hay tasas: las rutas de `/exchange-rates` responden 403 y los montos se guardan en las columnas actuales (`amount_usd`) como "moneda base" (`currency = 'USD'` es un alias interno).
- **App:** selector de país en el registro, formato de números y símbolo por país, y en modo `single` se ocultan selector USD/VES/USDT, equivalencias, tarjetas de tasas, campanita, "Tasas de cambio" y "Brecha Binance".
- **Métodos de pago por país** (`mi-biyuyo-app/src/config/paymentMethods.js`): la API sigue guardando solo el código (`pm`, `acct`, `email`, `id`, `none`); cada país les pone nombre y campos.
- **Arreglo en producción incluido (Fase 0):** al editar una deuda, el servidor nunca ejecutaba sus validaciones (no bajar del monto abonado, no cambiar de moneda con abonos, recalcular si queda pagada). Comparaba tipos de categoría que no existen en la base (`cobrar`/`pagar` en vez de `loan_given`/`debt`).

Países: Venezuela (multi), Colombia, México, Perú, Chile, Argentina, Ecuador, República Dominicana, España y Estados Unidos (single). Compatible hacia atrás: sin `country` se asume Venezuela.

## 3. Pasos para publicar (en este orden)

1. **Probar en el teléfono** (ver la lista de la sección 4).
2. **Respaldar la base de producción** y **correr la migración v10** en ella. Hoy solo está en la base local.
   - La migración solo agrega columnas con valor por defecto (los usuarios actuales quedan como Venezuela, modo `multi`).
   - Verifica el servidor antes de correrla: el `.env` de `mi-biyuyo-api` debe apuntar a `172.83.152.51` con `DB_SSL=true`.
   - `cd mi-biyuyo-api && node database/migrate.js` (idempotente).
3. **Fusionar `multi-pais-api` a `main`** (un solo paso: ya incluye las demás) y subir.
4. **Desplegar la API** en el servidor y reiniciarla.
5. **Compilar la app nueva** (APK o build). La URL de la API viaja en `eas.json` (`EXPO_PUBLIC_API_URL`).

Orden de despliegue: base de datos → API → app. La API nueva funciona con la app anterior.

## 4. Pruebas pendientes en el teléfono

- Registrar una cuenta de **otro país** (por ejemplo Colombia): entidad con saldo, gasto, ingreso, deuda por cobrar con abonos, transferencia con comisión, editar un movimiento y Estadísticas.
- Comprobar que no aparecen USD, USDT, tasas ni campanita, y que los montos tienen el formato del país (por ejemplo `$ 1.234.567,50`).
- Escribir montos con el teclado del teléfono (`1.500.000,50`, `12,5`, `12.5`) y ver que se leen bien.
- **Venezuela:** entrar con una cuenta existente y comprobar que todo sigue igual (saldo, tasas, avisos, entidades con Pago Móvil).
- Revisar los **métodos de pago** de cada país (nombres y campos) con alguien de ese país.
- Pendientes de pruebas anteriores que solo se ven en el teléfono: teclado que no tapa los campos en "Nueva entidad", huella digital, arrastrar categorías, 3 columnas en Registrar, y el icono y la pantalla de inicio (requieren compilación).

## 5. Pendientes del servidor (de entregas anteriores)

- [ ] Desplegar la API con el código nuevo y reiniciarla. Incluye: edición de movimientos, hora de registro, orden de categorías, recuperar contraseña con código y verificación de correo.
- [ ] En el `.env` del servidor: las seis variables `EMAIL_*` y `NODE_ENV=production`, para que los códigos lleguen por correo y no aparezca el "Modo desarrollo". Revisar el log si algún correo no llega.
- [ ] Ya aplicado en producción: migraciones hasta la v9 (códigos de verificación, propósito del código, `category_order`). Falta solo la v10.

## 6. Limitaciones conocidas y mejoras futuras

- Los avisos y textos de las tasas (vigilante diario) siguen siendo de Venezuela; en modo `single` no se activan.
- La introducción (antes de registrarse) usa un texto neutro porque aún no se conoce el país.
- El país se fija al registrarse. Si alguien se muda, debe crear otra cuenta. Un cambio con conversión del historial no está contemplado.
- Países de más de una moneda de uso cotidiano (por ejemplo Argentina con dólar) no están contemplados: se evaluaría renombrar las columnas `amount_usd` a `amount_base`.
- Fechas en formato día/mes/año para todos los países.
- No hay pruebas automáticas en el repositorio; las que se corrieron fueron scripts puntuales (formato de números, métodos de pago, API por modo).

## 7. Limpieza opcional

- Borrar las ramas ya incluidas (`multi-pais-app`, `metodos-pago-pais`) local y remotamente.
- Después de fusionar a `main`, borrar también `multi-pais-api`.
