# Web English → Anki

웹페이지에서 영어 단어/표현/문장을 드래그한 뒤 단축키를 누르면, LLM으로 Anki 카드 내용을 생성하고 TTS로 발음을 들려준 뒤 Anki에 자동 저장하는 Chrome 확장 프로그램입니다.
<img width="1526" height="1337" alt="image" src="https://github.com/user-attachments/assets/e5074513-86da-4690-b968-45d5afee45b0" />

## 주요 기능

* 웹페이지에서 영어 단어/표현/문장 드래그 후 단축키로 캡처
* 현재 페이지 우측 하단에 플로팅 패널 표시
* Gemini를 이용해 Anki용 `Front / Back` 자동 생성
* ElevenLabs TTS로 발음 자동 재생
* 생성된 음성 IndexedDB 캐싱
* AnkiConnect를 통해 Anki에 자동 저장
* 저장 완료 후 `저장 취소` 가능
* 줄바꿈을 `<br>`로 변환하여 Anki에서 여러 줄 표시 지원

## 사용 흐름

1. 웹페이지에서 단어 또는 문장을 드래그합니다.
2. 단축키를 누릅니다.
3. 우측 하단에 Anki 카드 패널이 열립니다.
4. 선택한 단어/표현의 발음이 자동으로 2회 재생됩니다.
5. LLM이 `Front / Back`을 생성합니다.
6. 생성이 완료되면 Anki에 자동 저장됩니다.
7. 저장 결과를 확인한 뒤 필요하면 `저장 취소`를 누를 수 있습니다.

## 기본 카드 형식

### Front

```text
Geopolitical

The geopolitical landscape is shifting as nations re-evaluate their supply chains.
```

### Back

```text
지정학적인 (정치와 지리가 결합하여 국가 간의 관계나 전략에 영향을 미치는 것)

단순히 '정치적'인 것이 아니라, 지리적 위치나 자원, 공급망과 얽힌 국가 간의 역학 관계를 말할 때 씁니다.

"We need to assess the geopolitical risks before expanding our operations into that region."
(그 지역으로 사업을 확장하기 전에 지정학적 리스크를 평가해야 합니다.)

- Geopolitics: 지정학
- Strategic rivalry: 전략적 경쟁
- Macro environment: 거시적 환경
```

## 필요 조건

### 1. Chrome 또는 Chromium 기반 브라우저

Chrome 확장 프로그램 Manifest V3 기반입니다.

### 2. Anki Desktop

Anki Desktop이 실행 중이어야 합니다.

### 3. AnkiConnect

AnkiConnect Add-on이 필요합니다.

Anki에서 다음 순서로 설치합니다.

```text
Tools
→ Add-ons
→ Get Add-ons
→ 2055492159 입력
→ 설치 후 Anki 재시작
```

설치 확인:

```text
http://127.0.0.1:8765
```

브라우저에서 접속했을 때 `AnkiConnect` 관련 응답이 보이면 정상입니다.

### 4. Gemini API Key

카드의 `Front / Back`을 생성하는 데 사용합니다.

### 5. ElevenLabs API Key

단어/표현 발음 TTS 생성에 사용합니다.

## 설치 방법

1. 이 저장소를 다운로드합니다.
2. Chrome에서 아래 주소로 이동합니다.

```text
chrome://extensions
```

3. 우측 상단의 `Developer mode`를 켭니다.
4. `Load unpacked`를 클릭합니다.
5. 확장 프로그램 폴더를 선택합니다.
6. 확장 프로그램 옵션 페이지에서 API Key와 Anki 설정을 입력합니다.
7. 단축키 페이지에서 캡처 단축키를 등록합니다.

```text
chrome://extensions/shortcuts
```

추천 단축키:

```text
Alt + S
```

또는

```text
Ctrl + Shift + Y
```

`Ctrl + Shift + S`는 브라우저나 OS 단축키와 충돌할 수 있습니다.

## 설정 항목

확장 프로그램 옵션 페이지에서 다음 값을 설정합니다.

| 항목                  | 설명                     | 예시                       |
| ------------------- | ---------------------- | ------------------------ |
| Gemini API Key      | Gemini 호출용 API Key     | `AIza...`                |
| Gemini Model        | 카드 생성 모델               | `gemini-2.5-flash`       |
| Anki Deck Name      | 저장할 Anki 덱 이름          | `English`                |
| Anki Model Name     | Anki 노트 타입             | `Basic`                  |
| Tags                | 저장할 카드 태그              | `english llm`            |
| ElevenLabs API Key  | ElevenLabs TTS API Key | `sk_...`                 |
| ElevenLabs Voice ID | 사용할 음성 ID              | `JBFqnCBsd6RMkjVDRZzb`   |
| ElevenLabs Model ID | TTS 모델                 | `eleven_multilingual_v2` |

## 권장 Anki 설정

기본 `Basic` 노트 타입을 사용할 경우 필드는 다음 이름이어야 합니다.

```text
Front
Back
```

확장 프로그램은 AnkiConnect를 통해 아래 필드에 값을 저장합니다.

```js
fields: {
  Front: "...",
  Back: "..."
}
```

