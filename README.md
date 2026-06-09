# Eleven Labs AGBot Demo

Primera demo web de chat solo texto. El usuario escribe un mensaje en una ventana simple y recibe una respuesta textual del agente de ElevenLabs.

No incluye audio, llamadas, grabacion, transcripcion ni TTS.

## Como usar

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Crea un archivo `.env` en la raiz con:
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

Para usar la app desde otro equipo movil o PC en la misma red, accede con la IP local de la maquina que ejecuta el servidor:

```text
http://192.168.X.Y:3000
```

Como esta demo no usa microfono, no necesitas HTTPS para probarla en red local.

## HTTPS local opcional

Si quieres servir tambien por HTTPS, agrega estas variables al `.env`:

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

Luego abre:

```text
https://192.168.100.9:3443
```

## Estructura

- `server.js`: backend Express que solicita una URL firmada de conversacion a ElevenLabs sin exponer la API key.
- `public/index.html`: pagina simple con burbuja y ventana de chat.
- `public/style.css`: estilos de la burbuja, ventana, mensajes y formulario.
- `public/script.js`: logica para abrir el chat, iniciar una sesion text-only y enviar mensajes.
