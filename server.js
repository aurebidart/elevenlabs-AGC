import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH;
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH;
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || process.env.VITE_ELEVENLABS_AGENT_ID;
const API_KEY = process.env.ELEVENLABS_API_KEY;

if (!API_KEY || !AGENT_ID) {
  console.warn("Warning: ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID / VITE_ELEVENLABS_AGENT_ID is missing in .env");
}

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.get("/api/signed-url", async (req, res) => {
  try {
    if (!API_KEY || !AGENT_ID) {
      return res.status(500).json({ error: "Server configuration error: missing API key or agent ID." });
    }

    const endpoint = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${AGENT_ID}`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "xi-api-key": API_KEY
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Signed URL error:", response.status, errorBody);
      return res.status(500).json({ error: "Failed to obtain signed URL." });
    }

    const data = await response.json();
    res.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error("Signed URL proxy error:", error);
    res.status(500).json({ error: "Unable to obtain signed URL." });
  }
});

const printNetworkAddresses = (protocol, port) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const ifaceList of Object.values(interfaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  if (addresses.length > 0) {
    console.log(`${protocol.toUpperCase()} server accessible on your local network:`);
    for (const address of addresses) {
      console.log(`  ${protocol}://${address}:${port}`);
    }
  }
  console.log(`  Or use localhost on this machine: ${protocol}://localhost:${port}`);
};

app.listen(PORT, HOST, () => {
  console.log(`HTTP server running on http://${HOST === "0.0.0.0" ? "0.0.0.0" : HOST}:${PORT}`);
  printNetworkAddresses("http", PORT);
});

if (HTTPS_KEY_PATH && HTTPS_CERT_PATH) {
  try {
    const key = fs.readFileSync(path.resolve(__dirname, HTTPS_KEY_PATH), "utf8");
    const cert = fs.readFileSync(path.resolve(__dirname, HTTPS_CERT_PATH), "utf8");
    https.createServer({ key, cert }, app).listen(HTTPS_PORT, HOST, () => {
      console.log(`HTTPS server running on https://${HOST === "0.0.0.0" ? "0.0.0.0" : HOST}:${HTTPS_PORT}`);
      printNetworkAddresses("https", HTTPS_PORT);
    });
  } catch (error) {
    console.error("Unable to start HTTPS server. Check HTTPS_KEY_PATH and HTTPS_CERT_PATH:", error);
  }
} else if (process.env.USE_HTTPS === "true") {
  console.warn("USE_HTTPS=true was set but HTTPS_KEY_PATH or HTTPS_CERT_PATH is missing.");
}
