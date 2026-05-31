import React, { useRef, useState, useCallback } from 'react';
import { useJarvis, formatTime, formatDate, getZodiac, JarvisConfig } from './hooks/useJarvis';
import { testKey } from './lib/aiRouter';

const THEMES: Record<string, { accent: string; accent2: string; dim: string; text: string }> = {
  cyan:   { accent: '#00FFFF', accent2: '#0080FF', dim: '#00FFFF22', text: '#E0F8FF' },
  red:    { accent: '#FF3030', accent2: '#FF6B00', dim: '#FF303022', text: '#FFE0E0' },
  green:  { accent: '#00FF88', accent2: '#00CC66', dim: '#00FF8822', text: '#E0FFE8' },
};

const INTEGRATIONS: { key: keyof JarvisConfig; label: string; desc: string; group: string; type?: string; testable?: boolean }[] = [
  { key: 'claudeKey',        label: 'Claude API Key',    desc: 'claude-sonnet-4',       group: 'IA',       testable: true },
  { key: 'groqKey',          label: 'Groq API Key',      desc: 'Llama 3.3 70B',         group: 'IA',       testable: true },
  { key: 'geminiKey',        label: 'Gemini API Key',    desc: 'Google Gemini Flash',    group: 'IA',       testable: true },
  { key: 'openrouterKey',    label: 'OpenRouter Key',    desc: '100+ modelos',           group: 'IA',       testable: true },
  { key: 'elevenKey',        label: 'ElevenLabs Key',    desc: 'Voz premium',            group: 'IA',       testable: true },
  { key: 'weatherKey',       label: 'OpenWeatherMap',    desc: 'Clima real',             group: 'Serviços', testable: true },
  { key: 'tavilyKey',        label: 'Tavily Key',        desc: 'Busca web',              group: 'Serviços', testable: true },
  { key: 'githubToken',      label: 'GitHub Token',      desc: 'Repos, commits, PRs',    group: 'DevOps',   testable: true },
  { key: 'vercelToken',      label: 'Vercel Token',      desc: 'Deploy e logs',          group: 'DevOps',   testable: true },
  { key: 'renderToken',      label: 'Render Token',      desc: 'Serviços',               group: 'DevOps',   testable: true },
  { key: 'supabaseUrl',      label: 'Supabase URL',      desc: 'URL do projeto',         group: 'DevOps',   type: 'text', testable: true },
  { key: 'supabaseServiceKey', label: 'Supabase Key',   desc: 'Service role',            group: 'DevOps',   testable: false },
];

const renderMd = (text: string, accent: string) =>
  text
    .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${accent}">$1</strong>`)
    .replace(/`(.*?)`/g, `<code style="background:#ffffff11;padding:1px 4px;border-radius:2px">$1</code>`)
    .replace(/\n/g, '<br/>');

type KeyStatus = 'idle' | 'testing' | 'valid' | 'invalid';

