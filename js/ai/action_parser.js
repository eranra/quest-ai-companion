// Action Parser for Model Output Streams
// Extracts and parses action tags e.g. [ACTION: change_space(garden)] from model responses

/**
 * Extracts and executes any action tags emitted by the model: [ACTION: tool_name(param)]
 * Strips the action tag from spoken text so TTS doesn't read the code aloud.
 * 
 * @param {string} rawText The raw text output from the language model
 * @param {Function} executeToolFn Execution handler for individual tool actions
 * @returns {Promise<{ cleanText: string, actions: Array<{ toolName: string, param: string }> }>}
 */
export async function processActionTags(rawText, executeToolFn) {
  if (!rawText || typeof rawText !== 'string') return { cleanText: rawText, actions: [] };

  const actionRegex = /\[ACTION:\s*([a-zA-Z0-9_]+)(?:\(([^)]*)\))?\]/gi;
  let match;
  const actions = [];
  let cleanText = rawText;

  while ((match = actionRegex.exec(rawText)) !== null) {
    const toolName = match[1];
    const rawParam = (match[2] || '').trim().replace(/['"]/g, '');
    actions.push({ toolName, param: rawParam });

    // Execute the action if executor callback provided
    if (typeof executeToolFn === 'function') {
      let args = {};
      if (toolName === 'change_space') args = { space: rawParam };
      else if (toolName === 'change_avatar') args = { avatar: rawParam };
      else if (toolName === 'avatar_gesture') args = { gesture: rawParam };
      else if (toolName === 'avatar_move') {
        const parts = rawParam.split(',').map(s => s.trim());
        args = { direction: parts[0] || 'forward', style: parts[1] || 'walk' };
      } else if (toolName === 'avatar_freestyle') {
        args = { enabled: rawParam !== 'false' && rawParam !== 'off' && rawParam !== '0' };
      }
      try {
        await executeToolFn(toolName, args);
      } catch (err) {
        console.warn(`[ActionParser] Could not execute action ${toolName}:`, err);
      }
    }
  }

  // Strip all [ACTION: ...] tags from the text and normalize multiple spaces
  cleanText = cleanText.replace(actionRegex, '').replace(/\s{2,}/g, ' ').trim();

  return { cleanText, actions };
}
