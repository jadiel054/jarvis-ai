export interface AIKeys {
  claude: string;
  groq: string;
  gemini: string;
  openrouter: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MODELS = [
  {
    id: 'claude',
    name: 'Claude Sonnet',
    call: async (messages: AIMessage[], systemPrompt: string, keys: AIKeys) => {
      if (!keys.claude) throw new Error('no key');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': keys.claude,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: systemPrompt,
          messages: messages.slice(-20),
        }),
      });
      if (!r.ok) throw new Error(`Claude ${r.status}`);
      const d = await r.json();
      return d.content?.[0]?.text || '';
    },
  },
  {
    id: 'groq',
    name: 'Groq Llama',
    call: async (messages: AIMessage[], systemPrompt: string, keys: AIKeys) => {
      if (!keys.groq) throw new Error('no key');
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keys.groq}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1500,
          messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-20)],
        }),
      });
      if (!r.ok) throw new Error(`Groq ${r.status}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content || '';
    },
  },
  {
    id: 'gemini',
    name: 'Gemini Flash',
    call: async (messages: AIMessage[], systemPrompt: string, keys: AIKeys) => {
      if (!keys.gemini) throw new Error('no key');
      const contents = messages.slice(-20).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keys.gemini}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
          }),
        }
      );
      if (!r.ok) throw new Error(`Gemini ${r.status}`);
      const d = await r.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    call: async (messages: AIMessage[], systemPrompt: string, keys: AIKeys) => {
      if (!keys.openrouter) throw new Error('no key');
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keys.openrouter}`,
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-7b-instruct',
          max_tokens: 1500,
          messages: [{ role: 'system', content: systemPrompt }, ...messages.slice(-20)],
        }),
      });
      if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content || '';
    },
  },
];

export const callAI = async (
  messages: AIMessage[],
  systemPrompt: string,
  keys: AIKeys,
  onModelUsed?: (name: string) => void
): Promise<string> => {
  for (const model of MODELS) {
    try {
      const result = await model.call(messages, systemPrompt, keys);
      if (result) {
        onModelUsed?.(model.name);
        return result;
      }
    } catch (e: unknown) {
      console.warn(`[JARVIS] ${model.name} falhou:`, (e as Error).message);
    }
  }
  return 'Nenhum modelo disponível. Configure as chaves em Integrações.';
};

// Test individual key validity
export const testKey = async (keyType: string, keyValue: string): Promise<boolean> => {
  if (!keyValue.trim()) return false;
  try {
    if (keyType === 'claudeKey') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': keyValue,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      return r.status !== 401 && r.status !== 403;
    }
    if (keyType === 'groqKey') {
      const r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${keyValue}` },
      });
      return r.ok;
    }
    if (keyType === 'geminiKey') {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${keyValue}`
      );
      return r.ok;
    }
    if (keyType === 'openrouterKey') {
      const r = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${keyValue}` },
      });
      return r.ok;
    }
    if (keyType === 'elevenKey') {
      const r = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': keyValue },
      });
      return r.ok;
    }
    if (keyType === 'weatherKey') {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${keyValue}`
      );
      return r.ok;
    }
    if (keyType === 'tavilyKey') {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: keyValue, query: 'test', max_results: 1 }),
      });
      return r.ok;
    }
    if (keyType === 'githubToken') {
      const r = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${keyValue}` },
      });
      return r.ok;
    }
    if (keyType === 'vercelToken') {
      const r = await fetch('https://api.vercel.com/v2/user', {
        headers: { Authorization: `Bearer ${keyValue}` },
      });
      return r.ok;
    }
    if (keyType === 'renderToken') {
      const r = await fetch('https://api.render.com/v1/services?limit=1', {
        headers: { Authorization: `Bearer ${keyValue}` },
      });
      return r.ok;
    }
    if (keyType === 'supabaseUrl') {
      const r = await fetch(`${keyValue}/rest/v1/`);
      return r.status !== 404;
    }
    return true;
  } catch {
    return false;
  }
};
