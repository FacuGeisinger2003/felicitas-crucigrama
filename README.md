# Crucigrama Rioplatense — con tabla de posiciones 🧉🏆

Genera automáticamente un crucigrama nuevo cada día (cultura general del
mundo, Latinoamérica, Uruguay y Argentina), lo publica en GitHub Pages.
Cada uno que juega crea su usuario (nombre, apellido y username) una sola
vez, y al terminar puede mandar su tiempo a una tabla de posiciones
compartida con quien vos quieras.

Todo corre gratis: **GitHub Pages** para el sitio, **GitHub Actions** para
generar el crucigrama del día, y **Firebase Realtime Database** (de Google,
gratis, sin tarjeta) para guardar los tiempos de todos.

## Cómo funciona

- `generate.js` arma un crucigrama nuevo por día y lo guarda en
  `docs/puzzles/YYYY-MM-DD.html`.
- La primera vez que alguien entra a jugar, un cartel le pide nombre,
  apellido y un usuario corto. Se guarda solo en su navegador (no hace
  falta ninguna cuenta).
- Al completar el crucigrama del día aparece un botón **"📤 Mandar mi
  tiempo a la tabla"**. Ese tiempo se guarda en Firebase.
- `docs/leaderboard.html` muestra el ranking de hoy y un ranking general
  (partidas jugadas, mejor tiempo, promedio).
- Hay un botón **"🎲 Jugar un crucigrama nuevo"** para jugar rondas extra
  con otras palabras (esas no se mandan a la tabla, son solo para
  practicar).

## Paso a paso para dejarlo andando

### 1. Crear el repositorio
Creá un repositorio en GitHub, público, y subí todo el contenido de esta
carpeta a la rama `main` (incluida la carpeta `.github`, que a veces no se
sube arrastrándola desde el navegador — si te pasa, subí
`.github/workflows/daily-puzzle.yml` a mano con "Add file → Create new
file" escribiendo esa ruta completa).

### 2. Habilitar GitHub Pages
**Settings → Pages → Source**: `Deploy from a branch`, rama `main`,
carpeta `/docs`. Guardá. El sitio queda en
`https://TU-USUARIO.github.io/TU-REPO/`.

### 3. Darle permiso de escritura a las Actions
**Settings → Actions → General → Workflow permissions**: elegí
`Read and write permissions` y guardá.

### 4. Crear la base de datos gratis en Firebase
1. Andá a [console.firebase.google.com](https://console.firebase.google.com)
   y entrá con una cuenta de Google.
2. "Agregar proyecto" (o "Add project"). Ponele un nombre (por ejemplo
   `crucigrama-rioplatense`). No hace falta activar Google Analytics, podés
   sacarle el tilde.
3. Ya en el proyecto, en el menú de la izquierda buscá **Build → Realtime
   Database** (no "Firestore", es la otra: "Realtime Database").
4. Tocá "Create database" / "Crear base de datos". Elegí cualquier región
   (da igual, ej. `us-central1`). Cuando te pregunte por las reglas de
   seguridad, elegí **"Start in test mode"** (modo de prueba).
5. Una vez creada, vas a ver una URL arriba de todo, algo como
   `https://crucigrama-rioplatense-default-rtdb.firebaseio.com`. Copiala
   entera.
6. Andá a la pestaña **Rules** (reglas) de esa misma base de datos y
   reemplazá lo que haya por esto, para que cualquiera pueda leer y
   escribir tiempos (es una base solo para esto, sin datos sensibles):
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
   Tocá "Publish" / "Publicar". (El modo de prueba del paso 4 ya viene con
   reglas parecidas pero que vencen a los 30 días — con esto queda
   permanente.)

### 5. Cargar la URL en el proyecto
Abrí `lib/config.json` en tu repo de GitHub, tocá el lápiz de editar, y
poné la URL que copiaste en el paso anterior:
```json
{
  "firebaseDbUrl": "https://crucigrama-rioplatense-default-rtdb.firebaseio.com"
}
```
(sin la barra `/` al final). Commit changes.

### 6. Probarlo
**Actions → "Crucigrama diario" → Run workflow**. Esperá el tilde verde y
entrá al sitio. Completá un crucigrama y probá mandar el tiempo — después
entrá a `leaderboard.html` y fijate si aparece.

De ahí en más se genera solo todos los días a las 08:00 (UY). Para jugar,
mandale el link del sitio a tus amigos — cada uno crea su usuario la
primera vez que entra.

## Ajustar cosas

- **Agregar o sacar palabras**: `lib/wordbank.json`.
- **Cuántos días evita repetir palabras**: `RECENT_DAYS_AVOID` en
  `generate.js`.
- **Cambiar el horario de generación**: el `cron` en
  `.github/workflows/daily-puzzle.yml` (está en UTC).

## Sobre la base de datos de Firebase

Con las reglas del paso 4, cualquiera que tenga la URL puede leer y
escribir en la base — está bien para jugar con un grupo de amigos de
confianza (nadie va a andar mandando tiempos falsos a propósito, y si
pasa, no es grave: es solo un juego). Si en algún momento querés algo más
cerrado, se puede agregar una validación más estricta en las reglas, pero
eso ya es un paso más avanzado.
