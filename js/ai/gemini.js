// Cloud AI Engine: Google Gemini 2.5 Flash API
import { AppState } from '../state.js';

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

export async function callGeminiAPI(prompt, signal) {
  if (!AppState.geminiKey) {
    throw new Error('Google Gemini API key required. Tap ⚙️ Settings to enter your key or switch back to Local Qwen mode.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(AppState.geminiKey)}`;

  const payload = {
    systemInstruction: {
      parts: [{
        text: "You are a friendly 3D virtual companion speaking directly with the user. Reply concisely, naturally, and warmly in spoken style (1-2 sentences). Avoid markdown formatting, asterisks, or unpronounceable symbols as your reply will be read aloud."
      }]
    },
    contents: [
      { role: "user", parts: [{ text: prompt }] }
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
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm listening and ready.";
}
