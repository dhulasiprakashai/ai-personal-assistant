# Aura Step 6 — Voice Assistant Architecture Plan

This document outlines the architecture, technologies, and implementation plan for adding a real-time Voice Assistant to Aura while preserving all existing functionalities (conversations, memory persistence, tools loop, and security guards).

---

## 1. Recommended Architecture

The Voice Assistant will utilize a hybrid model:
1. **Client-Side Native Processing**: Browser-native Web Speech APIs for low-latency Speech-to-Text (STT) and Text-to-Speech (TTS).
2. **Standard API Communication**: Transcribed voice queries are sent directly as text payloads to the existing `/api/chat` endpoint, ensuring all server-side tools, memories, and loop protections run transparently.
3. **Interruptible Audio Channel**: A client-side audio playback coordinator that cancels TTS synthesis instantly if the user speaks, clicks stop, or starts typing.

```mermaid
graph TD
    User([User Voice]) -->|Browser Mic| STT[Web Speech Recognition]
    STT -->|Transcribed Text| ChatUI[ChatInterface component]
    ChatUI -->|POST Text Request| API[/api/chat]
    API -->|Agent Loop / Tools| Gemini[Gemini Engine]
    Gemini -->|Text Response| API
    API -->|JSON Content Response| ChatUI
    ChatUI -->|Speak Response Text| TTS[SpeechSynthesis UTTERANCE]
    TTS -->|Voice Output| Speaker([Speaker / Headset])
    User -->|Interruption Event| AudioMute[SpeechSynthesis.cancel]
```

---

## 2. Technology Selection

### Speech-to-Text (STT)
* **Recommended Choice (Free/Low-Latency)**: Browser-native `webkitSpeechRecognition` / `SpeechRecognition` API.
  * **Pros**: 100% free, runs locally in browser with near-zero latency, automatically processes speech pauses.
  * **Fallback**: Google Cloud Speech-to-Text API or OpenAI Whisper API (server-side via file upload) if client browser compatibility fails.

### Text-to-Speech (TTS)
* **Recommended Choice (Free/Low-Latency)**: Browser-native `SpeechSynthesisUtterance` API.
  * **Pros**: 100% free, zero configuration, instant execution, custom pitch/rate controls.
  * **Premium Alternative**: OpenAI TTS (`tts-1` model) or ElevenLabs API for high-fidelity human voices.

---

## 3. Phase-by-Phase Implementation Plan

### Phase 1: Client Audio Coordinator Setup
- Create a client-side Audio controller utility (`src/lib/audio/speechCoordinator.ts`) wrapper for `window.speechSynthesis` and `SpeechRecognition` to manage active microphone hooks and voices cleanly.
- Implement play, pause, and force-stop hooks.

### Phase 2: Speech-to-Text (Mic Component)
- Add a new microphone button and pulsating waveform status element inside `ChatInput.tsx`.
- Bind voice activation triggers and append transcribed statements into the chat input input box or auto-submit them.

### Phase 3: Text-to-Speech (Speaker Toggle)
- Add a speaker toggle button in the header of `ChatInterface.tsx` (mute/unmute state).
- Whenever a text response returns from `/api/chat` and speaker is unmuted, speak the response.

### Phase 4: Interruption & Continuous Flow
- Register event listeners: if the user clicks the microphone button, starts typing, or triggers a keydown action while Aura is speaking, invoke `window.speechSynthesis.cancel()` immediately to pause audio output.
- Support "Continuous Voice Mode" where the microphone auto-restarts listening after Aura finishes speaking.

---

## 4. Exact Files to Modify/Create

### Modify
* [`src/components/chat/ChatInput.tsx`](file:///d:/Projects/ai-personal-assistant/src/components/chat/ChatInput.tsx): Add mic button controls and hook speech recognition transcription.
* [`src/components/chat/ChatInterface.tsx`](file:///d:/Projects/ai-personal-assistant/src/components/chat/ChatInterface.tsx): Add audio speaker controls, volume/mute state toggles, and synthesize audio feedback upon receiving bot response.

### New
* `src/lib/audio/speechCoordinator.ts`: Client audio coordinator managing Web Speech API compatibility and fallbacks.

---

## 5. Security & Privacy Risks
* **Microphone Access**: Explicit user permissions must be requested and handled gracefully.
* **No Secret Leaking**: By using browser-native APIs, no external API keys (ElevenLabs, etc.) are required, keeping credentials safe on the server-side.
* **Payload Sanitation**: Transcribed speech strings will be routed through the exact same server-side length filters and SQL injection blocks in `/api/chat`.

---

## 6. Risks, Latency, & Limitations
* **Browser Compatibility**: Native Web Speech API operates best in Webkit-based browsers (Chrome, Safari, Edge) but has limited offline dictionary capabilities in Firefox.
* **Voice Variability**: Synthetic voice accents vary depending on the host operating system (Windows voices vs macOS Siri voices).
* **Interruption Delay**: The microphone auto-listening must ignore Aura's own speaker output to prevent feedback echo loops.
