import { useState, useEffect, useRef, useCallback } from 'react';
import { callAI, AIMessage } from '../lib/aiRouter';
import { githubAgent, vercelAgent, renderAgent, tavilySearch, parseAgentIntent } from '../lib/agent';

export const PLAN_LIMITS: Record<string, number> = { free: 30, pro: 200, ultra: Infinity };

const JOKES = [
  'Por que o programador usa óculos? Porque ele não consegue C#! 😄',
  'O que é um arquivo perdido? Um arquivo achado sem diretório! 😂',
  'Por que JavaScript é tão ansioso? Porque ele tem Promise demais! 🤣',
];
const MOTIVATIONAL = [
  'A persistência é o caminho do êxito. — Charles Chaplin',
  'O sucesso é a soma de pequenos esforços repetidos dia após dia.',
  'A única maneira de fazer um excelente trabalho é amar o que você faz. — Steve Jobs',
];
const ZODIAC_SIGNS = [
  { sign: 'Capricórnio', emoji: '♑', end: [1, 19] },
  { sign: 'Aquário', emoji: '♒', end: [2, 18] },
  { sign: 'Peixes', emoji: '♓', end: [3, 20] },
  { sign: 'Áries', emoji: '♈', end: [4, 19] },
  { sign: 'Touro', emoji: '♉', end: [5, 20] },
  { sign: 'Gêmeos', emoji: '♊', end: [6, 20] },
  { sign: 'Câncer', emoji: '♋', end: [7, 22] },
  { sign: 'Leão', emoji: '♌', end: [8, 22] },
  { sign: 'Virgem', emoji: '♍', end: [9, 22] },
  { sign: 'Libra', emoji: '♎', end: [10, 22] },
  { sign: 'Escorpião', emoji: '♏', end: [11, 21] },
  { sign: 'Sagitário', emoji: '♐', end: [12, 21] },
  { sign: 'Capricórnio', emoji: '♑', end: [12, 31] },
] as const;

export const getZodiac = (birthday: string) => {
  if (!birthday) return null;
  const parts = birthday.split('-').map(Number);
  const m = parts[1];
  const d = parts[2];
  return ZODIAC_SIGNS.find(({ end: [em, ed] }) => m < em || (m === em && d <= ed)) || ZODIAC_SIGNS[0];
};

export const formatTime = (date: Date) =>
  date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const formatDate = () =>
  new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

export const detectSentiment = (text: string) => {
  const t = text.toLowerCase();
  if (/triste|chateado|mal|ruim|odeio|raiva/.test(t)) return '😢';
  if (/feliz|ótimo|incrível|perfeito|adorei|amei/.test(t)) return '😊';
  if (/ajuda|problema|erro|bug/.test(t)) return '😰';
  if (/obrigado|valeu|grat/.test(t)) return '🙏';
  if (/github|vercel|deploy|repo/.test(t)) return '⚡';
  return '💬';
};

const tryMath = (text: string) => {
  const m = text.match(/calcul[ae].*?([\d\s+\-*/().]+)/i);
  if (!m) return null;
  try {
    const r = Function(`"use strict";return(${m[1]})`)();
    return isFinite(r) ? `Resultado: **${r}**` : null;
  } catch {
    return null;
  }
};

const tryConvert = (text: string) => {
  const t = text.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/(\d+\.?\d*)\s*km\s*(em|para)\s*milhas?/))) return `${m[1]} km = **${(+m[1] * 0.621371).toFixed(2)} milhas**`;
  if ((m = t.match(/(\d+\.?\d*)\s*milhas?\s*(em|para)\s*km/))) return `${m[1]} mi = **${(+m[1] / 0.621371).toFixed(2)} km**`;
  if ((m = t.match(/(\d+\.?\d*)\s*kg\s*(em|para)\s*lb/))) return `${m[1]} kg = **${(+m[1] * 2.20462).toFixed(2)} lbs**`;
  if ((m = t.match(/(\d+\.?\d*)\s*°?c\s*(em|para)\s*f/i))) return `${m[1]}°C = **${(+m[1] * 9 / 5 + 32).toFixed(1)}°F**`;
  if ((m = t.match(/(\d+\.?\d*)\s*°?f\s*(em|para)\s*c/i))) return `${m[1]}°F = **${((+m[1] - 32) * 5 / 9).toFixed(1)}°C**`;
  return null;
};

