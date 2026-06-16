const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function resolveGeminiModel(modelName) {
  const name = (modelName || "").trim().replace(/^models\//, "");
  if (name.startsWith("gemini-")) return name;
  return DEFAULT_GEMINI_MODEL;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const { modelName } = await chrome.storage.sync.get("modelName");
  const resolved = resolveGeminiModel(modelName);
  if (modelName && modelName !== resolved) {
    await chrome.storage.sync.set({ modelName: resolved });
  }

  if (details.reason === "install") {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-selection") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const [{ result: selection }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection().toString().trim()
  });

  const createdAt = Date.now();

  if (!selection) {
    await chrome.storage.local.set({
      pendingCard: {
        front: "",
        back: "드래그된 문장이 없습니다.",
        ttsText: "",
        sourceUrl: tab.url,
        createdAt
      }
    });

    await sendCardToPage(tab.id);
    return;
  }

  // 생성 중 카드는 딱 1번만 저장/전송
  await chrome.storage.local.set({
    pendingCard: {
      front: selection,
      back: "생성 중...",
      ttsText: selection,
      sourceUrl: tab.url,
      createdAt
    }
  });

  await sendCardToPage(tab.id);

  const settings = await chrome.storage.sync.get([
    "geminiApiKey",
    "modelName",
    "promptStyle"
  ]);

  const card = await generateCard({
    sentence: selection,
    apiKey: settings.geminiApiKey,
    modelName: resolveGeminiModel(settings.modelName),
    promptStyle: settings.promptStyle || "economist"
  });

  // 최종 카드 저장. 같은 createdAt 유지.
  // sendCardToPage 호출하지 않음. storage.onChanged가 UI 갱신함.
  await chrome.storage.local.set({
    pendingCard: {
      front: card.front,
      back: card.back,
      ttsText: selection,
      sourceUrl: tab.url,
      createdAt
    }
  });
});

async function sendCardToPage(tabId) {
  const { pendingCard } = await chrome.storage.local.get("pendingCard");

  await chrome.tabs.sendMessage(tabId, {
    type: "SHOW_ANKI_PANEL",
    card: pendingCard
  });
}

async function generateCard({ sentence, apiKey, modelName, promptStyle }) {
  if (!apiKey) {
    return {
      front: sentence,
      back: "Gemini API Key가 설정되지 않았습니다. 확장 옵션에서 입력하세요."
    };
  }

  const prompt = buildPrompt(sentence, promptStyle || "economist");
  const model = resolveGeminiModel(modelName);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.3
        }
      })
    }
  );

  if (!res.ok) {
    const body = await res.text();

    if (res.status === 404) {
      return {
        front: sentence,
        back: `Gemini 모델을 찾을 수 없습니다 (${model}). 옵션에서 gemini-2.5-flash 등 Gemini 모델명을 입력하세요.\n${body}`
      };
    }

    return {
      front: sentence,
      back: `Gemini 호출 실패: ${res.status} ${body}`
    };
  }

  const json = await res.json();

  const text =
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "";

  const cleanedText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const card = JSON.parse(cleanedText);

    return {
      front: normalizeCardText(card.front) || sentence,
      back: normalizeCardText(card.back) || "Gemini 응답 파싱 실패"
    };
  } catch (e) {
    return {
      front: sentence,
      back: cleanedText || "Gemini 응답 없음"
    };
  }
}

function normalizeCardText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildPrompt(sentence, promptStyle) {
  return `
너는 영어 학습용 Anki 카드를 만드는 도우미다.

사용자가 드래그한 영어 단어/표현/문장을 바탕으로 Anki 카드의 front와 back을 만들어라.

사용자 목표:
- The Economist 같은 시사/비즈니스 영어를 공부한다.
- 단어를 단순 암기하는 것이 아니라, 기사/업무/투자/리스크 분석 맥락에서 쓸 수 있게 익힌다.
- 설명은 짧고 실용적이어야 한다.

front 작성 규칙:
- 첫 줄: 핵심 단어 또는 표현
- 둘째 줄: 해당 단어/표현이 들어간 자연스러운 영어 예문 1개
- 사용자가 단어 하나만 입력했다면, 그 단어에 맞는 예문을 직접 만든다.
- 사용자가 문장을 입력했다면, 문장 안에서 가장 학습 가치가 큰 단어/표현을 골라 첫 줄에 쓰고, 둘째 줄에는 원문 문장을 최대한 활용한다.
- 단어 첫 글자는 대문자로 쓴다.
- front에는 설명을 넣지 마라.

back 작성 규칙:
- 첫 줄: 가장 자연스러운 한국어 뜻 + 괄호 안 짧은 의미 설명
- 그다음 문단: 뉘앙스 설명 2~3문장
- 그다음 문단: 실무/기사에서 쓸 법한 영어 예문 1개와 한국어 해석
- 마지막: 관련 표현 3개
- back은 한국어 중심으로 작성한다.
- Markdown 제목, 굵은 글씨, 번호 매기기를 쓰지 마라.
- 너무 사전처럼 쓰지 말고, 실제 사용 맥락을 설명해라.
- The Economist/비즈니스/경제/국제정세/투자/업무/리스크 분석 맥락을 우선한다.
- 전체 back은 10줄 안팎으로 압축한다.

반드시 아래 JSON 형식만 출력해라.
Markdown 코드블록을 쓰지 마라.
JSON key는 front, back만 사용해라.
문자열 안의 줄바꿈은 \\n으로 표현해라.

출력 예시:
{
  "front": "Geopolitical\\nThe geopolitical landscape is shifting as nations re-evaluate their supply chains.",
  "back": "지정학적인 (정치와 지리가 결합하여 국가 간의 관계나 전략에 영향을 미치는 것)\\n\\n단순히 '정치적'인 것이 아니라, 지리적 위치나 자원, 공급망과 얽힌 국가 간의 역학 관계를 말할 때 씁니다. 해외 진출, 공급망 재편, 리스크 분석, 시장 진출 전략 논의에서 자주 등장하는 단어입니다.\\n\\n\\"We need to assess the geopolitical risks before expanding our operations into that region.\\"\\n(그 지역으로 사업을 확장하기 전에 지정학적 리스크를 평가해야 합니다.)\\n\\n- Geopolitics: 지정학\\n- Strategic rivalry: 전략적 경쟁\\n- Macro environment: 거시적 환경"
}

입력:
${sentence}
`.trim();
}

async function openEditorWindow() {
  const url = chrome.runtime.getURL("popup.html");

  await chrome.windows.create({
    url,
    type: "popup",
    width: 780,
    height: 900
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "ANKI_CONNECT") return;

  callAnkiConnectFromBackground(message.payload)
    .then((data) => {
      sendResponse({
        ok: true,
        data
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

  return true;
});

async function callAnkiConnectFromBackground(payload) {
  let res;

  try {
    res = await fetch("http://127.0.0.1:8765", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    throw new Error(
      "AnkiConnect에 연결할 수 없습니다. Anki가 켜져 있는지, AnkiConnect가 설치되어 있는지 확인하세요."
    );
  }

  const json = await res.json();

  return json;
}