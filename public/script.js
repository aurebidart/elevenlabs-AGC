const { Conversation } = window.ElevenLabsClient;
const chatBubble = document.getElementById("chatBubble");
const chatWindow = document.getElementById("chatWindow");
const closeChat = document.getElementById("closeChat");
const callButton = document.getElementById("callButton");
const chatForm = document.getElementById("chatForm");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");

let textConversation = null;
let voiceConversation = null;
let startingTextConversation = false;
let startingVoiceConversation = false;
let shouldEndVoiceCallWhenReady = false;
let pendingTypingMessage = null;

const addMessage = (text, role) => {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageDiv;
};

const setLoading = (isLoading) => {
  const sendButton = chatForm.querySelector("button");
  sendButton.disabled = isLoading;
  chatInput.disabled = isLoading;
  if (isLoading) {
    if (!pendingTypingMessage) {
      pendingTypingMessage = addMessage("AGBot está escribiendo...", "bot");
    }
  } else if (pendingTypingMessage) {
    pendingTypingMessage.remove();
    pendingTypingMessage = null;
  }
};

const showChatWindow = () => {
  chatWindow.classList.remove("hidden");
  chatInput.focus();
};

const openChat = async () => {
  showChatWindow();
  if (!textConversation) {
    await initializeConversation();
  }
};

const closeChatWindow = () => {
  chatWindow.classList.add("hidden");
  shouldEndVoiceCallWhenReady = true;
  endVoiceCall();
};

const toggleChat = () => {
  if (chatWindow.classList.contains("hidden")) {
    openChat().catch((error) => {
      console.error(error);
      addMessage("No se pudo iniciar el chat. Intenta de nuevo.", "bot");
    });
  } else {
    closeChatWindow();
  }
};

const updateCallButton = (active, loading = false) => {
  if (!callButton) return;
  callButton.textContent = active ? "🛑" : "📞";
  callButton.setAttribute("aria-label", active ? "Finalizar llamada" : "Iniciar llamada");
  callButton.classList.toggle("active", active);
  callButton.disabled = loading;
};

const toggleCall = () => {
  if (voiceConversation) {
    endVoiceCall();
  } else {
    openChat();
    startVoiceCall().catch((error) => {
      console.error(error);
      addMessage("No se pudo iniciar la llamada. Intenta de nuevo.", "bot");
      updateCallButton(false, false);
    });
  }
};

const initializeConversation = async () => {
  if (textConversation || startingTextConversation) return;
  if (!window.fetch) throw new Error("Fetch no está disponible.");

  startingTextConversation = true;
  setLoading(true);
  try {
    const response = await fetch("/api/signed-url");
    if (!response.ok) {
      throw new Error("No se pudo obtener la URL firmada.");
    }

    const data = await response.json();
    const signedUrl = data.signedUrl;
    if (!signedUrl) {
      throw new Error("URL firmada inválida.");
    }

    textConversation = await Conversation.startSession({
      signedUrl,
      textOnly: true,
      onConnect: ({ conversationId }) => {
        addMessage("Chat conectado. Envía tu primer mensaje.", "bot");
      },
      onMessage: (event) => {
        if (event.role !== "agent") return;
        setLoading(false);
        addMessage(event.message, "bot");
      },
      onDisconnect: (details) => {
        console.warn("Chat desconectado:", details);
        addMessage("La sesión de chat se ha desconectado. Vuelve a abrir el chat para reconectar.", "bot");
        textConversation = null;
        setLoading(false);
      },
      onError: (message, context) => {
        console.error("SDK error:", message, context);
        addMessage("Ocurrió un error con el chat. Intenta recargar la página.", "bot");
        setLoading(false);
      },
      onStatusChange: ({ status }) => {
        if (status === "disconnected") {
          textConversation = null;
        }
      },
    });
  } catch (error) {
    console.error(error);
    addMessage("No se pudo iniciar la sesión del chat.", "bot");
  } finally {
    startingTextConversation = false;
    setLoading(false);
  }
};

const startVoiceCall = async () => {
  if (voiceConversation || startingVoiceConversation) return;
  if (!window.fetch) throw new Error("Fetch no está disponible.");

  startingVoiceConversation = true;
  shouldEndVoiceCallWhenReady = false;
  updateCallButton(true, true);
  addMessage("Iniciando llamada de voz...", "bot");
  try {
    const response = await fetch("/api/signed-url");
    if (!response.ok) {
      throw new Error("No se pudo obtener la URL firmada.");
    }

    const data = await response.json();
    const signedUrl = data.signedUrl;
    if (!signedUrl) {
      throw new Error("URL firmada inválida.");
    }

    const conversation = await Conversation.startSession({
      signedUrl,
      textOnly: false,
      onConnect: ({ conversationId }) => {
        addMessage("Llamada conectada. Habla con AGBot.", "bot");
        updateCallButton(true, false);
      },
      onMessage: (event) => {
        if (event.role === "agent") {
          setLoading(false);
        }
      },
      onDisconnect: (details) => {
        console.warn("Llamada desconectada:", details);
        addMessage("La llamada se ha finalizado.", "bot");
        voiceConversation = null;
        updateCallButton(false, false);
      },
      onError: (message, context) => {
        console.error("SDK voice error:", message, context);
        addMessage("Ocurrió un error en la llamada. Intenta de nuevo.", "bot");
        voiceConversation = null;
        updateCallButton(false, false);
      },
      onStatusChange: ({ status }) => {
        if (status === "disconnected") {
          voiceConversation = null;
          updateCallButton(false, false);
        }
      },
    });
    voiceConversation = conversation;
    if (shouldEndVoiceCallWhenReady) {
      await endVoiceCall();
    }
  } catch (error) {
    console.error(error);
    addMessage("No se pudo iniciar la llamada.", "bot");
    updateCallButton(false, false);
  } finally {
    startingVoiceConversation = false;
    shouldEndVoiceCallWhenReady = false;
  }
};

const endVoiceCall = async () => {
  if (!voiceConversation) return;
  const conversation = voiceConversation;
  voiceConversation = null;
  updateCallButton(false, false);
  try {
    await conversation.endSession();
  } catch (error) {
    console.error("Error al finalizar la llamada:", error);
  }
};

const endVoiceCallBeforeLeaving = () => {
  shouldEndVoiceCallWhenReady = true;
  if (!voiceConversation) return;
  const conversation = voiceConversation;
  voiceConversation = null;
  updateCallButton(false, false);
  conversation.endSession().catch((error) => {
    console.error("Error al finalizar la llamada al cerrar la ventana:", error);
  });
};

chatBubble.addEventListener("click", toggleChat);
closeChat.addEventListener("click", toggleChat);
callButton.addEventListener("click", toggleCall);
window.addEventListener("pagehide", endVoiceCallBeforeLeaving);
window.addEventListener("beforeunload", endVoiceCallBeforeLeaving);

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  addMessage(message, "user");
  chatInput.value = "";
  setLoading(true);

  try {
    if (voiceConversation) {
      voiceConversation.sendUserMessage(message);
      return;
    }

    if (!textConversation) {
      await initializeConversation();
    }
    if (!textConversation) {
      throw new Error("Conversación no disponible.");
    }
    textConversation.sendUserMessage(message);
  } catch (error) {
    console.error(error);
    setLoading(false);
    addMessage("Error de chat. Intenta de nuevo más tarde.", "bot");
  }
});
