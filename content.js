let host = null;
let shadow = null;
let panel = null;
let els = null;

let autoPlayedCardKey = null;
let currentAudioUrl = null;
let currentNoteId = null;
let autoSavedCardKey = null;

const AUDIO_DB_NAME = "economist-anki-audio-cache";
const AUDIO_STORE_NAME = "audio";
const AUDIO_DB_VERSION = 1;

let audioDbPromise = null;

chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "SHOW_ANKI_PANEL") return;
  
    showPanel(message.card, {
      shouldAutoPlay: true,
      shouldAutoSave: true
    });
});
  
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.pendingCard) return;
    if (!panel || !els) return;

    showPanel(changes.pendingCard.newValue, {
        shouldAutoPlay: false,
        shouldAutoSave: true
    });
});

async function showPanel(
    card,
    { shouldAutoPlay = false, shouldAutoSave = true } = {}
  ) {
    ensurePanel();
  
    els.front.value = card?.front || "";
    els.back.value = card?.back || "";
  
    if (card?.back === "생성 중...") {
      els.status.textContent = "생성 중...";
      setUiMode("generating");
    } else {
      els.status.textContent = "생성 완료.";
      setUiMode("generating");
    }
  
    // 자동재생은 오래 걸리므로 절대 await 하지 않는다.
    // await하면 예전 "생성 중..." 카드가 나중에 다시 UI를 덮어쓴다.
    if (shouldAutoPlay) {
      autoPlayOnce(card).catch((error) => {
        console.warn("자동 발음 재생 실패:", error);
      });
    }
  
    // 자동저장은 즉시 실행한다.
    if (shouldAutoSave) {
      await tryAutoSave(card);
    }
}

