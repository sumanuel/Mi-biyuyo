# Desarrollo local (rama `develop`)

`develop` es la rama de trabajo: aquí se prueban los cambios con la **API y la base de datos locales**, sin tocar producción. `main` es lo que está en producción.

## Entornos

| | Desarrollo (local) | Producción |
|---|---|---|
| API | `mi-biyuyo-api/.env` → BD `localhost` | `mi-biyuyo-api/.env.production` (solo para migrar) |
| App | `mi-biyuyo-app/.env.development.local` → `http://<IP de tu PC>:3001/api` | `mi-biyuyo-app/.env` → `https://mi-biyuyo.system-meek.com/api` |

Todos estos archivos están en `.gitignore` (tienen claves): hay que crearlos a mano en cada equipo.
El correo está desactivado en local (`EMAIL_USER`/`EMAIL_PASS` vacíos): el código de verificación sale en la respuesta de la API (`dev_code`).

## Levantar todo

```bash
# Terminal 1: API local (usa .env)
cd mi-biyuyo-api && npm run dev

# Terminal 2: app (Expo usa .env.development.local)
cd mi-biyuyo-app && npx expo start
```

- Teléfono: `EXPO_PUBLIC_API_URL` debe ser la IP de tu PC en el WiFi (`ipconfig`), y el teléfono en la misma red. Si no conecta, permite el puerto 3001 en el firewall de Windows.
- Navegador (`w`): sirve también `http://localhost:3001/api`.
- Emulador Android: `http://10.0.2.2:3001/api`.
- Usuario de prueba: `npm run seed:demo` en `mi-biyuyo-api` (demo@mibiyuyo.test / Demo1234!).
- Tras cambiar un `.env.*` de la app, reinicia Expo con `npx expo start -c`.

## Migraciones

```bash
cd mi-biyuyo-api
npm run migrate        # BD local (usa .env)
npm run migrate:prod   # PRODUCCIÓN (usa .env.production): solo cuando todo esté probado
```

## Flujo de ramas

1. Cada cambio nuevo sale de `develop` en su propia rama (`git checkout develop && git checkout -b mi-cambio`).
2. Se prueba en local (API + BD locales) y se fusiona a `develop`.
3. Cuando `develop` está listo para publicar: migración en producción → fusionar a `main` → desplegar la API → generar la app.
