const fields = [
  "geminiApiKey",
  "modelName",
  "deckName",
  "modelNameForAnki",
  "tags",
  "promptStyle",
  "elevenLabsApiKey",
  "elevenLabsVoiceId",
  "elevenLabsModelId"
];

const defaults = {
  modelName: "gemini-2.5-flash",
  deckName: "Default",
  modelNameForAnki: "Basic",
  tags: "economist llm",
  promptStyle: "economist",
  elevenLabsVoiceId: "Gfpl8Yo74Is0W6cPUWWT",
  elevenLabsModelId: "eleven_multilingual_v2"
};

function resolveGeminiModel(modelName) {
  const name = (modelName || "").trim().replace(/^models\//, "");
  if (name.startsWith("gemini-")) return name;
  return defaults.modelName;
}

async function load() {
  const settings = await chrome.storage.sync.get(fields);

  for (const field of fields) {
    let value = settings[field] || defaults[field] || "";
    if (field === "modelName") {
      value = resolveGeminiModel(value);
      if (settings.modelName && settings.modelName !== value) {
        await chrome.storage.sync.set({ modelName: value });
      }
    }
    document.getElementById(field).value = value;
  }
}

document.getElementById("openShortcuts").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

document.getElementById("save").addEventListener("click", async () => {
  const payload = {};

  for (const field of fields) {
    payload[field] = document.getElementById(field).value.trim();
  }

  await chrome.storage.sync.set(payload);
  document.getElementById("status").textContent = "Saved";
});

load();
