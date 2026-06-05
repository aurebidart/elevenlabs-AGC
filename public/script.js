const { Conversation } = window.ElevenLabsClient;
const chatBubble = document.getElementById("chatBubble");
const chatWindow = document.getElementById("chatWindow");
const closeChat = document.getElementById("closeChat");
const callButton = document.getElementById("callButton");
const chatForm = document.getElementById("chatForm");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const recordButton = document.getElementById("recordButton");
const sendButton = document.getElementById("sendButton");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const DB_NAME = "agbot-audio-chat";
const DB_VERSION = 1;
const STORE_NAME = "messages";

let textConversation = null;
let startingTextConversation = false;
let pendingTypingMessage = null;
let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let recognition = null;
let recordingStartedAt = 0;
let transcriptDraft = "";
let dbPromise = null;

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
};

const saveLocalMessage = async (message) => {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(message);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

const loadLocalMessages = async () => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => reject(request.error);
  });
};

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(1, Math.round(seconds || 1));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const secs = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
};

const addTextMessage = (text, role) => {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageDiv;
};

const addAudioMessage = ({ role, audioBlob, transcript, duration, createdAt }) => {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message audio-message ${role}`;

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "metadata";
  audio.src = URL.createObjectURL(audioBlob);

  const meta = document.createElement("div");
  meta.className = "audio-meta";
  meta.textContent = formatDuration(duration);
  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration)) {
      meta.textContent = formatDuration(audio.duration);
    }
  };

  messageDiv.appendChild(audio);
  messageDiv.appendChild(meta);

  if (transcript) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const text = document.createElement("p");
    summary.textContent = "Texto";
    text.textContent = transcript;
    details.appendChild(summary);
    details.appendChild(text);
    messageDiv.appendChild(details);
  }

  messageDiv.dataset.createdAt = String(createdAt || Date.now());
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageDiv;
};

const setLoading = (isLoading) => {
  sendButton.disabled = isLoading;
  chatInput.disabled = isLoading;
  recordButton.disabled = isLoading && !mediaRecorder;
  if (isLoading) {
    if (!pendingTypingMessage) {
      pendingTypingMessage = addTextMessage("AGBot está preparando una respuesta...", "bot");
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
  await restoreLocalMessages();
  if (!textConversation) {
    await initializeConversation();
  }
};

const toggleChat = () => {
  if (chatWindow.classList.contains("hidden")) {
    openChat().catch((error) => {
      console.error(error);
      addTextMessage("No se pudo iniciar el chat. Intenta de nuevo.", "bot");
    });
  } else {
    chatWindow.classList.add("hidden");
  }
};

const restoreLocalMessages = async () => {
  if (chatMessages.dataset.restored === "true") return;
  chatMessages.dataset.restored = "true";
  try {
    const messages = await loadLocalMessages();
    messages.forEach(addAudioMessage);
  } catch (error) {
    console.error("Error cargando audios locales:", error);
    addTextMessage("No se pudieron cargar los audios guardados en este navegador.", "bot");
  }
};

const updateRecordButton = (isRecording) => {
  recordButton.textContent = isRecording ? "■" : "●";
  recordButton.setAttribute("aria-label", isRecording ? "Detener grabación" : "Grabar audio");
  recordButton.classList.toggle("recording", isRecording);
};

const updateCallButton = () => {
  callButton.textContent = SpeechRecognition ? "♫" : "!";
  callButton.setAttribute("aria-label", SpeechRecognition ? "Notas de voz activas" : "Transcripción no disponible");
  callButton.title = SpeechRecognition
    ? "Los audios se transcriben en el navegador y se manda texto al agente."
    : "Este navegador no soporta transcripción de voz. Usa el campo de texto.";
};

const initializeConversation = async () => {
  if (textConversation || startingTextConversation) return;
  if (!window.fetch) throw new Error("Fetch no está disponible.");

  startingTextConversation = true;
  setLoading(true);
  try {
    const response = await fetch("/api/signed-url");
    if (!response.ok) throw new Error("No se pudo obtener la URL firmada.");

    const { signedUrl } = await response.json();
    if (!signedUrl) throw new Error("URL firmada inválida.");

    textConversation = await Conversation.startSession({
      signedUrl,
      textOnly: true,
      onConnect: () => addTextMessage("Chat conectado. Puedes mandar texto o notas de voz.", "bot"),
      onMessage: (event) => {
        if (event.role !== "agent") return;
        handleAgentText(event.message || event.text || event.transcript || "");
      },
      onDisconnect: (details) => {
        console.warn("Chat desconectado:", details);
        addTextMessage("La sesión de chat se desconectó. Vuelve a abrir el chat para reconectar.", "bot");
        textConversation = null;
        setLoading(false);
      },
      onError: (message, context) => {
        console.error("SDK error:", message, context);
        addTextMessage("Ocurrió un error con el chat. Intenta recargar la página.", "bot");
        setLoading(false);
      },
      onStatusChange: ({ status }) => {
        if (status === "disconnected") textConversation = null;
      },
    });
  } catch (error) {
    console.error(error);
    addTextMessage("No se pudo iniciar la sesión del chat.", "bot");
  } finally {
    startingTextConversation = false;
    setLoading(false);
  }
};

const synthesizeAudio = async (text) => {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || error.error || `No se pudo generar el audio (${response.status}).`);
  }
  return response.blob();
};

const handleAgentText = async (text) => {
  if (!text.trim()) return;
  setLoading(false);
  try {
    const audioBlob = await synthesizeAudio(text);
    const message = {
      id: crypto.randomUUID(),
      role: "bot",
      transcript: text,
      audioBlob,
      duration: 0,
      createdAt: Date.now()
    };
    await saveLocalMessage(message);
    addAudioMessage(message);
  } catch (error) {
    console.error(error);
    addTextMessage(text, "bot");
    addTextMessage(`No se pudo convertir la respuesta a audio: ${error.message}`, "bot");
  }
};

const createRecognition = () => {
  if (!SpeechRecognition) return null;
  const instance = new SpeechRecognition();
  instance.lang = "es-AR";
  instance.continuous = true;
  instance.interimResults = true;
  instance.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal) finalText += result[0].transcript;
      else interimText += result[0].transcript;
    }
    transcriptDraft = `${transcriptDraft} ${finalText}`.trim();
    chatInput.value = `${transcriptDraft} ${interimText}`.trim();
  };
  instance.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
  };
  return instance;
};

const startRecording = async () => {
  if (!SpeechRecognition) {
    addTextMessage("Este navegador no soporta transcripción de voz. Puedes escribir el mensaje y enviarlo.", "bot");
    return;
  }

  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recordedChunks = [];
  transcriptDraft = "";
  chatInput.value = "";
  mediaRecorder = new MediaRecorder(mediaStream);
  recognition = createRecognition();
  recordingStartedAt = Date.now();

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  mediaRecorder.onstop = finishRecording;

  mediaRecorder.start();
  recognition?.start();
  updateRecordButton(true);
};

const stopRecording = () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  recognition?.stop();
  mediaStream?.getTracks().forEach((track) => track.stop());
  updateRecordButton(false);
};

const finishRecording = async () => {
  const duration = (Date.now() - recordingStartedAt) / 1000;
  const audioBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
  const transcript = chatInput.value.trim();
  mediaRecorder = null;
  recognition = null;
  mediaStream = null;

  if (!transcript) {
    addTextMessage("No pude transcribir ese audio. Intenta de nuevo o escribe el mensaje.", "bot");
    return;
  }

  const localMessage = {
    id: crypto.randomUUID(),
    role: "user",
    transcript,
    audioBlob,
    duration,
    createdAt: Date.now()
  };
  await saveLocalMessage(localMessage);
  addAudioMessage(localMessage);
  await sendTextToAgent(transcript);
  chatInput.value = "";
};

const sendTextToAgent = async (message) => {
  setLoading(true);
  try {
    if (!textConversation) await initializeConversation();
    if (!textConversation) throw new Error("Conversación no disponible.");
    textConversation.sendUserMessage(message);
  } catch (error) {
    console.error(error);
    setLoading(false);
    addTextMessage("Error de chat. Intenta de nuevo más tarde.", "bot");
  }
};

chatBubble.addEventListener("click", toggleChat);
closeChat.addEventListener("click", toggleChat);
callButton.addEventListener("click", () => {
  addTextMessage(callButton.title, "bot");
});
recordButton.addEventListener("click", () => {
  if (mediaRecorder) {
    stopRecording();
    return;
  }
  startRecording().catch((error) => {
    console.error(error);
    updateRecordButton(false);
    addTextMessage("No se pudo acceder al micrófono.", "bot");
  });
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  addTextMessage(message, "user");
  chatInput.value = "";
  await sendTextToAgent(message);
});

updateCallButton();