줄바꿈은 저장 시 `<br>`로 변환됩니다.

## Manifest 권한 예시

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "host_permissions": [
    "http://127.0.0.1:8765/*",
    "http://localhost:8765/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.elevenlabs.io/*"
  ]
}
```

## 프로젝트 구조

```text
web-english-anki-extension/
  manifest.json
  background.js
  content.js
  options.html
  options.js
  README.md
```

## 동작 구조

```text
사용자 드래그 + 단축키
→ background.js에서 선택 텍스트 캡처
→ pendingCard를 "생성 중..." 상태로 저장
→ content.js가 현재 페이지 우측 하단 패널 표시
→ ElevenLabs TTS 자동 재생
→ Gemini로 Front/Back 생성
→ storage 변경을 통해 패널 갱신
→ AnkiConnect로 자동 저장
→ 저장 취소 시 deleteNotes 호출
```

## AnkiConnect 호출 흐름

웹페이지의 content script에서 직접 AnkiConnect를 호출하지 않고, background service worker를 통해 호출합니다.

```text
content.js
→ chrome.runtime.sendMessage
→ background.js
→ fetch("http://127.0.0.1:8765")
→ AnkiConnect
```

이 방식이 웹페이지 CORS나 실행 컨텍스트 문제를 피하는 데 더 안정적입니다.

## 음성 캐싱

ElevenLabs로 생성한 음성은 IndexedDB에 저장됩니다.

캐시 키는 다음 조합으로 생성됩니다.

```text
text + voiceId + modelId
```

따라서 같은 단어라도 voice나 model이 바뀌면 새 음성이 생성됩니다.

## LLM 프롬프트 정책

카드 생성은 다음 방향을 따릅니다.

* 사전식 설명보다 실제 사용 맥락 중심
* 영어 문장, 기사, 문서, 업무 자료, 학습 자료에서 바로 이해할 수 있는 설명 우선
* `Front`는 핵심 단어/표현과 예문 중심
* `Back`은 뜻, 뉘앙스, 실전 예문, 관련 표현 중심
* Markdown 제목, 굵은 글씨, 번호 매기기 지양
* JSON 형식으로 `front`, `back`만 반환

## 문제 해결

### 단축키가 동작하지 않는 경우

```text
chrome://extensions/shortcuts
```

에서 단축키가 실제로 등록되어 있는지 확인합니다.

`Ctrl + Shift + S`는 충돌 가능성이 있으므로 `Alt + S`를 추천합니다.

### Anki 저장이 실패하는 경우

Anki가 실행 중인지 확인합니다.

```text
http://127.0.0.1:8765
```

접속이 안 되면 AnkiConnect가 실행 중이 아닙니다.

확인할 것:

* Anki Desktop 실행 여부
* AnkiConnect 설치 여부
* Anki 재시작 여부
* manifest의 `host_permissions`에 `127.0.0.1:8765` 포함 여부

### 저장은 되는데 줄바꿈이 안 보이는 경우

Anki 저장 전 줄바꿈을 `<br>`로 변환해야 합니다.

```js
function convertToAnkiHtml(text) {
  return text
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");
}
```

### 발음이 4번 들리는 경우

`background.js`에서 `"생성 중..."` 카드를 두 번 보내고 있을 가능성이 큽니다.

원칙:

* `"생성 중..."` 카드는 한 번만 저장/전송
* Gemini 최종 결과는 `storage.onChanged`로만 패널 갱신
* 최종 결과 저장 후 `sendCardToPage()`를 다시 호출하지 않기
* 같은 캡처에 대해 `createdAt`을 유지하기

### 저장 완료 후 다시 생성 중으로 바뀌는 경우

자동 발음 재생을 `await`하면 이전 `"생성 중..."` 카드의 비동기 작업이 늦게 끝나면서 UI를 덮을 수 있습니다.

자동 재생은 기다리지 말고 백그라운드로 실행합니다.

```js
if (shouldAutoPlay) {
  autoPlayOnce(card).catch((error) => {
    console.warn("자동 발음 재생 실패:", error);
  });
}
```

## 개발 메모

### 권장 모델

빠른 응답이 중요하면:

```text
gemini-2.5-flash-lite
```

품질과 안정성이 더 중요하면:

```text
gemini-2.5-flash
```

### 자동 저장 UX

상태는 다음처럼 분리하는 것을 권장합니다.

```text
generating: 생성 중
saving: Anki 저장 중
saved: 저장 완료, 저장 취소 버튼 표시
unsaved: 저장 실패 또는 저장 취소 후, 수동 저장 버튼 표시
```

## 주의사항

* API Key는 개인용 로컬 확장에서는 옵션에 저장해도 되지만, 배포용이라면 별도 서버나 프록시로 분리하는 것이 안전합니다.
* AnkiConnect는 Anki Desktop이 실행 중일 때만 동작합니다.
* 웹페이지에 직접 UI를 주입하므로, Shadow DOM으로 스타일을 격리하는 것을 권장합니다.
* 자동 재생은 브라우저 정책에 따라 차단될 수 있습니다. 이 경우 `발음` 버튼으로 수동 재생하면 됩니다.
