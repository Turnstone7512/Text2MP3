const EDGE_TTS_ENDPOINT = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const STORAGE_KEY = "text2mp3.settings.v1";

const textContent = document.querySelector("#textContent");
const rateSelect = document.querySelector("#rateSelect");
const voiceSelect = document.querySelector("#voiceSelect");
const fileName = document.querySelector("#fileName");
const generateButton = document.querySelector("#generateButton");
const previewButton = document.querySelector("#previewButton");
const stopButton = document.querySelector("#stopButton");
const clearTextButton = document.querySelector("#clearTextButton");
const statusPill = document.querySelector("#statusPill");
const charCount = document.querySelector("#charCount");

const state = {
  generating: false,
  browserVoices: [],
};

function setStatus(message) {
  statusPill.textContent = message;
}

function normalizeMp3Name(name) {
  const trimmed = name.trim() || "speech.mp3";
  return trimmed.toLowerCase().endsWith(".mp3") ? trimmed : `${trimmed}.mp3`;
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (typeof saved.text === "string") textContent.value = saved.text;
    if (typeof saved.rate === "string") rateSelect.value = saved.rate;
    if (typeof saved.voice === "string") voiceSelect.value = saved.voice;
    if (typeof saved.fileName === "string") fileName.value = saved.fileName;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveSettings() {
  const payload = {
    text: textContent.value,
    rate: rateSelect.value,
    voice: voiceSelect.value,
    fileName: fileName.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function updateCharCount() {
  const count = textContent.value.trim().length;
  charCount.textContent = `${count.toLocaleString()} characters`;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function ssml(text, voice, rate) {
  return `<speak version='1.0' xml:lang='en-US'><voice name='${escapeXml(voice)}'><prosody rate='${escapeXml(rate)}'>${escapeXml(text)}</prosody></voice></speak>`;
}

function requestId() {
  const random = crypto.getRandomValues(new Uint8Array(16));
  return [...random].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function websocketUrl(id) {
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    ConnectionId: id,
  });
  return `${EDGE_TTS_ENDPOINT}?${params.toString()}`;
}

function textMessage(headers, body = "") {
  const lines = Object.entries(headers).map(([key, value]) => `${key}:${value}`);
  return `${lines.join("\r\n")}\r\n\r\n${body}`;
}

function parseBinaryAudioChunk(data) {
  const view = new DataView(data);
  if (view.byteLength < 2) return null;

  const headerLength = view.getUint16(0, false);
  const audioOffset = 2 + headerLength;
  if (audioOffset >= view.byteLength) return null;

  return data.slice(audioOffset);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = normalizeMp3Name(name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function generateWithEdgeTts({ text, voice, rate }) {
  return new Promise((resolve, reject) => {
    const id = requestId();
    const socket = new WebSocket(websocketUrl(id));
    const chunks = [];
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    socket.binaryType = "arraybuffer";

    socket.addEventListener("open", () => {
      socket.send(textMessage({
        "X-Timestamp": new Date().toISOString(),
        "Content-Type": "application/json; charset=utf-8",
        Path: "speech.config",
      }, JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: false,
                wordBoundaryEnabled: false,
              },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      })));

      socket.send(textMessage({
        "X-RequestId": id,
        "X-Timestamp": new Date().toISOString(),
        "Content-Type": "application/ssml+xml",
        Path: "ssml",
      }, ssml(text, voice, rate)));
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        if (event.data.includes("Path:turn.end")) {
          settled = true;
          socket.close();
          if (!chunks.length) {
            reject(new Error("No audio was returned by the speech service."));
            return;
          }
          resolve(new Blob(chunks, { type: "audio/mpeg" }));
        }
        return;
      }

      const audio = parseBinaryAudioChunk(event.data);
      if (audio) chunks.push(audio);
    });

    socket.addEventListener("error", () => {
      fail(new Error("The browser could not connect to the Edge TTS service."));
    });

    socket.addEventListener("close", () => {
      if (!settled) fail(new Error("The Edge TTS connection closed before audio was ready."));
    });
  });
}

function browserRate(rate) {
  const number = Number.parseInt(rate, 10);
  return Math.max(0.5, Math.min(1.7, 1 + number / 100));
}

function pickBrowserVoice(edgeVoice) {
  const lang = edgeVoice.startsWith("zh-TW") ? "zh-TW" : edgeVoice.slice(0, 5);
  return state.browserVoices.find((voice) => voice.lang === lang)
    || state.browserVoices.find((voice) => voice.lang.startsWith(lang.slice(0, 2)))
    || null;
}

function previewSpeech() {
  const text = textContent.value.trim();
  if (!text) {
    setStatus("請先輸入文字");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const browserVoice = pickBrowserVoice(voiceSelect.value);
  utterance.rate = browserRate(rateSelect.value);
  if (browserVoice) utterance.voice = browserVoice;
  utterance.onstart = () => setStatus("朗讀中...");
  utterance.onend = () => setStatus("Ready");
  utterance.onerror = () => setStatus("朗讀失敗");
  window.speechSynthesis.speak(utterance);
}

async function handleGenerate() {
  const text = textContent.value.trim();
  if (!text) {
    setStatus("請先輸入文字");
    alert("Please enter text.");
    return;
  }

  state.generating = true;
  generateButton.disabled = true;
  setStatus("MP3 產生中...");

  try {
    const blob = await generateWithEdgeTts({
      text,
      voice: voiceSelect.value,
      rate: rateSelect.value,
    });
    downloadBlob(blob, fileName.value);
    setStatus("MP3 已下載");
  } catch (error) {
    console.error(error);
    setStatus("MP3 產生失敗");
    alert(`MP3 generation failed.\n\n${error.message}\n\n你仍可使用「朗讀預覽」確認文字與語速。`);
  } finally {
    state.generating = false;
    generateButton.disabled = false;
  }
}

function refreshBrowserVoices() {
  state.browserVoices = window.speechSynthesis?.getVoices?.() || [];
}

function bindEvents() {
  [textContent, rateSelect, voiceSelect, fileName].forEach((element) => {
    element.addEventListener("input", () => {
      saveSettings();
      updateCharCount();
    });
  });

  generateButton.addEventListener("click", handleGenerate);
  previewButton.addEventListener("click", previewSpeech);
  stopButton.addEventListener("click", () => {
    window.speechSynthesis.cancel();
    setStatus("Ready");
  });
  clearTextButton.addEventListener("click", () => {
    textContent.value = "";
    saveSettings();
    updateCharCount();
    textContent.focus();
  });

  if ("speechSynthesis" in window) {
    refreshBrowserVoices();
    window.speechSynthesis.onvoiceschanged = refreshBrowserVoices;
  } else {
    previewButton.disabled = true;
    stopButton.disabled = true;
  }
}

loadSettings();
updateCharCount();
bindEvents();
