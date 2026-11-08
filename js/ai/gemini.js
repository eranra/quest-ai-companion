// Cloud AI Engine: Google Gemini 2.5 Flash API
import { AppState } from '../state.js';
import { logDebug } from '../ui/debug_logger.js';
import { getGeminiToolDeclarations, executeTool } from './tools.js';

// Google Gemini API Responsiveness Verification
export async function checkGeminiResponsiveness() {
  if (!AppState.geminiKey || !AppState.geminiKey.trim()) {
    AppState.geminiStatus = 'no-key';
    return { responsive: false, reason: 'No API Key entered in Settings (⚙️)' };
  }

  AppState.geminiStatus = 'checking';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(AppState.geminiKey.trim())}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      AppState.geminiStatus = 'online';
      return { responsive: true, reason: 'Online & Responsive' };
    } else {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || `HTTP ${res.status}`;
      AppState.geminiStatus = 'offline';
      return { responsive: false, reason: msg };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    AppState.geminiStatus = 'offline';
    const msg = err.name === 'AbortError' ? 'Timeout (No response after 6s)' : err.message;
    return { responsive: false, reason: msg };
  }
}

export async function callGeminiAPI(prompt, signal, context = {}) {
  if (!AppState.geminiKey) {
    throw new Error('Google Gemini API key required. Tap ⚙️ Settings to enter your key or switch back to Local Qwen mode.');
  }

  const systemPrompt = context.systemPrompt || "You are a friendly 3D virtual companion speaking directly with the user. Reply concisely, naturally, and warmly in spoken style (1-2 sentences). Avoid markdown formatting, asterisks, or unpronounceable symbols as your reply will be read aloud.";
  const history = context.history || [];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(AppState.geminiKey)}`;

  // Convert conversation history to Gemini multi-turn format
  const contents = [
    ...history.map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }]
    })),
    { role: "user", parts: [{ text: prompt }] }
  ];

  const payload = {
    systemInstruction: {
      parts: [{
        text: systemPrompt
      }]
    },
    tools: getGeminiToolDeclarations(),
    contents
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  // Check for Gemini function call
  const funcCallPart = parts.find(p => p.functionCall);
  if (funcCallPart) {
    const { name, args } = funcCallPart.functionCall;
    logDebug('GEMINI', `Gemini requested tool call: ${name}(${JSON.stringify(args || {})})`);
    const toolExec = await executeTool(name, args || {});

    // Follow-up request with tool output
    const followUpContents = [
      ...contents,
      {
        role: "model",
        parts: [{ functionCall: funcCallPart.functionCall }]
      },
      {
        role: "user",
        parts: [{
          text: `[System Observation: Tool "${name}" executed successfully. Result: ${toolExec.result}. Please respond warmly to the user as the companion in 1-2 spoken sentences acknowledging this.]`
        }]
      }
    ];

    try {
      const res2 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: followUpContents
        }),
        signal
      });

      if (res2.ok) {
        const data2 = await res2.json();
        const text2 = data2.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text2 && text2.trim()) return text2.trim();
      }
    } catch {
      // Fallback cleanly to direct tool result
    }

    return toolExec.result;
  }

  return parts[0]?.text || "I'm listening and ready.";
}

/**
 * Transcribes audio WAV directly using Gemini 2.5 Flash Multimodal Audio API
 */
export async function transcribeAudioWithGemini(base64Wav, signal) {
  if (!AppState.geminiKey) {
    throw new Error('Google Gemini API key required for audio transcription.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(AppState.geminiKey.trim())}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: "audio/wav",
              data: base64Wav
            }
          },
          {
            text: "Transcribe the spoken words in this audio exactly. Output ONLY the transcribed words with standard punctuation and capitalization, nothing else. If the audio is completely silent or unintelligible noise, output an empty string."
          }
        ]
      }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return transcript.trim();
}
