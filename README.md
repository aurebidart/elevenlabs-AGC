# Eleven Labs AGBot Demo

Proyecto web con una ventana de chat estilo intercambio de audios. El usuario puede grabar una nota de voz, el navegador la transcribe y la app manda solo texto al agente de ElevenLabs para ahorrar minutos de STT y tiempo de llamada. La respuesta del agente se convierte a audio con TTS y los audios quedan guardados localmente en el navegador.

## Cómo usar

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Asegúrate de tener `.env` en la raíz con:
   ```text
   ELEVENLABS_API_KEY=sk_...
   ELEVENLABS_AGENT_ID=agent_...
   ELEVENLABS_TTS_VOICE_ID=voice_...
   # Opcional:
   ELEVENLABS_TTS_MODEL_ID=eleven_multilingual_v2
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

- `server.js`: backend Express que solicita un token de conversación a ElevenLabs y proxyea TTS sin exponer la API key.
- `public/index.html`: página simple y sin contenido extra.
- `public/style.css`: estilos para burbuja, ventana y mensajes de audio.
- `public/script.js`: lógica de apertura de chat, grabación, transcripción en navegador, envío de texto y persistencia local de audios.

## Notas

- Los audios se guardan en IndexedDB del navegador. No se suben al servidor.
- La transcripción usa Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). Si el navegador no la soporta, usa el campo de texto. Según el navegador, el reconocimiento puede depender de servicios del proveedor del navegador; en todos los casos, no consume STT de ElevenLabs.
- Para ahorrar STT de ElevenLabs, el audio grabado no se manda al agente; solo se envía la transcripción.
- El backend usa el `ELEVENLABS_API_KEY` y `ELEVENLABS_AGENT_ID` de `.env`.
