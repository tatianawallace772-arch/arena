import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ChevronDown, CircleHelp, Code2, ExternalLink, EyeOff, FileText, Globe, Layers3, Menu, MessageCircle, Mic, Square, Volume2, MoreHorizontal, Plus, Settings2, ShieldCheck, Sparkles, Terminal, X, Zap } from 'lucide-react';
import './styles/playground.css';

type SpeechRecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionInstance = { lang: string; interimResults: boolean; onresult: ((event: SpeechRecognitionResultEvent) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance };
type Message = { role: 'user' | 'assistant'; content: string };
type Model = { id: string; name: string; created: number; description?: string; context_length?: number; pricing?: { prompt: string; completion: string } };
const fallbackModel: Model = { id: 'openrouter/auto', name: 'OpenRouter Auto', created: 0 };
const category = (m: Model) => m.id.startsWith('stealth/') ? 'STEALTH' : m.id.startsWith('recursive/') ? 'RECURSIVE' : m.id.endsWith(':free') ? 'FREE' : 'LATEST';
const shortContext = (n?: number) => n ? `${Math.round(n / 1000)}K context` : 'OpenRouter model';
const suggestions = [
  { icon: Sparkles, title: 'Spark an idea', text: 'Help me brainstorm something magical' },
  { icon: Code2, title: 'Build something', text: 'Help me write and debug code' },
  { icon: FileText, title: 'Make it better', text: 'Help me polish my writing' },
  { icon: Globe, title: 'Learn anything', text: 'Explain a topic in a simple way' },
];
function App() {
  const [model, setModel] = useState<Model>(fallbackModel);
  const [models, setModels] = useState<Model[]>([]);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  useEffect(() => {
    const controller = new AbortController();
    setCatalogState('loading');
    fetch('https://openrouter.ai/api/v1/models', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json(); })
      .then(data => {
        if (!Array.isArray(data.data)) throw new Error('Invalid catalog');
        const available: Model[] = data.data.filter((m: Model) => m.id && m.name).sort((a: Model, b: Model) => (b.created || 0) - (a.created || 0));
        setModels(available); setCatalogState('ready');
      }).catch(() => { if (!controller.signal.aborted) setCatalogState('error'); });
    return () => controller.abort();
  }, [catalogAttempt]);
  const filteredModels = models.filter(m => (filter === 'All' || (filter === 'Stealth' ? m.id.startsWith('stealth/') : filter === 'Recursive' ? m.id.startsWith('recursive/') : m.id.endsWith(':free'))) && `${m.name} ${m.id}`.toLowerCase().includes(query.toLowerCase()));
  const featuredModels = [...models.filter(m => m.id.startsWith('stealth/') || m.id.startsWith('recursive/')), ...models.filter(m => !m.id.startsWith('stealth/') && !m.id.startsWith('recursive/'))].slice(0, 4);
  const selectModel = (m: Model) => { setModel(m); setMenu(false); setBrowserOpen(false); };
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [fishKey, setFishKey] = useState('');
  const [voiceId, setVoiceId] = useState('805bcacfee884b78a1e70ce753346454');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speechProvider, setSpeechProvider] = useState<'browser' | 'fish'>('browser');
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const speechRequest = useRef<AbortController | null>(null);
  const speechGeneration = useRef(0);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [inputProvider, setInputProvider] = useState<'browser' | 'fish'>('browser');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; speechGeneration.current++; speechRequest.current?.abort(); window.speechSynthesis?.cancel(); recognitionRef.current?.stop(); if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); streamRef.current?.getTracks().forEach(track => track.stop()); audioRef.current?.pause(); if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); };
  }, []);
  const stopSpeech = () => {
    speechGeneration.current++;
    speechRequest.current?.abort(); speechRequest.current = null;
    window.speechSynthesis?.cancel(); audioRef.current?.pause(); audioRef.current = null;
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    setSpeakingIndex(null);
  };
  const speak = async (text: string, index: number) => {
    stopSpeech(); setError('');
    const generation = speechGeneration.current;
    if (speechProvider === 'browser') {
      if (!('speechSynthesis' in window)) { setError('Text-to-speech is unavailable in this browser. Choose Fish Audio in settings.'); return; }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => { if (generation === speechGeneration.current && mountedRef.current) setSpeakingIndex(null); };
      utterance.onerror = event => { if (generation === speechGeneration.current && mountedRef.current) { setSpeakingIndex(null); if (event.error !== 'canceled' && event.error !== 'interrupted') setError('Browser text-to-speech failed. Try Fish Audio in settings.'); } };
      setSpeakingIndex(index); window.speechSynthesis.speak(utterance); return;
    }
    if (!fishKey.trim()) { setError('Add your Fish Audio API key in settings to hear Nova.'); setSettings(true); return; }
    if (!voiceId.trim()) { setError('Add a Fish Audio voice ID in settings.'); setSettings(true); return; }
    setSpeakingIndex(index);
    const controller = new AbortController(); speechRequest.current = controller;
    try {
      const response = await fetch('https://api.fish.audio/v1/tts', { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${fishKey.trim()}`, 'Content-Type': 'application/json', model: 's2.1-pro-free' }, body: JSON.stringify({ text, reference_id: voiceId.trim(), format: 'mp3' }) });
      if (!response.ok) throw new Error(`Fish Audio could not generate speech (${response.status}). Check your key, voice access, and free-tier limits.`);
      const blob = await response.blob();
      if (generation !== speechGeneration.current || !mountedRef.current) return;
      const url = URL.createObjectURL(blob); audioUrlRef.current = url;
      const audio = new Audio(url); audioRef.current = audio;
      audio.onended = () => { if (generation === speechGeneration.current) stopSpeech(); };
      audio.onerror = () => { if (generation === speechGeneration.current) { stopSpeech(); setError('Audio playback failed.'); } };
      await audio.play();
    } catch (err) {
      if (generation !== speechGeneration.current || !mountedRef.current || controller.signal.aborted) return;
      stopSpeech();
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Your browser blocked automatic playback. Tap Listen to play this reply.' : err instanceof TypeError ? 'Could not reach Fish Audio. Check your connection or use browser voice in settings.' : err instanceof Error ? err.message : 'Voice playback failed.');
    }
  };
  const toggleMic = async () => {
    if (listening) {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      else recognitionRef.current?.stop();
      return;
    }
    setError('');
    if (inputProvider === 'fish') {
      if (!fishKey.trim()) { setError('Add a Fish Audio API key in settings to use Fish transcription.'); setSettings(true); return; }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Recording is unavailable here. Open this app in a secure browser tab or choose browser speech in settings.'); return; }
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream); recorderRef.current = recorder;
        const chunks: Blob[] = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => { stream?.getTracks().forEach(track => track.stop()); setListening(false); setError('Recording failed. Check that your microphone is available and try again.'); };
        recorder.onstop = async () => {
          stream?.getTracks().forEach(track => track.stop()); streamRef.current = null; recorderRef.current = null;
          if (!mountedRef.current) return;
          setListening(false);
          if (!chunks.length) { setError('No audio was recorded. Try again and speak before stopping.'); return; }
          setTranscribing(true);
          try {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            const form = new FormData(); form.append('audio', blob, recorder.mimeType.includes('mp4') ? 'recording.mp4' : recorder.mimeType.includes('ogg') ? 'recording.ogg' : 'recording.webm');
            const response = await fetch('https://api.fish.audio/v1/asr', { method: 'POST', headers: { Authorization: `Bearer ${fishKey.trim()}`, model: 'transcribe-1' }, body: form });
            if (!response.ok) throw new Error(`Fish transcription failed (${response.status}). Check your key, account access, and billing.`);
            const data = await response.json();
            if (!data.text?.trim()) throw new Error('No speech was detected. Try recording again.');
            if (mountedRef.current) setInput(previous => previous ? `${previous} ${data.text.trim()}` : data.text.trim());
          } catch (err) { if (mountedRef.current) setError(err instanceof TypeError ? 'Could not reach Fish Audio. Check your connection or try browser speech in settings.' : err instanceof Error ? err.message : 'Transcription failed.'); }
          finally { if (mountedRef.current) setTranscribing(false); }
        };
        recorder.start(); setListening(true);
      } catch (err) {
        stream?.getTracks().forEach(track => track.stop()); streamRef.current = null; recorderRef.current = null;
        const name = err instanceof Error ? err.name : '';
        setError(name === 'NotAllowedError' || name === 'SecurityError' ? 'Microphone access was blocked. Allow microphone access for this site in your browser settings, then try again.' : name === 'NotFoundError' ? 'No microphone was found. Connect one and try again.' : 'Could not start recording. Check your microphone and browser permissions.');
      }
      return;
    }
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError('Browser speech recognition is unavailable. Choose Fish Audio transcription in settings instead.'); return; }
    const recognition = new SpeechRecognition(); recognitionRef.current = recognition;
    recognition.lang = 'en-US'; recognition.interimResults = false;
    recognition.onresult = event => { const text = Array.from(event.results).map(result => result[0].transcript).join(' '); setInput(previous => previous ? `${previous} ${text}` : text); };
    recognition.onerror = event => {
      const errors: Record<string, string> = {
        'not-allowed': 'Microphone or speech recognition access was blocked. Allow microphone access for this site in your browser settings.',
        'service-not-allowed': 'Your browser blocked its speech recognition service. Try Fish Audio transcription in settings.',
        'network': 'The browser speech service could not connect. Check your connection or try Fish Audio transcription in settings.',
        'audio-capture': 'No microphone is available. Connect one and check your device permissions.',
        'no-speech': 'No speech was detected. Try again and speak clearly.',
        'language-not-supported': 'This language is not supported by your browser speech service. Try Fish Audio transcription in settings.',
      };
      if (event.error !== 'aborted') setError(errors[event.error] || `Browser speech recognition failed (${event.error}). Try Fish Audio transcription in settings.`);
      setListening(false);
    };
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    try { recognition.start(); setListening(true); } catch { setError('Could not start browser speech recognition. Try Fish Audio transcription in settings.'); }
  };
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebar, setSidebar] = useState(false);
  const [temperature, setTemperature] = useState('0.7');
  const [systemPrompt, setSystemPrompt] = useState('You are Nova, a friendly and helpful AI assistant.');
  const send = async (text = input) => {
    if (!text.trim() || loading) return;
    if (!apiKey.trim()) { setError('Add your OpenRouter API key in settings to start chatting.'); setSettings(true); return; }
    const next: Message[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next); setInput(''); setError(''); setLoading(true);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model.id, messages: [{ role: 'system', content: systemPrompt }, ...next], temperature: Number(temperature) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Something went wrong. Please try again.');
      const reply = data.choices?.[0]?.message?.content || 'No response was returned.';
      setMessages([...next, { role: 'assistant', content: reply }]);
      if (autoSpeak) void speak(reply, next.length);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect to OpenRouter.'); }
    finally { setLoading(false); }
  };
  const newChat = () => { stopSpeech(); setMessages([]); setInput(''); setError(''); setSidebar(false); };
  const submit = (e: FormEvent) => { e.preventDefault(); void send(); };
  return <div className="app-shell">
    <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
      <div className="brand"><div className="brand-icon"><Sparkles size={19}/></div><div><strong>starr<span>nova</span></strong><small>AI PLAYGROUND</small></div><button className="mobile-close icon-button" onClick={() => setSidebar(false)} aria-label="Close menu"><X size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={17}/> New chat <span>⌘ K</span></button>
      <div className="side-label">WORKSPACE</div>
      <button className="nav-item active" onClick={newChat}><MessageCircle size={17}/> Playground <span className="nav-dot"/></button>
      <button className="nav-item" onClick={() => setBrowserOpen(true)}><Layers3 size={17}/> Models <span className="nav-badge">{models.length || "…"}</span></button>
      <button className="nav-item" onClick={() => setSettings(true)}><Settings2 size={17}/> Settings</button>
      <div className="side-divider"/>
      <div className="side-label recent-label">RECENTS <MoreHorizontal size={17}/></div>
      <div className="empty-recent"><span>✦</span><p>Your conversations<br/>will appear here</p></div>
      <div className="sidebar-bottom"><div className="side-note"><span className="note-spark">✦</span><div><strong>A little more magic ✨</strong><p>Bring your ideas to life with Nova by your side.</p></div></div><button className="profile" onClick={() => setSettings(true)}><div className="avatar">N</div><div><strong>Nova explorer</strong><small>Personal workspace</small></div><MoreHorizontal size={19}/></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="menu-button icon-button" onClick={() => setSidebar(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>Playground</strong></div><div className="top-actions"><span className="status"><i/> {catalogState === "ready" ? "Live model catalog" : catalogState === "loading" ? "Loading models" : "Catalog unavailable"}</span><button className="icon-button help" onClick={() => setSettings(true)} aria-label="Help and settings"><CircleHelp size={19}/></button><button className="top-avatar" onClick={() => setSettings(true)}>N</button></div></header>
      <div className="content"><div className="page-heading"><div className="hero-copy"><div className="eyebrow"><span>✦</span> YOUR CREATIVE SPACE</div><h1>A little magic for<br/><em>your big ideas.</em> <span>✦</span></h1><p>Meet your creative sidekick and bring something wonderful to life.</p><div className="hero-badge"><span>✦</span> YOUR IMAGINATION, UNLIMITED</div></div><button className="settings-button" onClick={() => setSettings(true)}><Settings2 size={16}/> Playground settings</button></div>
        <div className="workspace-label"><div><span>✦</span> YOUR PLAYGROUND <small> / &nbsp; CREATE SOMETHING WONDERFUL</small></div><span className="workspace-label-right">THE POSSIBILITIES ARE ENDLESS ✳</span></div><div className="workspace"><section className="chat-panel"><div className="panel-header"><div className="panel-title"><span className="panel-icon"><MessageCircle size={17}/></span><div><strong>New conversation</strong><small>Your next great idea starts here</small></div></div><div className="header-tools"><span className="private"><EyeOff size={13}/> Private session</span><button className="icon-button" onClick={newChat} aria-label="New conversation"><Plus size={19}/></button></div></div>
          <div className="chat-body">{messages.length === 0 ? <div className="welcome"><div className="star star-one">✦</div><div className="star star-two">✧</div><div className="nova-frame"><img src="/images/nova.jpg" alt="Gingerbread Starr Nova"/></div><div className="welcome-tag">✦ &nbsp; A LITTLE MAGIC, JUST FOR YOU &nbsp; ✦</div><h2>Hi, I'm Nova! <span>✦</span></h2><p>Think of me as your little creative sidekick.<br/>Ask me anything, or let's make something wonderful together.</p><div className="suggestions">{suggestions.map(({icon: Icon,title,text}) => <button key={title} onClick={() => setInput(text)}><span className="suggestion-icon"><Icon size={17}/></span><span><strong>{title}</strong><small>{text}</small></span><ArrowRight className="suggestion-arrow" size={15}/></button>)}</div></div> : <div className="message-list">{messages.map((m,i) => <div className={`message ${m.role}`} key={i}><div className="message-avatar">{m.role === 'assistant' ? '✦' : 'N'}</div><div><strong>{m.role === 'assistant' ? 'Nova' : 'You'}</strong><p>{m.content}</p>{m.role === 'assistant' && <button className="speak-button" onClick={() => speakingIndex === i ? stopSpeech() : void speak(m.content, i)} aria-label={speakingIndex === i ? 'Stop reading reply' : 'Read reply aloud'}>{speakingIndex === i ? <Square size={13}/> : <Volume2 size={14}/>} {speakingIndex === i ? 'Stop' : 'Listen'}</button>}</div></div>)}{loading && <div className="message assistant"><div className="message-avatar">✦</div><div><strong>Nova</strong><p>Thinking up something good…</p></div></div>}</div>}</div>
          <div className="composer-wrap">{error && <div className="error">{error}</div>}<form className="composer" onSubmit={submit}><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault(); void send();}}} placeholder="Message Nova..." rows={2}/><div className="composer-bottom"><div className="model-picker"><button type="button" onClick={() => setMenu(!menu)}><span className="model-mini">✳</span> {model.name} <ChevronDown size={14}/></button>{menu && <div className="model-menu"><div className="menu-caption">RECENTLY ADDED</div>{featuredModels.map(m => <button type="button" key={m.id} onClick={() => selectModel(m)}>{m.name}{model.id === m.id && <Check size={14}/>}</button>)}<button type="button" className="menu-browse" onClick={() => {setMenu(false);setBrowserOpen(true);}}>Browse all models <ArrowRight size={14}/></button></div>}</div><div className="send-group"><button type="button" className={`mic-button ${listening ? 'listening' : ''}`} onClick={() => void toggleMic()} disabled={transcribing} aria-label={listening ? 'Stop listening' : 'Speak a message'} title={listening ? 'Stop listening' : 'Speak a message'}>{listening ? <Square size={15}/> : <Mic size={16}/>}</button><span>{transcribing ? 'Transcribing…' : listening ? (inputProvider === 'fish' ? 'Recording · tap to stop' : 'Listening…') : '↵ to send'}</span><button className="send" disabled={loading || !input.trim()} aria-label="Send message"><ArrowRight size={19}/></button></div></div></form><div className="composer-foot"><span><ShieldCheck size={13}/> Your conversations stay yours</span><span>Nova can make mistakes. Double-check important info.</span></div></div>
        </section><aside className="right-panel"><div className="right-heading"><div><span className="eyebrow">THE MAGIC BEHIND IT</span><h3>Find your spark <span>✦</span></h3><p>A whole universe of minds, all in one place.</p></div></div><div className="model-list">{catalogState === 'loading' && <p className="catalog-message">Finding the newest models…</p>}{catalogState === 'error' && <p className="catalog-message">Couldn't load the live catalog. <button onClick={() => setCatalogAttempt(n => n + 1)}>Try again</button></p>}{catalogState === 'ready' && featuredModels.map((m,i) => <button className={`model-card ${model.id === m.id ? 'selected' : ''}`} key={m.id} onClick={() => selectModel(m)}><span className={`model-icon ${['orange','green','blue','purple'][i % 4]}`}>{i === 0 ? '✳' : i === 1 ? '✺' : i === 2 ? '✦' : '◉'}</span><span className="model-info"><span className="model-name">{m.name} {model.id === m.id && <Check size={13}/>}</span><small>{shortContext(m.context_length)}</small><em>{category(m)}</em></span><ArrowRight className="card-arrow" size={15}/></button>)}</div><button className="browse" onClick={() => setBrowserOpen(true)}>Explore all {models.length || ''} models <ArrowRight size={15}/></button><div className="power-card"><div className="power-icon"><Zap size={17}/></div><div><strong>Powered by possibilities</strong><p>One playground, lots of brilliant minds. Connect your API key to get started.</p><button onClick={() => setSettings(true)}>Connect a provider <ArrowRight size={13}/></button></div></div><div className="provider-label">PROVIDERS</div><div className="providers"><span><span className="provider-mark">◈</span> OpenRouter</span><span><Terminal size={15}/> OpenCode</span></div></aside></div>
        <footer><span>Made with <span className="heart">♥</span> and a little stardust</span><span>Dream big. Stay curious. <span className="footer-star">✦</span></span></footer>
      </div>
    </main>
    {browserOpen && <div className="modal-backdrop" onClick={() => setBrowserOpen(false)}><div className="modal model-browser" onClick={e => e.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">LIVE FROM OPENROUTER</span><h2>Explore models</h2></div><button className="icon-button" onClick={() => setBrowserOpen(false)} aria-label="Close model browser"><X size={20}/></button></div><p>Discover the latest available models, including stealth previews and Recursive. Availability and pricing can change.</p><input className="model-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search models or providers..." aria-label="Search models"/><div className="model-filters">{['All', 'Stealth', 'Recursive', 'Free'].map(f => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div><div className="browser-summary">{catalogState === 'ready' ? `${filteredModels.length} models · newest first` : catalogState === 'loading' ? 'Loading the live catalog…' : 'Could not load the OpenRouter catalog.'}{catalogState === 'error' && <button onClick={() => setCatalogAttempt(n => n + 1)}>Retry</button>}</div><div className="browser-list">{catalogState === 'ready' && filteredModels.length === 0 && <p className="catalog-message">No matching models are currently listed. Stealth previews may be temporary.</p>}{filteredModels.map(m => <button key={m.id} className="browser-model" onClick={() => selectModel(m)}><span><strong>{m.name}</strong><small>{m.id} · {shortContext(m.context_length)}</small></span><em>{category(m)}</em>{model.id === m.id && <Check size={15}/>}</button>)}</div></div></div>}
    {settings && <div className="modal-backdrop" onClick={() => setSettings(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">MAKE IT YOURS</span><h2>Playground settings</h2></div><button className="icon-button" onClick={() => setSettings(false)} aria-label="Close settings"><X size={20}/></button></div><p>Connect OpenRouter to chat with your favorite models. Your key stays in this browser session and is sent directly to OpenRouter.</p><label>OpenRouter API key<input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-v1-..." autoComplete="off"/></label><a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">Get an OpenRouter key <ExternalLink size={13}/></a><div className="voice-settings"><div className="voice-title"><Volume2 size={16}/><div><strong>Nova's voice</strong><small>Fish Audio · s2.1-pro-free</small></div></div><label>Text-to-speech voice<select value={speechProvider} onChange={e => { stopSpeech(); setSpeechProvider(e.target.value as 'browser' | 'fish'); }}><option value="browser">Browser voice (no API key)</option><option value="fish">Fish Audio voice</option></select></label><label>Fish Audio API key<input type="password" value={fishKey} onChange={e => setFishKey(e.target.value)} placeholder="Enter your Fish Audio key" autoComplete="off"/></label><label>Voice reference ID<input value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="Fish Audio voice ID"/></label><label>Microphone transcription<select value={inputProvider} onChange={e => setInputProvider(e.target.value as 'browser' | 'fish')} disabled={listening || transcribing}><option value="browser">Browser speech recognition</option><option value="fish">Fish Audio transcription</option></select></label><label className="voice-toggle"><input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)}/> Read new replies aloud</label><p>Keys stay in memory for this session. Browser voice uses your device's available voice. Fish Audio reads replies using your selected voice ID. Browser speech input uses your browser's speech service. Fish transcription sends recorded audio to Fish Audio and may incur separate charges; tap the microphone again to stop recording. Fish TTS free-tier limits and voice access apply.</p></div><label>System prompt<textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={3}/></label><label>Temperature <span>{temperature}</span><input type="range" min="0" max="2" step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)}/></label><div className="opencode-note"><Terminal size={17}/><div><strong>OpenCode console</strong><p>Use OpenCode separately for coding workflows. This playground connects to OpenRouter for chat.</p></div></div><button className="done" onClick={() => setSettings(false)}>Done <Check size={16}/></button></div></div>}
  </div>;
}
export default App;