export default function App() {
  const jarvis = useJarvis();
  const {
    screen, bootStep, messages, input, setInput, isTyping, isListening, isSpeaking,
    currentTime, weather, config, saveConfig, tasks, saveTasks, notes, saveNotes,
    reminders, saveReminders, pinnedIds, setPinnedIds, msgCount, lastModelUsed,
    agentLogs, uploadedFiles, setUploadedFiles, activePanel, setActivePanel,
    startBoot, sendMessage, toggleListen, speak, exportChat,
    BOOT_STEPS, PLAN_LIMITS,
  } = jarvis;

  const t = THEMES[config.theme] || THEMES.cyan;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newTask, setNewTask] = useState('');
  const [noteName, setNoteName] = useState('');
  const [noteText, setNoteText] = useState('');
  // draft values for the integrations panel (not yet saved)
  const [draftKeys, setDraftKeys] = useState<Partial<JarvisConfig>>({});
  // status per integration key
  const [keyStatus, setKeyStatus] = useState<Record<string, KeyStatus>>({});
  const zodiac = getZodiac(config.birthday);
  const limit = PLAN_LIMITS[config.plan] || 30;

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Sync draft when panel opens
  React.useEffect(() => {
    if (activePanel === 'integrations') {
      setDraftKeys({});
      setKeyStatus({});
    }
  }, [activePanel]);

  const getDraftValue = (key: keyof JarvisConfig) =>
    key in draftKeys ? (draftKeys[key] as string) : (config[key] as string) || '';

  const handleSaveKey = useCallback((key: keyof JarvisConfig) => {
    const value = getDraftValue(key);
    const updated = { ...config, [key]: value };
    saveConfig(updated);
    setDraftKeys((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, draftKeys, saveConfig]);

  const handleTestKey = useCallback(async (key: keyof JarvisConfig) => {
    const value = getDraftValue(key);
    if (!value.trim()) return;
    setKeyStatus((prev) => ({ ...prev, [key]: 'testing' }));
    // Save before testing so the latest value is used
    const updated = { ...config, [key]: value };
    saveConfig(updated);
    setDraftKeys((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const ok = await testKey(key, value);
    setKeyStatus((prev) => ({ ...prev, [key]: ok ? 'valid' : 'invalid' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, draftKeys, saveConfig]);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&display=swap');
    * { box-sizing: border-box; }
    @keyframes pulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
    @keyframes rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes typing { 0%,80%,100%{transform:scale(0);opacity:.3} 40%{transform:scale(1);opacity:1} }
    @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes scanline { 0%{top:-10%} 100%{top:110%} }
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    .hud-btn { transition:all .2s; cursor:pointer; }
    .hud-btn:hover { filter:brightness(1.4); transform:scale(1.05); }
    .icon-btn { background:transparent; border:1px solid ${t.accent}44; color:${t.accent}; cursor:pointer; padding:8px 14px; font-size:13px; font-family:'Share Tech Mono',monospace; transition:all .2s; }
    .icon-btn:hover { border-color:${t.accent}; background:${t.accent}11; box-shadow:0 0 10px ${t.accent}33; }
    .icon-btn.active { border-color:${t.accent}; background:${t.accent}22; }
    .msg-btn { background:transparent; border:none; cursor:pointer; font-size:12px; opacity:.4; transition:opacity .2s; padding:2px 4px; }
    .msg-btn:hover { opacity:1; }
    .panel-input { width:100%; background:#000; border:1px solid ${t.accent}22; color:${t.accent}; padding:7px 10px; font-family:'Share Tech Mono',monospace; font-size:12px; outline:none; }
    .panel-input:focus { border-color:${t.accent}66; }
    .quick-btn { background:transparent; border:1px solid ${t.accent}18; color:${t.accent}55; font-size:10px; padding:3px 8px; cursor:pointer; font-family:'Share Tech Mono',monospace; transition:all .2s; white-space:nowrap; }
    .quick-btn:hover { border-color:${t.accent}; color:${t.accent}; }
    .key-btn { background:transparent; border:1px solid ${t.accent}33; color:${t.accent}88; cursor:pointer; padding:4px 8px; font-size:9px; font-family:'Share Tech Mono',monospace; transition:all .2s; white-space:nowrap; }
    .key-btn:hover { border-color:${t.accent}; color:${t.accent}; background:${t.accent}11; }
    .key-btn:disabled { opacity:.3; cursor:default; }
    ::-webkit-scrollbar { width:3px; }
    ::-webkit-scrollbar-thumb { background:${t.accent}33; border-radius:2px; }
  `;

  if (screen === 'splash') return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at center,#000820 0%,#000 70%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
      <style>{css}</style>
      <div style={{ position: 'fixed', left: 0, right: 0, height: '3px', background: `linear-gradient(transparent,${t.accent}66,transparent)`, animation: 'scanline 6s linear infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, border: `1px solid ${t.accent}18`, borderRadius: '50%', animation: 'rotate 25s linear infinite' }} />
      <div style={{ position: 'absolute', width: 200, height: 200, border: `1px dashed ${t.accent}25`, borderRadius: '50%', animation: 'rotate 15s linear infinite reverse' }} />
      <div style={{ width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle,${t.accent}55 0%,transparent 70%)`, border: `2px solid ${t.accent}`, boxShadow: `0 0 40px ${t.accent}66`, animation: 'pulse 2.5s ease-in-out infinite', marginBottom: 48, position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: `1px solid ${t.accent}66` }} />
        <div style={{ position: 'absolute', inset: 24, borderRadius: '50%', background: `${t.accent}55` }} />
      </div>
      <div style={{ animation: 'fadeUp .8s ease forwards', textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontFamily: 'Orbitron,monospace', fontSize: 'clamp(36px,8vw,64px)', fontWeight: 900, letterSpacing: 16, color: t.accent, textShadow: `0 0 30px ${t.accent}`, marginBottom: 8 }}>JARVIS</div>
        <div style={{ fontSize: 11, color: `${t.accent}88`, letterSpacing: 5, marginBottom: 4 }}>JUST A RATHER VERY INTELLIGENT SYSTEM</div>
        <div style={{ fontSize: 10, color: `${t.accent}55`, letterSpacing: 3, marginBottom: 48 }}>v3.1.4 • NEURAL CORE • AGENTE AUTÔNOMO</div>
        <button className="hud-btn" onClick={startBoot} style={{ padding: '14px 48px', background: 'transparent', border: `2px solid ${t.accent}`, color: t.accent, fontFamily: 'Orbitron,monospace', fontSize: 13, letterSpacing: 6, cursor: 'pointer', boxShadow: `0 0 30px ${t.accent}33` }}>
          PROTOCOLO DE INÍCIO
        </button>
        <div style={{ marginTop: 24, fontSize: 10, color: `${t.accent}44`, animation: 'blink 2s infinite', letterSpacing: 3 }}>▼ AGUARDANDO AUTORIZAÇÃO ▼</div>
      </div>
    </div>
  );

  if (screen === 'boot') return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px clamp(20px,5vw,80px)' }}>
      <style>{css}</style>
      <div style={{ fontFamily: 'Orbitron,monospace', color: t.accent, fontSize: 10, letterSpacing: 4, marginBottom: 24, opacity: .7 }}>JARVIS SYSTEM BOOT v3.1.4</div>
      {BOOT_STEPS.slice(0, bootStep + 1).map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 12, animation: 'fadeUp .3s ease' }}>
          <span style={{ color: i < bootStep ? '#00FF88' : t.accent, animation: i === bootStep ? 'blink 1s infinite' : 'none' }}>{i < bootStep ? '✓' : '►'}</span>
          <span style={{ color: i < bootStep ? '#555' : t.accent, fontSize: 13 }}>{s}</span>
        </div>
      ))}
      <div style={{ marginTop: 28, height: 2, background: `${t.accent}15` }}>
        <div style={{ height: '100%', background: `linear-gradient(90deg,${t.accent2},${t.accent})`, width: `${((bootStep + 1) / BOOT_STEPS.length) * 100}%`, transition: 'width .6s', boxShadow: `0 0 10px ${t.accent}` }} />
      </div>
    </div>
  );

  const renderIntegrationsPanel = () => (
    <div style={{ width: 320, borderLeft: `1px solid ${t.accent}18`, background: '#00040e', overflowY: 'auto', padding: 14, animation: 'slideIn .2s ease', flexShrink: 0 }}>
      <div style={{ fontFamily: 'Orbitron,monospace', color: t.accent, fontSize: 11, letterSpacing: 3, marginBottom: 14 }}>INTEGRACOES</div>
      {(['IA', 'Serviços', 'DevOps'] as const).map((group) => (
        <div key={group} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Orbitron,monospace', color: `${t.accent}88`, fontSize: 9, letterSpacing: 3, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${t.accent}15` }}>{group}</div>
          {INTEGRATIONS.filter((i) => i.group === group).map(({ key, label, desc, type, testable }) => {
            const currentVal = config[key] as string || '';
            const draftVal = key in draftKeys ? (draftKeys[key] as string) : currentVal;
            const isDirty = draftVal !== currentVal;
            const status = keyStatus[key] || 'idle';
            const hasValue = draftVal.trim().length > 0;
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ color: t.accent, fontSize: 10 }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {status === 'valid' && <span style={{ color: '#00FF88', fontSize: 9, fontFamily: 'Share Tech Mono,monospace' }}>✓ OK</span>}
                    {status === 'invalid' && <span style={{ color: '#FF4444', fontSize: 9, fontFamily: 'Share Tech Mono,monospace' }}>✗ INVÁLIDA</span>}
                    {status === 'testing' && <span style={{ color: `${t.accent}88`, fontSize: 9, fontFamily: 'Share Tech Mono,monospace', animation: 'blink .8s infinite' }}>TESTANDO...</span>}
                    {status === 'idle' && currentVal && !isDirty && <span style={{ color: '#00FF8877', fontSize: 9 }}>✓</span>}
                  </div>
                </div>
                <div style={{ color: `${t.accent}44`, fontSize: 9, marginBottom: 5 }}>{desc}</div>
                <input
                  type={type || 'password'}
                  value={draftVal}
                  onChange={(e) => {
                    setDraftKeys((prev) => ({ ...prev, [key]: e.target.value }));
                    setKeyStatus((prev) => ({ ...prev, [key]: 'idle' }));
                  }}
                  className="panel-input"
                  placeholder="Cole a chave aqui..."
                  style={{
                    borderColor: status === 'valid' ? '#00FF8855' : status === 'invalid' ? '#FF444455' : isDirty ? `${t.accent}55` : `${t.accent}22`,
                  }}
                />
                <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                  <button
                    className="key-btn"
                    disabled={!isDirty && !hasValue}
                    onClick={() => handleSaveKey(key)}
                    style={{
                      borderColor: isDirty ? `${t.accent}88` : `${t.accent}33`,
                      color: isDirty ? t.accent : `${t.accent}55`,
                      fontWeight: isDirty ? 'bold' : 'normal',
                    }}
                  >
                    SALVAR
                  </button>
                  {testable && (
                    <button
                      className="key-btn"
                      disabled={!hasValue || status === 'testing'}
                      onClick={() => handleTestKey(key)}
                      style={{
                        borderColor: status === 'valid' ? '#00FF8866' : status === 'invalid' ? '#FF444466' : `${t.accent}33`,
                        color: status === 'valid' ? '#00FF88' : status === 'invalid' ? '#FF4444' : `${t.accent}77`,
                      }}
                    >
                      {status === 'testing' ? '...' : 'TESTAR'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ height: '100vh', background: '#000814', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{css}</style>
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${t.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#00040e', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent, animation: 'pulse 2s infinite', boxShadow: `0 0 12px ${t.accent}` }} />
          <span style={{ fontFamily: 'Orbitron,monospace', color: t.accent, fontSize: 14, fontWeight: 700, letterSpacing: 4 }}>JARVIS</span>
          {lastModelUsed && <span style={{ color: `${t.accent}44`, fontSize: 9, border: `1px solid ${t.accent}22`, padding: '1px 5px' }}>{lastModelUsed}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10 }}>
          {weather && <span style={{ color: `${t.accent}77` }}>🌤 {weather.temp}°C</span>}
          <span style={{ color: `${t.accent}55` }}>{formatTime(currentTime)}</span>
          <span style={{ color: `${t.accent}44`, fontSize: 9 }}>{msgCount}/{limit === Infinity ? '∞' : limit}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {([['⚡', 'agent'], ['🔑', 'integrations'], ['✅', 'tasks'], ['📋', 'notes'], ['⚙️', 'settings']] as [string, string][]).map(([icon, panel]) => (
            <button key={panel} className={`icon-btn ${activePanel === panel ? 'active' : ''}`} onClick={() => setActivePanel(activePanel === panel ? null : panel)} style={{ padding: '5px 9px', fontSize: 13 }}>{icon}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: `${t.accent}33`, marginTop: 60 }}>
                <div style={{ fontFamily: 'Orbitron,monospace', fontSize: 11, letterSpacing: 4 }}>SISTEMA ONLINE — AGUARDANDO COMANDOS</div>
                <div style={{ fontSize: 10, marginTop: 8, color: `${t.accent}22`, letterSpacing: 2 }}>GITHUB • VERCEL • SUPABASE • RENDER</div>
              </div>
            )}
            {messages.map((m) => {
              const isUser = m.role === 'user';
              const pinned = pinnedIds.includes(m.id);
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', animation: 'fadeUp .3s ease' }}>
                  {pinned && <span style={{ fontSize: 9, color: '#FFD700', marginBottom: 2 }}>📌 FIXADO</span>}
                  <div style={{ maxWidth: '85%', background: isUser ? '#0a2510' : '#000d1a', border: `1px solid ${isUser ? '#00AA4433' : t.accent + '33'}`, padding: '9px 13px' }}>
                    <div style={{ fontSize: 10, color: `${t.accent}55`, marginBottom: 5, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ color: isUser ? '#00AA44' : t.accent }}>{isUser ? config.userName : 'JARVIS'}</span>
                      <span>{m.time} {m.sentiment}</span>
                    </div>
                    <div style={{ color: isUser ? '#BBFFBB' : t.text, fontSize: 13, lineHeight: 1.65, fontFamily: 'Exo 2,sans-serif', fontWeight: 300 }} dangerouslySetInnerHTML={{ __html: renderMd(m.content, t.accent) }} />
                    <div style={{ display: 'flex', gap: 2, marginTop: 6, justifyContent: 'flex-end' }}>
                      <button className="msg-btn" style={{ color: pinned ? '#FFD700' : '#555' }} onClick={() => setPinnedIds((prev) => prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id])}>📌</button>
                      {!isUser && <button className="msg-btn" style={{ color: t.accent }} onClick={() => speak(m.content)}>🔊</button>}
                      <button className="msg-btn" style={{ color: '#FF4444' }} onClick={() => jarvis.setMessages((prev) => prev.filter((x) => x.id !== m.id))}>🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: `${t.accent}66`, fontSize: 11 }}>
                <span>JARVIS processando</span>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, display: 'inline-block', animation: `typing 1.4s infinite ${i * 0.2}s` }} />)}
              </div>
            )}
            {isSpeaking && <div style={{ color: `${t.accent}66`, fontSize: 10 }}>🔊 JARVIS falando...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '10px 14px', borderTop: `1px solid ${t.accent}18`, background: '#00040e', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className={`icon-btn ${isListening ? 'active' : ''}`} onClick={toggleListen} style={{ padding: '9px 11px' }}>🎤</button>
              <button className="icon-btn" onClick={() => fileInputRef.current?.click()} style={{ padding: '9px 11px' }}>📎</button>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => setUploadedFiles(Array.from(e.target.files || []).slice(0, 4).map((f) => ({ name: f.name, type: f.type, url: URL.createObjectURL(f) })))} />
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder={`Comando, Sr. ${config.userName || 'usuário'}...`} style={{ flex: 1, background: '#000', border: `1px solid ${t.accent}22`, color: t.accent, padding: '9px 12px', fontFamily: 'Share Tech Mono,monospace', fontSize: 13, outline: 'none' }} />
              <button className="icon-btn" onClick={() => sendMessage()} style={{ padding: '9px 16px', background: `${t.accent}15`, borderColor: t.accent, fontFamily: 'Orbitron,monospace', fontSize: 11 }}>▶ SEND</button>
            </div>
            {uploadedFiles.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {uploadedFiles.map((f) => <span key={f.name} style={{ fontSize: 10, color: `${t.accent}88`, border: `1px solid ${t.accent}33`, padding: '2px 6px' }}>{f.name}</span>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
              {['Listar repos', 'Projetos Vercel', 'Serviços Render', 'Clima agora', 'Me inspire', 'Piada'].map((q) => (
                <button key={q} className="quick-btn" onClick={() => sendMessage(q)}>{q}</button>
              ))}
            </div>
          </div>
        </div>

        {activePanel === 'integrations' && renderIntegrationsPanel()}

        {activePanel === 'agent' && (
          <div style={{ width: 280, borderLeft: `1px solid ${t.accent}18`, background: '#00040e', overflowY: 'auto', padding: 14, animation: 'slideIn .2s ease', flexShrink: 0 }}>
            <div style={{ fontFamily: 'Orbitron,monospace', color: t.accent, fontSize: 11, letterSpacing: 3, marginBottom: 14 }}>⚡ AGENTE</div>
            {([['GitHub', 'Listar repos\nCriar repo\nVer commits\nIssues e PRs'], ['Vercel', 'Listar projetos\nVer deploys\nLogs'], ['Render', 'Listar serviços\nStatus deploys'], ['Busca Web', 'Pesquisar na web']] as [string, string][]).map(([p, c]) => (
              <div key={p} style={{ marginBottom: 10, padding: '8px 10px', border: `1px solid ${t.accent}15` }}>
                <div style={{ color: t.accent, fontSize: 10, fontFamily: 'Orbitron,monospace', letterSpacing: 2, marginBottom: 4 }}>{p}</div>
                <div style={{ color: `${t.accent}66`, fontSize: 10, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{c}</div>
              </div>
            ))}
            <div style={{ fontFamily: 'Orbitron,monospace', color: t.accent, fontSize: 10, letterSpacing: 2, marginTop: 8, marginBottom: 8 }}>LOG</div>
            {agentLogs.length === 0 && <div style={{ color: `${t.accent}33`, fontSize: 10 }}>Nenhuma ação ainda.</div>}
            {agentLogs.map((log) => (
              <div key={log.id} style={{ marginBottom: 6, padding: '6px 8px', border: `1px solid ${log.status === 'error' ? '#FF444433' : log.status === 'success' ? '#00FF8833' : t.accent + '22'}`, fontSize: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: t.accent }}>{log.platform}</span>
                  <span style={{ color: log.status === 'error' ? '#FF6666' : log.status === 'success' ? '#00FF88' : '#FFD700' }}>{log.status}</span>
                </div>
                <div style={{ color: `${t.accent}66` }}>{log.action} · {log.time}</div>
              </div>
            ))}
          </div>
        )}

        {activePanel === 'tasks' && (
          <div style={{ width: 260, borderLeft: `1px solid ${t.accent}18`, background: '#00040e', overflowY: 'auto', padding: 14, animation: 'slideIn .2s ease', flexShrink: 0 }}>
            <div style={{ fontFamily: 'Orbitron,monospace', color: t.accent, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>✅ TAREFAS</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newTask.trim()) { saveTasks([...tasks, { id: Date.now(), text: newTask, done: false }]); setNewTask(''); } }} placeholder="Nova tarefa..." className="panel-input" style={{ flex: 1 }} />
              <button className="icon-btn" style={{ padding: '6px 10px' }} onClick={() => { if (newTask.trim()) { saveTasks([...tasks, { id: Date.now(), text: newTask, done: false }]); setNewTask(''); } }}> + </button>
            </div>
            {tasks.map((task) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, padding: '7px 8px', border: `1px solid ${task.done ? t.accent + '11' : t.accent + '22'}`, opacity: task.done ? .5 : 1 }}>
                <input type="checkbox" checked={task.done} onChange={() => saveTasks(tasks.map((x) => x.id === task.id ? { ...x, done: !x.done } : x))} style={{ accentColor: t.accent, marginTop: 1 }} />
                <span style={{ flex: 1, color: task.done ? '#444' : t.accent, textDecoration: task.done ? 'line-through' : 'none', fontSize: 11 }}>{task.text}</span>
                <button className="msg-btn" style={{ color: '#FF4444' }} onClick={() => saveTasks(tasks.filter((x) => x.id !== task.id))}>✕</button>
              </div>
            ))}
          </div>
        )}

        {activePanel === 'notes' && (
          <div style={{ width: 280, borderLeft: `1px solid ${t.accent}18`, background: '#00040e', overflowY: 'auto', padding: 14, animation: 'slideIn .2s ease', flexShrink: 0 }}>
            <div style={{ fontFamily: 'Orbitron,monospace', color: t.accent, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>📋 NOTAS</div>
            <input value={noteName} onChange={(e) => setNoteName(e.target.value)} placeholder="Nome da nota..." className="panel-input" style={{ marginBottom: 6 }} />
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Conteúdo..." className="panel-input" style={{ minHeight: 80, resize: 'vertical', marginBottom: 6 }} />
            <button className="icon-btn" style={{ width: '100%', marginBottom: 14, fontSize: 11 }} onClick={() => { if (noteName.trim() && noteText.trim()) { saveNotes([...notes, { id: Date.now(), name: noteName, text: noteText, time: formatTime(currentTime) }]); setNoteName(''); setNoteText(''); } }}>💾 SALVAR</button>
            {notes.map((note) => (
              <div key={note.id} style={{ marginBottom: 8, padding: '8px 10px', border: `1px solid ${t.accent}18` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: t.accent, fontSize: 11, fontFamily: 'Orbitron,monospace' }}>{note.name}</span>
                  <button className="msg-btn" style={{ color: '#FF4444' }} onClick={() => saveNotes(notes.filter((x) => x.id !== note.id))}>✕</button>
                </div>
                <div style={{ color: `${t.accent}77`, fontSize: 11 }}>{note.text}</div>
              </div>
            ))}
          </div>
        )}

        {activePanel === 'settings' && (
          <div style={{ width: 280, borderLeft: `1px solid ${t.accent}18`, background: '#00040e', overflowY: 'auto', padding: 14, animation: 'slideIn .2s ease', flexShrink: 0 }}>
            <div style={{ fontFamily: 'Orbitron,monospace', color: t.accent, fontSize: 11, letterSpacing: 3, marginBottom: 14 }}>⚙ CONFIG</div>
            {([['Nome', 'userName', 'text'], ['Aniversário', 'birthday', 'date'], ['Cidade', 'city', 'text']] as [string, keyof JarvisConfig, string][]).map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ color: `${t.accent}77`, fontSize: 10, marginBottom: 3 }}>{label}</div>
                <input type={type} value={(config[key] as string) || ''} onChange={(e) => saveConfig({ ...config, [key]: e.target.value })} className="panel-input" />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: `${t.accent}77`, fontSize: 10, marginBottom: 6 }}>Tema</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {Object.entries(THEMES).map(([k, v]) => (
                  <button key={k} onClick={() => saveConfig({ ...config, theme: k })} style={{ flex: 1, padding: '7px 0', background: config.theme === k ? `${v.accent}18` : 'transparent', border: `1px solid ${v.accent}55`, color: v.accent, cursor: 'pointer', fontFamily: 'Orbitron,monospace', fontSize: 9 }}>{k.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: `${t.accent}77`, fontSize: 10, marginBottom: 6 }}>Voz</div>
              <select value={config.voiceStyle || 'natural'} onChange={(e) => saveConfig({ ...config, voiceStyle: e.target.value })} className="panel-input">
                <option value="natural">Natural</option>
                <option value="robotic">Robótico</option>
                <option value="off">Desativado</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: `${t.accent}77`, fontSize: 10, marginBottom: 6 }}>Plano</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['free', 'pro', 'ultra'].map((p) => (
                  <button key={p} onClick={() => saveConfig({ ...config, plan: p })} style={{ flex: 1, padding: '7px 0', background: config.plan === p ? `${t.accent}18` : 'transparent', border: `1px solid ${t.accent}${config.plan === p ? '66' : '22'}`, color: config.plan === p ? t.accent : `${t.accent}44`, cursor: 'pointer', fontFamily: 'Orbitron,monospace', fontSize: 9 }}>{p.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="icon-btn" style={{ flex: 1, fontSize: 10 }} onClick={() => exportChat('txt')}>📄 TXT</button>
            </div>
            {zodiac && <div style={{ marginTop: 10, padding: '8px', border: `1px solid ${t.accent}15`, color: `${t.accent}66`, fontSize: 10 }}>{zodiac.emoji} {zodiac.sign}</div>}
            <div style={{ marginTop: 8, padding: '8px', border: `1px solid ${t.accent}15`, color: `${t.accent}44`, fontSize: 9 }}>{formatDate()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
