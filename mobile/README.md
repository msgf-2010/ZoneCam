# ZoneCam Field (mobile)

Expo app for field capture. It uses the **same** ZoneCam `/api/v1` backend, sessions, database, and object storage as the web app.

## Run

```bash
cd mobile
npm.cmd install
npx.cmd expo start
```

On an Android emulator, set API URL to `http://10.0.2.2:3001`. On a physical device, use your computer’s LAN IP.

Login returns a session token stored in the secure store and sent as `Authorization: Bearer`.

## Offline

Photos are copied into the app document directory and queued in SQLite (`upload_queue`). `clientUploadId` is sent on every retry so the server will not create duplicates. When NetInfo reports connectivity, the queue flushes with exponential backoff.