export interface JarvisConfig {
  userName: string;
  birthday: string;
  city: string;
  plan: string;
  theme: string;
  voiceStyle: string;
  voiceId: string;
  claudeKey: string;
  groqKey: string;
  geminiKey: string;
  openrouterKey: string;
  elevenKey: string;
  weatherKey: string;
  tavilyKey: string;
  greptileKey: string;
  githubToken: string;
  vercelToken: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  renderToken: string;
}

const DEFAULT_CONFIG: JarvisConfig = {
  userName: 'Jadiel', birthday: '', city: 'Xanxerê', plan: 'free', theme: 'cyan',
  voiceStyle: 'natural', voiceId: 'LRa1p5inXEqY5UoYDUk2',
  claudeKey: '', groqKey: '', geminiKey: '', openrouterKey: '', elevenKey: '',
  weatherKey: '', tavilyKey: '', greptileKey: '',
  githubToken: '', vercelToken: '', supabaseUrl: '', supabaseServiceKey: '', renderToken: '',
};

export interface JarvisMessage extends AIMessage {
  id: number;
  time: string;
  sentiment: string;
  modelUsed?: string;
}

export interface AgentLog {
  id: number;
  platform: string;
  action: string;
  time: string;
  status: 'running' | 'success' | 'error';
}

export interface UploadedFile {
  name: string;
  type: string;
  url: string;
}

export interface Task {
  id: number;
  text: string;
  done: boolean;
}

export interface Note {
  id: number;
  name: string;
  text: string;
  time: string;
}

export interface Reminder {
  id: number;
  time: string;
  text: string;
  fired: boolean;
}

export const BOOT_STEPS = [
  'Inicializando núcleo quântico...',
  'Carregando módulos de IA...',
  'Conexão neural estabelecida...',
  'Protocolos de segurança ativos...',
  'Sistema JARVIS pronto.',
];

