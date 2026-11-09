# Suscripción: manual de publicación

Cómo pasar la suscripción a producción **sin sorpresas**. Nada de esto se ejecuta hasta que se ordene: cada paso lo confirmas tú. La clave es que el código viaja **apagado** (`SUBSCRIPTIONS_ENABLED=false`) y solo se enciende al final, cuando todo está verificado.

## Antes de empezar (una sola vez)

- [ ] **Términos y reembolsos revisados** (`docs/TERMINOS-Y-REEMBOLSOS.md`, ideal con un asesor). Confirmar la ventana de reembolso y el correo de contacto.
- [ ] **Matriz de pruebas** en el teléfono hecha y sin fallos (`docs/SUSCRIPCION-PRUEBAS.md`).
- [ ] **Acceso a la base de producción:** tu IP (o la de la VPN) autorizada en el firewall **y** en `pg_hba.conf`. Se comprueba con una consulta de solo lectura antes de tocar nada.
- [ ] **Clave del panel** generada (mínimo 16 caracteres, al azar):
  ```bash
  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  ```
  Guárdala en tu gestor de contraseñas; no se sube a git.
- [ ] **Decidir los días de prueba:** cuántos para cuentas nuevas y cuántos para las que ya existen (`trial_days` y `trial_days_existing`, valor inicial 14 y 14). Se cambian desde el panel antes de encender.

## Pasos, en este orden

### 1. Respaldo de la base
Un respaldo completo con `pg_dump` (formato personalizado) a un archivo con la fecha. Guárdalo fuera del servidor. Si no puedes restaurarlo, no sigas.

### 2. Migración (`npm run migrate:prod`)
Es **aditiva**: no borra ni modifica datos existentes. Crea:
- Columnas nuevas en `users`: `trial_ends_at`, `premium_until`, `trial_days_granted`, `expiry_notice_for`, `trial_notice_for`.
- Tablas: `subscription_plans` (con mensual 2,50 y anual 20), `subscription_payments`, `redeem_codes`, `payment_receivers`, `app_settings` (con los días de prueba).
- Columnas e índice de pagos (`plan_days`, `expected_amount`…, referencia única).

Verificación: contar usuarios, entidades, movimientos, transferencias y abonos **antes y después**; deben ser idénticos. Comprobar que existen las tablas nuevas y los dos planes.

### 3. Desplegar la API desde `main`
- Variables de entorno del servidor:
  - `SUBSCRIPTIONS_ENABLED=false`  ← sigue apagado
  - `ADMIN_KEY=` (la clave generada)
  - `ADMIN_NOTIFY_EMAIL=` (opcional, para que te avise de cada pago nuevo; requiere el correo configurado)
- El zip de despliegue **debe incluir la carpeta nueva `src/admin/`** (la página del panel).
- Verificación: `GET /health` responde; entrar a `/admin/` con la clave; con la función apagada, `GET /api/subscription` devuelve `enabled: false`.

### 4. Cargar tus datos de cobro
Desde el panel (pestaña «Datos de cobro»), o con el importador desde `main` (usa la base de producción):
```bash
npm run receivers:import -- "ruta/al/archivo.txt"
```
Verificación: en el panel aparecen Pago móvil, Zinli y PayPal con sus datos.

### 5. Construir y probar el APK
- Aumentar la versión en `app.json` y construir el APK (hay que reconstruirlo de todos modos por el SDK 58 / React Native 0.88).
- Instalarlo y comprobar con la función **apagada**: la app se ve y funciona **igual que hoy** (sin avisos de plan ni «Mi plan»).

### 6. Encender
Solo cuando 1 a 5 estén verificados:
1. Ajustar `trial_days_existing` en el panel si quieres darles a los usuarios actuales una prueba distinta.
2. **Avisar a los usuarios** antes (ver el mensaje de abajo).
3. Poner `SUBSCRIPTIONS_ENABLED=true` y reiniciar la API.

Qué pasa al encender: cada usuario existente recibe su prueba **la primera vez que entra** a partir de ese momento; los nuevos la reciben al verificar su correo. Nadie pierde datos.

### 7. Verificar en vivo
- Con tu cuenta: ver el aviso de prueba, hacer un pago **real** pequeño o canjear un código tuyo, aprobarlo en el panel y comprobar que la app pasa a Premium.
- Revisar los registros del servidor las primeras horas (errores 402 inesperados, fallos de correo).
- Revisar el panel cada día: pagos pendientes.

## Si algo sale mal (marcha atrás)
- **Apagar la función:** `SUBSCRIPTIONS_ENABLED=false` y reiniciar. Todos vuelven a tener todo, sin tocar datos. Es inmediato y seguro.
- Los datos de pagos y códigos se conservan; las columnas y tablas nuevas no estorban, así que **no hace falta deshacer la migración**.
- Un pago aprobado por error: se puede corregir quitando días desde el panel (Usuarios) o directamente en la base.

## Mensaje sugerido a los usuarios (antes de encender)

> Mi Biyuyo estrena planes. Todos tus datos se conservan. Al abrir la app tendrás **N días de prueba con todas las funciones**; después puedes seguir con el plan Gratis (1 entidad, ingresos, gastos y estadísticas básicas) o activar Premium por USD 2,50 al mes (o 20 al año) con Pago móvil, Zinli o PayPal. Lo que no incluye el plan Gratis se sigue viendo, solo que no se puede registrar de nuevo hasta activar Premium. Más detalles en Ajustes > Mi plan.

## Después de publicar
- Mirar cuántos usuarios llegan a «Activar Premium» y cuántos pagos se rechazan, para ajustar mensajes y precios.
- Fase 5 (más adelante): automatizar la conciliación de pagos, Google Play / App Store y precios por país.
