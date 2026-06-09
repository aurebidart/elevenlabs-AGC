# Eleven Labs AGBot Demo

Proyecto web mínimo con un botón de chat que abre una ventana y envía mensajes a la API de Eleven Labs para conectar con el chatbot AGBot.

## Cómo usar

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Asegúrate de tener `.env` en la raíz con:
   ```text
   ELEVENLABS_API_KEY=sk_...
   ELEVENLABS_AGENT_ID=agent_...
   # o, si usas la variable del frontend existente:
   VITE_ELEVENLABS_AGENT_ID=agent_...
   ```
3. Inicia el servidor:
   ```bash
   npm start
   ```
4. Abre `http://localhost:3000` en tu navegador.

## Acceso desde otros dispositivos en la misma red
Para usar la app desde otro equipo móvil o PC en la misma red, accede con la IP local de tu máquina que ejecuta el servidor.

- Si no usas HTTPS, el navegador podrá abrir la página con `http://192.168.X.Y:3000`, pero no concederá permisos de micrófono en un dispositivo remoto.
- Para micrófono en red local, usa HTTPS y un certificado local confiable.

### HTTPS local recomendado
Agrega estas variables a tu `.env`:
```text
HOST=0.0.0.0
PORT=3000
HTTPS_PORT=3443
HTTPS_KEY_PATH=certs/localhost-key.pem
HTTPS_CERT_PATH=certs/localhost.pem
```

Genera un certificado local confiable con `mkcert` usando tu IP real en la red local:
```bash
npm install -g mkcert
mkcert -install
mkdir -p certs
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 192.168.100.9
```

Luego abre en tu otro dispositivo:
- `https://192.168.100.9:3443`

Si usas otra IP local válida del equipo que corre el servidor, inclúyela también en el comando:
```bash
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 192.168.100.9 10.175.37.29
```

Si el navegador del dispositivo remoto sigue mostrando sitio no seguro, es porque el certificado raíz de `mkcert` no está instalado en ese dispositivo. En ese caso, copia el archivo raíz de CA de `mkcert` y confía en él en el otro dispositivo.

## Estructura

- `server.js`: backend Express que solicita un token de conversación a Eleven Labs.
- `public/index.html`: página simple y sin contenido extra.
- `public/style.css`: estilos para burbuja y ventana de chat.
- `public/script.js`: lógica de apertura de chat y envío de mensajes.

## Notas

- El frontend es muy simple y estático.
- El backend usa el `ELEVENLABS_API_KEY` y `ELEVENLABS_AGENT_ID` de `.env`.