export const useJarvis = () => {
  const [screen, setScreen] = useState<'splash' | 'boot' | 'chat'>('splash');
  const [bootStep, setBootStep] = useState(0);
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number; desc: string; humidity: number; city: string } | null>(null);
  const [config, setConfig] = useState<JarvisConfig>(DEFAULT_CONFIG);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [msgCount, setMsgCount] = useState(0);
  const [lastModelUsed, setLastModelUsed] = useState('');
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const c = localStorage.getItem('jarvis_config'); if (c) setConfig(JSON.parse(c));
    const t = localStorage.getItem('jarvis_tasks'); if (t) setTasks(JSON.parse(t));
    const n = localStorage.getItem('jarvis_notes'); if (n) setNotes(JSON.parse(n));
    const r = localStorage.getItem('jarvis_reminders'); if (r) setReminders(JSON.parse(r));
    const cnt = localStorage.getItem('jarvis_msgcount_' + new Date().toDateString());
    if (cnt) setMsgCount(+cnt);
  }, []);

  const saveConfig = useCallback((c: JarvisConfig) => {
    setConfig(c);
    localStorage.setItem('jarvis_config', JSON.stringify(c));
  }, []);
  const saveTasks = useCallback((t: Task[]) => { setTasks(t); localStorage.setItem('jarvis_tasks', JSON.stringify(t)); }, []);
  const saveNotes = useCallback((n: Note[]) => { setNotes(n); localStorage.setItem('jarvis_notes', JSON.stringify(n)); }, []);
  const saveReminders = useCallback((r: Reminder[]) => { setReminders(r); localStorage.setItem('jarvis_reminders', JSON.stringify(r)); }, []);

  useEffect(() => { const i = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(i); }, []);

  useEffect(() => {
    const i = setInterval(() => {
      const now = formatTime(new Date()).slice(0, 5);
      reminders.forEach((r) => {
        if (!r.fired && r.time === now) {
          addJarvisMessage(`Lembrete: ${r.text}`);
          saveReminders(reminders.map((x) => (x.id === r.id ? { ...x, fired: true } : x)));
        }
      });
    }, 30000);
    return () => clearInterval(i);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders]);

  const fetchWeather = useCallback(async () => {
    const { weatherKey, city } = configRef.current;
    if (!weatherKey || !city) return;
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${weatherKey}&units=metric&lang=pt_br`
      );
      const d = await r.json();
      if (d.main) setWeather({ temp: Math.round(d.main.temp), desc: d.weather[0].description, humidity: d.main.humidity, city: d.name });
    } catch { /* ignore */ }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (configRef.current.voiceStyle === 'off') return;
    const clean = text.replace(/\*\*/g, '').replace(/[#\-`►]/g, '').slice(0, 400);
    const { elevenKey, voiceId } = configRef.current;
    if (!elevenKey) {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'pt-BR'; u.rate = 0.95;
      u.onstart = () => setIsSpeaking(true);
      u.onend = () => setIsSpeaking(false);
      speechSynthesis.speak(u);
      return;
    }
    setIsSpeaking(true);
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenKey },
        body: JSON.stringify({ text: clean, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch { setIsSpeaking(false); }
  }, []);

  const toggleListen = useCallback(() => {
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
               (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) { alert('Navegador não suporta voz.'); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const r = new SR();
    r.lang = 'pt-BR';
    r.onresult = (e: SpeechRecognitionEvent) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    recognitionRef.current = r; r.start(); setIsListening(true);
  }, [isListening]);

  const addJarvisMessage = useCallback((content: string, extra: Partial<JarvisMessage> = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), role: 'assistant', content, time: formatTime(new Date()), sentiment: detectSentiment(content), ...extra },
    ]);
  }, []);

  const executeAgentAction = useCallback(async (intent: ReturnType<typeof parseAgentIntent>, text: string): Promise<string> => {
    if (!intent) return '';
    const { githubToken, vercelToken, renderToken, tavilyKey } = configRef.current;
    const logEntry: AgentLog = { id: Date.now(), platform: intent.platform, action: intent.action, time: formatTime(new Date()), status: 'running' };
    setAgentLogs((prev) => [logEntry, ...prev.slice(0, 49)]);
    try {
      let reply = '';
      if (intent.platform === 'github') {
        if (!githubToken) return '⚠️ Configure o **GitHub Token** em Integrações.';
        const rm = text.match(/([a-z0-9_.-]+)\/([a-z0-9_.-]+)/i);
        const owner = rm?.[1] || 'jadiel054';
        const repo = rm?.[2];
        if (intent.action === 'listRepos') {
          const r = await githubAgent.listRepos(githubToken);
          reply = `📦 **Repos:**\n${(r as {full_name:string;language:string;stargazers_count:number}[]).slice(0, 10).map((x) => `• **${x.full_name}** — ${x.language || 'N/A'} ⭐${x.stargazers_count}`).join('\n')}`;
        } else if (intent.action === 'createRepo') {
          const nm = text.match(/cri(?:a|ar)\s+repo\s+([a-z0-9_-]+)/i);
          const name = nm?.[1] || 'novo-repo';
          const r = await githubAgent.createRepo(githubToken, name) as {html_url?:string;full_name?:string};
          reply = r.html_url ? `✅ Repo **${r.full_name}** criado!\n🔗 ${r.html_url}` : `❌ Erro ao criar repo`;
        } else if (intent.action === 'listIssues' && repo) {
          const r = await githubAgent.listIssues(githubToken, owner, repo) as {number:number;title:string}[];
          reply = r.length ? `🐛 **Issues em ${owner}/${repo}:**\n${r.slice(0, 8).map((i) => `• #${i.number} ${i.title}`).join('\n')}` : '✅ Nenhuma issue aberta!';
        } else if (intent.action === 'getCommits' && repo) {
          const r = await githubAgent.getCommits(githubToken, owner, repo) as {sha:string;commit:{message:string}}[];
          reply = `📝 **Commits em ${owner}/${repo}:**\n${r.slice(0, 8).map((c) => `• \`${c.sha.slice(0, 7)}\` ${c.commit.message.split('\n')[0]}`).join('\n')}`;
        } else if (intent.action === 'listBranches' && repo) {
          const r = await githubAgent.listBranches(githubToken, owner, repo) as {name:string}[];
          reply = `🌿 **Branches:**\n${r.map((b) => `• ${b.name}`).join('\n')}`;
        } else {
          reply = 'Especifique o repo. Ex: "ver commits de jadiel054/jarvis-ai"';
        }
      } else if (intent.platform === 'vercel') {
        if (!vercelToken) return '⚠️ Configure o **Vercel Token** em Integrações.';
        if (intent.action === 'listProjects') {
          const r = await vercelAgent.listProjects(vercelToken) as {projects:{name:string}[]};
          reply = `🚀 **Projetos Vercel:**\n${(r.projects || []).slice(0, 10).map((x) => `• **${x.name}**`).join('\n')}`;
        } else if (intent.action === 'listDeployments') {
          const r = await vercelAgent.listDeployments(vercelToken) as {deployments:{name:string;state:string}[]};
          reply = `📋 **Deploys:**\n${(r.deployments || []).slice(0, 8).map((x) => `• **${x.name}** — ${x.state}`).join('\n')}`;
        }
      } else if (intent.platform === 'render') {
        if (!renderToken) return '⚠️ Configure o **Render Token** em Integrações.';
        const r = await renderAgent.listServices(renderToken) as {service:{name:string;suspended:boolean}}[];
        const s = Array.isArray(r) ? r : [];
        reply = `🖥️ **Serviços Render:**\n${s.slice(0, 10).map((x) => `• **${x.service?.name}** — ${x.service?.suspended ? '⏸' : '▶'}`).join('\n')}`;
      } else if (intent.platform === 'tavily') {
        if (!tavilyKey) return '⚠️ Configure a **Tavily Key** em Integrações.';
        const r = await tavilySearch(tavilyKey, text) as {results:{title:string;url:string}[]};
        reply = `🔍 **Resultados:**\n${(r.results || []).slice(0, 5).map((x) => `• **${x.title}**\n  ${x.url}`).join('\n\n')}`;
      }
      setAgentLogs((prev) => prev.map((l) => (l.id === logEntry.id ? { ...l, status: 'success' } : l)));
      return reply || '✅ Concluído!';
    } catch (e: unknown) {
      setAgentLogs((prev) => prev.map((l) => (l.id === logEntry.id ? { ...l, status: 'error' } : l)));
      return `❌ Erro: ${(e as Error).message}`;
    }
  }, []);

  const sendMessage = useCallback(async (text = input) => {
    if (!text.trim()) return;

    // Always read directly from localStorage to get the most current keys,
    // bypassing any React state update lag.
    const currentConfig: JarvisConfig = JSON.parse(localStorage.getItem('jarvis_config') || '{}');
    const mergedConfig = { ...configRef.current, ...currentConfig };

    const limit = PLAN_LIMITS[mergedConfig.plan] || 30;
    if (msgCount >= limit) {
      addJarvisMessage(`⚠️ Limite do plano **${mergedConfig.plan.toUpperCase()}** atingido!`);
      return;
    }
    const userMsg: JarvisMessage = {
      id: Date.now(), role: 'user', content: text,
      time: formatTime(new Date()), sentiment: detectSentiment(text),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setUploadedFiles([]);
    const newCount = msgCount + 1;
    setMsgCount(newCount);
    localStorage.setItem('jarvis_msgcount_' + new Date().toDateString(), String(newCount));

    const tl = text.toLowerCase();
    let localReply: string | null = null;

    if (/lembrete/.test(tl)) {
      const m = text.match(/(\d{2}:\d{2})/);
      const what = text.replace(/lembrete|às?|as\s+\d{2}:\d{2}/gi, '').trim();
      if (m && what) {
        saveReminders([...reminders, { id: Date.now(), time: m[1], text: what, fired: false }]);
        localReply = `✅ Lembrete para **${m[1]}**: ${what}`;
      }
    }
    if (/piada/.test(tl)) localReply = JOKES[Math.floor(Math.random() * JOKES.length)];
    if (/motivac|inspira/.test(tl)) localReply = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
    if (/clima|tempo/.test(tl)) await fetchWeather();
    const zodiac = getZodiac(mergedConfig.birthday);
    if (/signo|horóscopo/.test(tl) && zodiac) localReply = `${zodiac.emoji} Seu signo é **${zodiac.sign}**!`;
    const mathR = tryMath(text); if (mathR) localReply = mathR;
    const convR = tryConvert(text); if (convR) localReply = convR;
    const intent = parseAgentIntent(text);

    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));

    let reply = localReply;
    if (!reply && intent) reply = await executeAgentAction(intent, text);
    if (!reply) {
      const keys = {
        claude: mergedConfig.claudeKey,
        groq: mergedConfig.groqKey,
        gemini: mergedConfig.geminiKey,
        openrouter: mergedConfig.openrouterKey,
      };
      const sys = `Você é JARVIS, assistente de IA e agente DevOps de ${mergedConfig.userName || 'usuário'}. Personalidade amigável e confiante como o JARVIS do Homem de Ferro. SEMPRE responda em Português Brasileiro. Use **negrito** para destaque.`;
      reply = await callAI(messages.concat([userMsg]), sys, keys, setLastModelUsed);
    }
    setIsTyping(false);
    addJarvisMessage(reply || '', { modelUsed: lastModelUsed });
    speak(reply || '');
  }, [input, msgCount, messages, reminders, lastModelUsed, fetchWeather, executeAgentAction, addJarvisMessage, speak, saveReminders]);

  const startBoot = useCallback(() => {
    setScreen('boot');
    let step = 0;
    const next = () => {
      setBootStep(step);
      step++;
      if (step < BOOT_STEPS.length) {
        setTimeout(next, 650);
      } else {
        setTimeout(() => {
          setScreen('chat');
          addJarvisMessage(`Olá, **${configRef.current.userName || 'usuário'}**! JARVIS v3.1.4 online. Como posso ajudá-lo?`);
          fetchWeather();
        }, 800);
      }
    };
    next();
  }, [addJarvisMessage, fetchWeather]);

  const exportChat = useCallback((format: string) => {
    const content = messages.map((m) => `[${m.time}] ${m.role === 'user' ? configRef.current.userName : 'JARVIS'}: ${m.content}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    a.download = `jarvis_${Date.now()}.${format}`;
    a.click();
  }, [messages]);

  return {
    screen, bootStep, messages, setMessages, input, setInput, isTyping, isListening, isSpeaking,
    currentTime, weather, config, saveConfig, tasks, saveTasks, notes, saveNotes,
    reminders, saveReminders, pinnedIds, setPinnedIds, msgCount, lastModelUsed,
    agentLogs, uploadedFiles, setUploadedFiles, activePanel, setActivePanel,
    startBoot, sendMessage, toggleListen, speak, exportChat,
    BOOT_STEPS, PLAN_LIMITS,
  };
};
