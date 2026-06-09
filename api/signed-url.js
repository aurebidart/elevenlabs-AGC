export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID || process.env.VITE_ELEVENLABS_AGENT_ID;

  if (!apiKey || !agentId) {
    return res.status(500).json({ error: "Server configuration error: missing API key or agent ID." });
  }

  try {
    const endpoint = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "xi-api-key": apiKey
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Signed URL error:", response.status, errorBody);
      return res.status(500).json({ error: "Failed to obtain signed URL." });
    }

    const data = await response.json();
    return res.status(200).json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error("Signed URL proxy error:", error);
    return res.status(500).json({ error: "Unable to obtain signed URL." });
  }
}