function ensurePanel() {
    if (host && shadow && panel && els) return;
  
    host = document.createElement("div");
    host.id = "economist-anki-host";
    document.documentElement.appendChild(host);
  
    shadow = host.attachShadow({ mode: "open" });
  
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }
  
        *, *::before, *::after {
          box-sizing: border-box;
        }
  
        #economist-anki-panel {
          position: fixed;
          right: 24px;
          bottom: 24px;
          width: 560px;
          max-height: 82vh;
          z-index: 2147483647;
          background: #ffffff;
          color: #111111;
          border: 1px solid #d9d9d9;
          border-radius: 20px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
          padding: 18px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          line-height: 1.45;
        }
  
        .ea-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
  
        .ea-title {
          font-size: 18px;
          font-weight: 700;
        }
  
        #ea-close {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          background: #f1f1f1;
          color: #111;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }
  
        .ea-label {
          font-size: 16px;
          font-weight: 700;
          margin: 12px 0 6px;
        }
  
        textarea {
          width: 100%;
          resize: vertical;
          padding: 12px;
          border: 1px solid #cfcfcf;
          border-radius: 10px;
          background: #fff;
          color: #111;
          font-family: Arial, sans-serif;
          font-size: 14px;
          line-height: 1.55;
          letter-spacing: normal;
          word-spacing: normal;
        }
  
        #ea-front {
          min-height: 120px;
        }
  
        #ea-back {
          min-height: 270px;
        }
  
        .ea-actions {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }
  
        .ea-actions button {
          flex: 1;
          height: 44px;
          border: 1px solid #cfcfcf;
          border-radius: 10px;
          background: #fff;
          color: #111;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
        }
  
        .ea-actions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
  
        #ea-status {
          margin-top: 12px;
          white-space: pre-wrap;
          color: #333;
          font-size: 14px;
        }
      </style>
  
      <div id="economist-anki-panel">
        <div class="ea-header">
          <div class="ea-title">Economist → Anki</div>
          <button id="ea-close" type="button">×</button>
        </div>
  
        <div class="ea-label">Front</div>
        <textarea id="ea-front"></textarea>
  
        <div class="ea-label">Back</div>
        <textarea id="ea-back"></textarea>
  
        <div class="ea-actions">
          <button id="ea-play" type="button">발음</button>
          <button id="ea-cancel" type="button" style="display:none;">저장 취소</button>
          <button id="ea-save" type="button" style="display:none;">Anki 저장</button>
        </div>
  
        <div id="ea-status"></div>
      </div>
    `;
  
    panel = shadow.querySelector("#economist-anki-panel");
  
    els = {
      close: shadow.querySelector("#ea-close"),
      front: shadow.querySelector("#ea-front"),
      back: shadow.querySelector("#ea-back"),
      play: shadow.querySelector("#ea-play"),
      cancel: shadow.querySelector("#ea-cancel"),
      save: shadow.querySelector("#ea-save"),
      status: shadow.querySelector("#ea-status")
    };
  
    els.close.addEventListener("click", () => {
      host.remove();
      host = null;
      shadow = null;
      panel = null;
      els = null;
    });
  
    els.play.addEventListener("click", async () => {
      const text = getPronunciationText();
  
      if (!text) {
        els.status.textContent = "재생할 단어/표현이 없습니다.";
        return;
      }
  
      try {
        els.play.disabled = true;
        els.status.textContent = "발음 재생 중...";
        await playElevenLabsTts(text);
        els.status.textContent = "발음 재생 완료";
      } catch (error) {
        els.status.textContent = `발음 재생 실패:\n${error.message}`;
      } finally {
        els.play.disabled = false;
      }
    });
  
    els.save.addEventListener("click", async () => {
      try {
        setUiMode("saving");
        els.status.textContent = "Anki 저장 중...";
  
        const noteId = await saveCurrentCardToAnki();
  
        currentNoteId = noteId;
        autoSavedCardKey = buildCardSaveKey({
          createdAt: Date.now(),
          front: els.front.value,
          back: els.back.value
        });
  
        setUiMode("saved");
        els.status.textContent = `저장 완료: note ${noteId}`;
      } catch (error) {
        setUiMode("unsaved");
        els.status.textContent = `저장 실패:\n${error.message}`;
      }
    });
  
    els.cancel.addEventListener("click", async () => {
      if (!currentNoteId) {
        els.status.textContent = "취소할 저장 내역이 없습니다.";
        setUiMode("unsaved");
        return;
      }
  
      try {
        els.cancel.disabled = true;
        els.status.textContent = "Anki 저장 취소 중...";
  
        await deleteAnkiNote(currentNoteId);
  
        currentNoteId = null;
        autoSavedCardKey = null;
  
        setUiMode("unsaved");
        els.status.textContent = "저장을 취소했습니다. 다시 저장할 수 있습니다.";
      } catch (error) {
        els.cancel.disabled = false;
        els.status.textContent = `저장 취소 실패:\n${error.message}`;
      }
    });
}

function setUiMode(mode) {
    if (!els) return;
  
    els.save.disabled = false;
    els.cancel.disabled = false;
  
    if (mode === "generating") {
      els.save.style.display = "none";
      els.cancel.style.display = "none";
      return;
    }
  
    if (mode === "saving") {
      els.save.style.display = "none";
      els.cancel.style.display = "block";
      els.cancel.disabled = true;
      return;
    }
  
    if (mode === "saved") {
      els.save.style.display = "none";
      els.cancel.style.display = "block";
      els.cancel.disabled = false;
      return;
    }
  
    if (mode === "unsaved") {
      els.save.style.display = "block";
      els.cancel.style.display = "none";
    }
  }

function getPronunciationText(frontText = els?.front?.value || "") {
  return (frontText || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "";
}

async function autoPlayOnce(card) {
    if (!card) return;
  
    const text = card.ttsText || getPronunciationText(card.front);
    if (!text) return;
  
    const cardKey = `${card.createdAt || ""}:${normalizeAudioText(text)}`;
    if (autoPlayedCardKey === cardKey) return;
  
    autoPlayedCardKey = cardKey;
  
    await playElevenLabsTtsTwice(text);
}

async function playElevenLabsTtsTwice(text) {
  await playElevenLabsTts(text);
  await delay(2000);
  await playElevenLabsTts(text);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryAutoSave(card) {
    if (!card || !els) return;
  
    const front = (card.front || "").trim();
    const back = (card.back || "").trim();
  
    if (!front || !back) {
        setUiMode("unsaved");
        els.status.textContent = "Front/Back이 비어 있어 자동 저장하지 않았습니다.";
        return;
    }
      
    if (back === "생성 중...") {
        setUiMode("generating");
        els.status.textContent = "생성 중...";
        return;
    }
    if (
        back.includes("Gemini API Key가 설정되지 않았습니다") ||
        back.includes("Gemini 호출 실패") ||
        back.includes("Gemini 모델을 찾을 수 없습니다") ||
        back.includes("Gemini 응답 없음") ||
        back.includes("Gemini 응답 파싱 실패")
      ) {
        setUiMode("unsaved");
        els.status.textContent = "생성 결과에 문제가 있어 자동 저장하지 않았습니다.";
        return;
    }
  
    const cardKey = buildCardSaveKey({
      createdAt: card.createdAt,
      front,
      back
    });
  
    if (autoSavedCardKey === cardKey) return;
  
    autoSavedCardKey = cardKey;
  
    try {
      setUiMode("saving");
      els.status.textContent = "Anki에 자동 저장 중...";
  
      const noteId = await saveCurrentCardToAnki();
  
      currentNoteId = noteId;
  
      setUiMode("saved");
      els.status.textContent = `Anki 자동 저장 완료: note ${noteId}`;
    } catch (error) {
      autoSavedCardKey = null;
      currentNoteId = null;
  
      setUiMode("unsaved");
      els.status.textContent = `자동 저장 실패:\n${error.message}`;
    }
}

function buildCardSaveKey({ createdAt, front, back }) {
  return `${createdAt || ""}:${(front || "").trim()}:${(back || "").trim()}`;
}

async function saveCurrentCardToAnki() {
  const front = els.front.value.trim();
  const back = els.back.value.trim();

  if (!front || !back) {
    throw new Error("Front/Back이 비어 있습니다.");
  }

  const settings = await chrome.storage.sync.get([
    "deckName",
    "modelNameForAnki",
    "tags"
  ]);

  return await addToAnki({
    deckName: settings.deckName || "English",
    modelName: settings.modelNameForAnki || "Basic",
    front,
    back,
    tags: parseTags(settings.tags || "economist llm")
  });
}

function parseTags(value) {
  return value
    .split(/[ ,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function convertToAnkiHtml(text) {
  return escapeHtml(text)
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

function escapeHtml(text) {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function addToAnki({ deckName, modelName, front, back, tags }) {
  const payload = {
    action: "addNote",
    version: 6,
    params: {
      note: {
        deckName,
        modelName,
        fields: {
          Front: convertToAnkiHtml(front),
          Back: convertToAnkiHtml(back)
        },
        tags,
        options: {
          allowDuplicate: false,
          duplicateScope: "deck"
        }
      }
    }
  };

  const json = await callAnkiConnect(payload);

  if (json.error) {
    throw new Error(json.error);
  }

  return json.result;
}

async function deleteAnkiNote(noteId) {
  const payload = {
    action: "deleteNotes",
    version: 6,
    params: {
      notes: [noteId]
    }
  };

  const json = await callAnkiConnect(payload);

  if (json.error) {
    throw new Error(json.error);
  }

  return json.result;
}

async function callAnkiConnect(payload) {
    const response = await chrome.runtime.sendMessage({
      type: "ANKI_CONNECT",
      payload
    });
  
    if (!response) {
      throw new Error("background에서 응답이 없습니다.");
    }
  
    if (!response.ok) {
      throw new Error(response.error || "AnkiConnect 호출 실패");
    }
  
    return response.data;
}

async function playElevenLabsTts(text) {
  const settings = await chrome.storage.sync.get([
    "elevenLabsApiKey",
    "elevenLabsVoiceId",
    "elevenLabsModelId"
  ]);

  const apiKey = settings.elevenLabsApiKey;
  const voiceId = settings.elevenLabsVoiceId || "JBFqnCBsd6RMkjVDRZzb";
  const modelId = settings.elevenLabsModelId || "eleven_multilingual_v2";

  const cacheKey = buildAudioCacheKey({
    text,
    voiceId,
    modelId
  });

  const cachedBlob = await getCachedAudio(cacheKey);

  if (cachedBlob) {
    await playAudioBlob(cachedBlob);
    return;
  }

  if (!apiKey) {
    throw new Error("ElevenLabs API Key가 설정되지 않았습니다. 확장 옵션에서 입력하세요.");
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true
        }
      })
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs 호출 실패: ${res.status}\n${body}`);
  }

  const blob = await res.blob();

  await setCachedAudio(cacheKey, {
    blob,
    text,
    voiceId,
    modelId,
    createdAt: Date.now()
  });

  await playAudioBlob(blob);
}

function buildAudioCacheKey({ text, voiceId, modelId }) {
  return [
    normalizeAudioText(text),
    voiceId || "",
    modelId || ""
  ].join("::");
}

function normalizeAudioText(text) {
  return (text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function playAudioBlob(blob) {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
  }

  currentAudioUrl = URL.createObjectURL(blob);

  const audio = new Audio(currentAudioUrl);

  await audio.play();

  await new Promise((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("오디오 재생 실패"));
  });
}

function openAudioDb() {
  if (audioDbPromise) return audioDbPromise;

  audioDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        db.createObjectStore(AUDIO_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return audioDbPromise;
}

async function getCachedAudio(key) {
  const db = await openAudioDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE_NAME, "readonly");
    const store = tx.objectStore(AUDIO_STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result?.blob || null);
    };

    request.onerror = () => reject(request.error);
  });
}

async function setCachedAudio(key, value) {
  const db = await openAudioDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE_NAME, "readwrite");
    const store = tx.objectStore(AUDIO_STORE_NAME);

    const request = store.put({
      key,
      ...value
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}