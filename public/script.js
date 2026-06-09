const { Conversation } = window.ElevenLabsClient;

const chatBubble = document.getElementById("chatBubble");
const chatWindow = document.getElementById("chatWindow");
const closeChat = document.getElementById("closeChat");
const chatForm = document.getElementById("chatForm");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");

let conversation = null;
let startingConversation = false;
let pendingTypingMessage = null;

const addTextMessage = (text, role) => {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageDiv;
};

const setLoading = (isLoading) => {
  sendButton.disabled = isLoading;
  chatInput.disabled = isLoading;

  if (isLoading) {
    if (!pendingTypingMessage) {
      pendingTypingMessage = addTextMessage("AGBot está escribiendo...", "bot");
    }
    return;
  }

  if (pendingTypingMessage) {
    pendingTypingMessage.remove();
    pendingTypingMessage = null;
  }
};

const handleAgentText = (text) => {
  const cleanText = String(text || "").trim();
  if (!cleanText) return;
  setLoading(false);
  addTextMessage(cleanText, "bot");
};

const initializeConversation = async () => {
  if (conversation || startingConversation) return;

  startingConversation = true;
  setLoading(true);

  try {
    const response = await fetch("/api/signed-url");
    if (!response.ok) throw new Error("No se pudo obtener la URL firmada.");

    const { signedUrl } = await response.json();
    if (!signedUrl) throw new Error("URL firmada inválida.");

    conversation = await Conversation.startSession({
      signedUrl,
      textOnly: true,
      onConnect: () => handleAgentText("Chat conectado. Escribe tu mensaje para empezar."),
      onMessage: (event) => {
        if (event.role !== "agent") return;
        handleAgentText(event.message || event.text || event.transcript || "");
      },
      onDisconnect: () => {
        conversation = null;
        setLoading(false);
        addTextMessage("La sesión se desconectó. Vuelve a abrir el chat para reconectar.", "bot");
      },
      onError: (message, context) => {
        console.error("SDK error:", message, context);
        setLoading(false);
        addTextMessage("Ocurrió un error con el chat. Intenta recargar la página.", "bot");
      },
      onStatusChange: ({ status }) => {
        if (status === "disconnected") conversation = null;
      },
    });
  } catch (error) {
    console.error(error);
    addTextMessage("No se pudo iniciar la sesión del chat.", "bot");
  } finally {
    startingConversation = false;
    setLoading(false);
  }
};

const openChat = async () => {
  chatWindow.classList.remove("hidden");
  chatInput.focus();
  await initializeConversation();
};

const toggleChat = () => {
  if (chatWindow.classList.contains("hidden")) {
    openChat().catch((error) => {
      console.error(error);
      addTextMessage("No se pudo abrir el chat. Intenta de nuevo.", "bot");
    });
    return;
  }

  chatWindow.classList.add("hidden");
};

const sendTextToAgent = async (message) => {
  setLoading(true);

  try {
    if (!conversation) await initializeConversation();
    if (!conversation) throw new Error("Conversación no disponible.");
    conversation.sendUserMessage(message);
  } catch (error) {
    console.error(error);
    setLoading(false);
    addTextMessage("Error de chat. Intenta de nuevo más tarde.", "bot");
  }
};

chatBubble.addEventListener("click", toggleChat);
closeChat.addEventListener("click", toggleChat);

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = chatInput.value.trim();
  if (!message) return;

  addTextMessage(message, "user");
  chatInput.value = "";
  await sendTextToAgent(message);
});
