import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, ChevronRight, Copy, Check, Menu, X, ExternalLink, Zap, Mic, Monitor, Network, PenTool, MessageSquare, Settings, Download, Eye, Cpu, Brain } from "lucide-react";
import { triggerDownload } from "../lib/utils";

import {
  JarvisBot, PixelFox, SpaceCat, FireDrake, Ninja, Wizard,
  CyberPunk, MinionBob, AlienDude, Astronaut, type CharacterAnimation
} from "../characters/CharacterRenderer";

// ─── Code block ───────────────────────────────────────────────────────────────
const Code = ({ children, lang = '' }: { children: string; lang?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-border bg-slate-950 group">
      {lang && <div className="px-4 py-2 text-xs font-mono text-slate-400 border-b border-slate-800 flex justify-between items-center">
        <span>{lang}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
          {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied!</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>}
        </button>
      </div>}
      <pre className="p-4 text-sm text-slate-100 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">{children}</pre>
    </div>
  );
};

// ─── Callout ──────────────────────────────────────────────────────────────────
const Callout = ({ type = 'info', children }: { type?: 'info' | 'warn' | 'tip'; children: React.ReactNode }) => {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    tip: 'bg-green-50 border-green-200 text-green-900',
  };
  const icons = { info: '💡', warn: '⚠️', tip: '✅' };
  return (
    <div className={`my-4 flex gap-3 rounded-xl border px-4 py-3 text-sm ${styles[type]}`}>
      <span className="text-base leading-relaxed">{icons[type]}</span>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
};

// ─── Mini character preview ───────────────────────────────────────────────────
const CharPreview = ({ Component, name, tag, colors }: { Component: React.FC<any>; name: string; tag: string; colors: string }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="flex flex-col items-center bg-white border border-border rounded-xl p-4 cursor-default hover:shadow-md hover:border-primary/30 transition-all">
      <Component animation={hov ? 'wave' : 'idle'} size={64} />
      <div className="mt-2 font-bold text-xs">{name}</div>
      <div className="text-[10px] text-muted-foreground">{tag}</div>
      <div className="mt-1.5 text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{colors}</div>
    </div>
  );
};

// ─── Sidebar nav items ────────────────────────────────────────────────────────
const NAV = [
  { id: 'overview', label: 'Overview', icon: Bot },
  { id: 'installation', label: 'Installation', icon: Download },
  { id: 'quickstart', label: 'Quick Start', icon: Zap },
  { id: 'models', label: 'Models', icon: Brain },
  { id: 'characters', label: 'Characters', icon: Cpu },
  { id: 'emotions', label: 'Emotions & Moods', icon: Zap },
  { id: 'minimode', label: 'MiniMode', icon: Monitor },
  { id: 'relationship', label: 'Relationship Engine', icon: Zap },
  { id: 'contextual', label: 'Contextual Awareness', icon: Eye },
  { id: 'dragdrop', label: 'Drag & Drop Files', icon: Download },
  { id: 'voice', label: 'Voice Control', icon: Mic },
  { id: 'vision', label: 'Screen Vision', icon: Eye },
  { id: 'drawing', label: 'Screen Drawing', icon: PenTool },
  { id: 'agents', label: 'AI Agents & Tools', icon: Network },
  { id: 'integrations', label: 'Integrations', icon: MessageSquare },
  { id: 'config', label: 'Configuration', icon: Settings },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <motion.section id={id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
    className="pb-16 border-b border-border last:border-0 last:pb-0">
    {children}
  </motion.section>
);

const H1 = ({ children }: { children: React.ReactNode }) => <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3 tracking-tight">{children}</h1>;
const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="text-xl font-bold text-foreground mt-8 mb-3">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>;

// ─── Docs Page ────────────────────────────────────────────────────────────────
export const DocsPage = () => {
  const [active, setActive] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track scroll to highlight active nav
  useEffect(() => {
    const handler = () => {
      for (const { id } of [...NAV].reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) { setActive(id); break; }
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  };

  const Sidebar = () => (
    <nav className="space-y-0.5">
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2 mb-1">Documentation</div>
      {NAV.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => scrollTo(id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${active === id ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}>
          <Icon className="w-4 h-4 flex-shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(o => !o)} className="md:hidden p-1.5 rounded-lg hover:bg-secondary">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2 font-bold text-foreground hover:text-primary transition-colors">
              <Bot className="w-5 h-5 text-primary" /> JARVIS
            </Link>
            <span className="text-border text-lg hidden sm:block">|</span>
            <span className="text-muted-foreground text-sm hidden sm:block">Documentation</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/Abhishekkkk-15/jarvis-assistant" target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="w-4 h-4" /> GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, x: -280 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -280 }}
            className="fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-border shadow-2xl md:hidden pt-14 px-4 py-6 overflow-y-auto">
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-64 flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 px-4 border-r border-border">
          <Sidebar />
        </aside>

        {/* Content */}
        <main ref={contentRef} className="flex-1 min-w-0 px-4 md:px-10 py-10 max-w-3xl scroll-mt-14">
          <div className="space-y-0">

            {/* Overview */}
            <Section id="overview">
              <div className="flex items-start gap-6 mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4 border border-primary/20">v1.0 Stable</div>
                  <H1>JARVIS Documentation</H1>
                  <P>JARVIS is an open-source AI desktop companion. It runs as a local desktop application on your machine, lives on your screen as an animated character, hears your voice, sees your screen, and executes autonomous tasks via a LangGraph multi-agent system powered by remote LLM APIs.</P>
                  <Callout type="tip">New here? Start with <strong>Installation</strong> and the <strong>Quick Start</strong> guide, then explore features from there.</Callout>
                </div>
                <div className="flex-shrink-0 hidden md:block">
                  <JarvisBot animation="wave" size={100} />
                </div>
              </div>

              <H2>What JARVIS can do</H2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {[
                  ['🎭', 'Animated character companions', '10 built-in characters with 30+ animations and full emotion systems'],
                  ['🎙️', 'Wake word voice control', '"Hey JARVIS" — hands-free speech-to-text and text-to-speech'],
                  ['👁️', 'Screen vision', 'Reads your screen contents to understand what you\'re working on'],
                  ['✏️', 'Screen drawing', 'Annotates your display live with arrows and text'],
                  ['🤖', 'Autonomous agents', 'LangGraph-powered agents that browse, edit files, and execute tasks'],
                  ['📱', 'Telegram sync', 'Send notification alerts directly to your desktop assistant remotely'],
                  ['🖥️', 'MiniMode physics', 'Characters with gravity that roam your real desktop'],
                  ['🔒', 'Native Desktop App', 'No user registration or companion subscriptions required'],
                ].map(([icon, title, desc]) => (
                  <div key={title as string} className="flex gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                    <span className="text-xl flex-shrink-0">{icon}</span>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Installation */}
            <Section id="installation">
              <H1>Installation</H1>
              <P>JARVIS runs exclusively as a local Electron application on Windows 10/11. No internet connection is required for core features.</P>

              <H2>Requirements</H2>
              <div className="bg-secondary/50 rounded-xl border border-border p-4 mb-4">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left pb-2 font-semibold">Dependency</th><th className="text-left pb-2 font-semibold">Minimum</th><th className="text-left pb-2 font-semibold">Recommended</th></tr></thead>
                  <tbody className="text-muted-foreground">
                    {[
                      ['Node.js', 'v20.x or higher', 'v22.x LTS'],
                      ['pnpm', 'v9.x or higher', 'Latest v9.x'],
                      ['RAM', '8 GB', '16 GB'],
                      ['GPU', 'Not required', 'NVIDIA for local LLMs (optional)'],
                      ['OS', 'Windows 10', 'Windows 11']
                    ].map(r => (
                      <tr key={r[0]} className="border-b border-border/50 last:border-0">
                        <td className="py-2 font-mono text-foreground">{r[0]}</td>
                        <td className="py-2">{r[1]}</td>
                        <td className="py-2">{r[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <H2>Download</H2>
              <P>Grab the latest setup executable from GitHub Releases:</P>
              <div className="my-4">
                <button onClick={triggerDownload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg">
                  <Download className="w-4 h-4" /> Download JARVIS Installer (Latest)
                </button>
              </div>
              <Code lang="powershell">{`# Run the downloaded JARVIS-Setup.exe to install the desktop assistant companion.`}</Code>

              <H2>Build from source</H2>
              <Code lang="powershell">{`# Clone the repository
git clone https://github.com/Abhishekkkk-15/jarvis-assistant.git
cd jarvis-assistant

# Install dependencies across the monorepo
pnpm install

# Run in development (starts API Server + Electron Desktop)
pnpm run dev:desktop

# Build production executable
pnpm run electron:build`}</Code>
              <Callout type="info">Ensure Node.js and pnpm are in your system's PATH before running the installation commands.</Callout>
            </Section>

            {/* Quick Start */}
            <Section id="quickstart">
              <H1>Quick Start</H1>
              <P>Once JARVIS is installed and running, you'll land on the main chat window with JARVIS Bot as your default companion. Here's how to get up and running in under 2 minutes.</P>

              <H2>Step 1 — Choose a character</H2>
              <P>Click the character icon in the sidebar to open the Character Selector. Pick from 10 built-in companions or create your own in Custom Studio.</P>

              <H2>Step 2 — Connect LLMs</H2>
              <P>JARVIS requires API keys for both <strong>Groq</strong> and <strong>NVIDIA</strong> to power its local and cloud hybrid orchestrator. Models are pre-selected by default and cannot be modified on the frontend. Open <strong>Settings</strong> and enter both API keys:</P>
              <Code lang="json">{`{
  "groqApiKey": "gsk-...",
  "nvidiaApiKey": "nvapi-..."
}`}</Code>
              <Callout type="tip">Both Groq and NVIDIA API keys must be entered and saved in Settings to enable the full orchestrator capabilities.</Callout>

              <H2>Step 3 — Say hello</H2>
              <P>Type in the chat box or press the microphone button and say "Hey JARVIS, what can you do?" Your companion will introduce itself and demonstrate its capabilities.</P>

              <H2>Step 4 — Desktop Hotkeys & MiniMode</H2>
              <P>JARVIS runs with several global keyboard shortcuts to quickly manage layout modes:</P>
              <Code lang="text">{`Ctrl+Shift+Space  — Hide or Show JARVIS Main Window
Ctrl+Shift+K      — Toggle Quick Command Input panel
F11               — Toggle application fullscreen mode`}</Code>
              <Callout type="info">Click the **Minimize** button in the sidebar. If Mini Mode is enabled in settings, the window will disappear and the companion will float freely on your desktop. If Mini Mode is disabled, the app will perform a standard minimize to your taskbar.</Callout>
            </Section>

            {/* Models */}
            <Section id="models">
              <H1>Supported Models</H1>
              <P>JARVIS uses specialized, pre-selected AI models optimized for low-latency reasoning, tool orchestration, and computer vision tasks. These models are configured automatically on the backend and run through your API keys.</P>

              <div className="space-y-4 my-6">
                <div className="p-4 rounded-xl border border-border bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 text-xs font-bold text-primary bg-primary/10 rounded-full">Core Orchestrator</span>
                    <code className="text-sm font-semibold font-mono text-foreground">openai/gpt-oss-120b</code>
                  </div>
                  <P>This model drives the LangGraph multi-agent loop, handles standard chat messaging, decides which tools to call, and plans step-by-step actions to complete your requests.</P>
                </div>

                <div className="p-4 rounded-xl border border-border bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 text-xs font-bold text-green-700 bg-green-50 rounded-full">Screen Vision</span>
                    <code className="text-sm font-semibold font-mono text-foreground">meta/llama-3.2-90b-vision-instruct</code>
                  </div>
                  <P>Used exclusively when you ask JARVIS to see or analyze your screen. This model is fine-tuned for visual instruction-following and accurately identifies elements on your desktop.</P>
                </div>

                <div className="p-4 rounded-xl border border-border bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 text-xs font-bold text-orange-700 bg-orange-50 rounded-full">Speech-To-Text (STT)</span>
                    <code className="text-sm font-semibold font-mono text-foreground">groq/whisper-large-v3</code>
                  </div>
                  <P>Transcribes your spoken voice inputs. Once you stop speaking, your audio is captured using local Voice Activity Detection (VAD) and transcribed instantly via Groq's Whisper endpoint.</P>
                </div>

                <div className="p-4 rounded-xl border border-border bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 rounded-full">Wake Word / Offline Listener</span>
                    <code className="text-sm font-semibold font-mono text-foreground">vosk-browser (local model)</code>
                  </div>
                  <P>Performs 100% local, offline wake word detection. Runs client-side in the Electron process to recognize wake commands without uploading continuous microphone streams to the cloud.</P>
                </div>

                <div className="p-4 rounded-xl border border-border bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 rounded-full">Text-To-Speech (TTS)</span>
                    <code className="text-sm font-semibold font-mono text-foreground">canopylabs/orpheus-v1-english</code>
                  </div>
                  <P>Powers natural, highly expressive speech synthesis for hands-free audio response delivery. Available voice types and profiles include:</P>
                  <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-xs">
                    <div className="bg-secondary/40 p-2 rounded border border-border/60">
                      <strong>autumn</strong>
                      <div className="text-muted-foreground mt-0.5">Warm, narrative tone</div>
                    </div>
                    <div className="bg-secondary/40 p-2 rounded border border-border/60">
                      <strong>diana</strong>
                      <div className="text-muted-foreground mt-0.5">Expressive, conversational female</div>
                    </div>
                    <div className="bg-secondary/40 p-2 rounded border border-border/60">
                      <strong>hannah</strong>
                      <div className="text-muted-foreground mt-0.5">Bright, clear female</div>
                    </div>
                    <div className="bg-secondary/40 p-2 rounded border border-border/60">
                      <strong>austin</strong>
                      <div className="text-muted-foreground mt-0.5">Professional, clear male</div>
                    </div>
                    <div className="bg-secondary/40 p-2 rounded border border-border/60">
                      <strong>daniel</strong>
                      <div className="text-muted-foreground mt-0.5">Deep, calm male</div>
                    </div>
                    <div className="bg-secondary/40 p-2 rounded border border-border/60">
                      <strong>troy</strong>
                      <div className="text-muted-foreground mt-0.5">Snappy, friendly male</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Supports expressive speech tags like <code>[cheerful]</code>, <code>[whisper]</code>, <code>[excited]</code>, or <code>[thoughtful]</code> within output text for dynamic tone changes.</p>
                </div>
              </div>

              <Callout type="info">Models are automatically selected by the system depending on the context of your prompt (text-only vs vision inputs) to optimize performance and token usage.</Callout>
            </Section>

            {/* Characters */}
            <Section id="characters">
              <H1>Characters</H1>
              <P>Every JARVIS companion is a fully hand-crafted SVG character with responsive limb animations, emotion expressions, eye-tracking, and lip-sync. Characters are not AI-generated images — they are deterministic code.</P>

              <H2>Built-in characters (22 total)</H2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 my-4">
                {[
                  { Component: JarvisBot, name: 'JARVIS Bot', tag: 'The Classic', colors: '#1a1a2e' },
                  { Component: PixelFox, name: 'Pixel Fox', tag: 'The Trickster', colors: '#ff7e00' },
                  { Component: SpaceCat, name: 'Astro Feline', tag: 'The Explorer', colors: '#ffb347' },
                  { Component: FireDrake, name: 'Ignis Drake', tag: 'The Fierce', colors: '#27ae60' },
                  { Component: Ninja, name: 'Shinobi', tag: 'The Silent', colors: '#2c3e50' },
                  { Component: Wizard, name: 'Archmage', tag: 'The Wise', colors: '#8e44ad' },
                  { Component: CyberPunk, name: 'Cyber Dweller', tag: 'The Rebel', colors: '#1abc9c' },
                  { Component: MinionBob, name: 'Minion Blob', tag: 'The Goofball', colors: '#f1c40f' },
                  { Component: AlienDude, name: 'Alien Dude', tag: 'The Oddball', colors: '#2ecc71' },
                  { Component: Astronaut, name: 'Astronaut', tag: 'The Drifter', colors: '#bdc3c7' },
                ].map(c => <CharPreview key={c.name} {...c} />)}
              </div>
              <P>Plus 12 more built-in companions available in the Characters tab: <strong>Spider-Man</strong>, <strong>Iron Hero</strong>, <strong>Electric Mouse</strong>, <strong>Dark Knight</strong>, <strong>Ninja Turtle</strong>, <strong>Pirate Captain</strong>, <strong>Zombie Guy</strong>, <strong>Cyber Bot</strong>, <strong>Vampire Lord</strong>, <strong>Ghost Boo</strong>, <strong>Samurai</strong>, and <strong>Space Bean</strong>.</P>

              <H2>Character props</H2>
              <P>All character components share the same interface:</P>
              <Code lang="typescript">{`interface CharacterProps {
  animation: CharacterAnimation; // see Emotions & Moods
  size?: number;                 // default: 80px
  flipped?: boolean;             // mirror horizontally
  isBlinking?: boolean;          // trigger eye blink frame
  isSpeaking?: boolean;          // activate lip-sync
  moodLabel?: string;            // CSS glow: 'happy'|'sad'|'angry'|...
  showEmotionBubble?: string;    // override bubble text
  showParticleBurst?: boolean;   // confetti explosion
  mouseX?: number;               // eye tracking
  mouseY?: number;
  posX?: number;
  posY?: number;
}`}</Code>

              <H2>Custom characters</H2>
              <P>Open <strong>Characters → Custom Studio</strong> to upload your own sprite. You can provide one image per animation state (PNG, JPEG, GIF, WebP — max 5 MB) or a single idle sprite that gets reused for all states.</P>
              <Code lang="typescript">{`interface CustomCharacter {
  id: string;
  name: string;
  sprites: Partial<Record<CharacterAnimation, string>>; // base64 or URL
}`}</Code>
            </Section>

            {/* Emotions */}
            <Section id="emotions">
              <H1>Emotions & Moods</H1>
              <P>Characters have a full emotional range driven by AI-detected sentiment in conversations, completed tasks, time of day, and idle timers.</P>

              <H2>Animation states</H2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-4">
                {[
                  ['idle', 'Gentle floating bob — default resting state'],
                  ['walk', 'Limb swing, body tilt — triggered during movement'],
                  ['run', 'Fast limb swing — dash movements'],
                  ['wave', 'Arm wave — greeting or acknowledgement'],
                  ['dance', 'Full-body bounce and rotation to music beat'],
                  ['excited', 'Jump with cyan glow — task complete or user excitement'],
                  ['happy', 'Bouncy jump, arc-eyed expression'],
                  ['sad', 'Slumped posture, downturned eyes, blue glow'],
                  ['angry', 'Shake + red glow, furrowed brow'],
                  ['thinking', 'Slight tilt, purple glow, thought bubble'],
                  ['confused', 'Rotate, question mark overlay'],
                  ['surprised', 'Jump + exclamation mark overlay'],
                  ['laughing', 'Rapid bounce, "ha ha" particles'],
                  ['love', 'Pulse with pink glow, floating hearts'],
                  ['cool', 'Minimal bob, sunglasses drop-in animation'],
                  ['shy', 'Blush cheeks appear, slow idle'],
                  ['sleep', 'Slow breathe, ZZZ particles, sleeping bag'],
                  ['scared', 'Rapid shake, sweat drop, yellow glow'],
                  ['dizzy', 'Body spin, orbiting stars'],
                  ['bored', 'Droopy posture, "sigh…" text particle'],
                  ['bounce', 'Rapid body bounce — physics collision'],
                  ['spin', '360° rotation — cartwheel / teleport'],
                  ['hover', 'Float above ground — zero-gravity mode'],
                  ['draw', 'Pencil prop appears, writing gesture'],
                ].map(([anim, desc]) => (
                  <div key={anim} className="flex gap-2 p-2.5 rounded-lg bg-secondary/50 border border-border/80">
                    <code className="text-primary font-mono text-xs font-bold flex-shrink-0 mt-0.5">{anim}</code>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>

              <H2>Automatic sentiment mapping</H2>
              <P>JARVIS scans every AI reply for trigger keywords and maps them to animation states:</P>
              <Code lang="typescript">{`const SENTIMENT_MAP: Record<string, CharacterAnimation> = {
  // positive
  done: 'excited',    complete: 'excited',  finished: 'excited',
  great: 'happy',     love: 'love',         haha: 'laughing',
  // negative / error
  sorry: 'sad',       error: 'sad',         failed: 'sad',
  warning: 'scared',  careful: 'scared',
  // cognitive
  hmm: 'thinking',    thinking: 'thinking', let_me: 'thinking',
  // hostile
  no: 'angry',        cannot: 'angry',      stop: 'angry',
};`}</Code>

              <H2>Mood glow filters</H2>
              <P>Moods apply CSS <code>drop-shadow</code> filters that give each emotional state a unique ambient color:</P>
              <Code lang="css">{`.mood-happy    { filter: drop-shadow(0 0 8px rgba(255, 200, 0, 0.5)); }
.mood-sad      { filter: drop-shadow(0 0 8px rgba(100, 150, 255, 0.4)); }
.mood-angry    { filter: drop-shadow(0 0 8px rgba(255, 50, 50, 0.6)); }
.mood-excited  { filter: drop-shadow(0 0 12px rgba(0, 255, 255, 0.7)); }
.mood-love     { filter: drop-shadow(0 0 10px rgba(255, 100, 180, 0.6)); }
.mood-cool     { filter: drop-shadow(0 0 8px rgba(100, 220, 255, 0.5)); }
.mood-thinking { filter: drop-shadow(0 0 6px rgba(180, 100, 255, 0.4)); }
.mood-scared   { filter: drop-shadow(0 0 6px rgba(200, 200, 100, 0.5)); }`}</Code>
            </Section>

            {/* MiniMode */}
            <Section id="minimode">
              <H1>MiniMode</H1>
              <P>MiniMode removes JARVIS from its window and renders your companion directly on the OS desktop layer, above all other windows, with real physics.</P>

              <H2>Activating MiniMode</H2>
              <Code lang="bash">{`# Keyboard shortcut
Ctrl+Shift+M  (Windows 10/11)

# Or click the ⊞ icon in the character overlay controls`}</Code>

              <H2>Physics behaviour</H2>
              <div className="space-y-3 my-4">
                {[
                  ['Gravity', 'Characters fall to the nearest window edge or screen floor'],
                  ['Bounce', 'Collides with window title bars and bounces off them'],
                  ['Drag', 'Click and drag to throw the character across the screen'],
                  ['Window awareness', 'Detects active window bounds and sits on top of them'],
                  ['Sleep', 'After 10 min idle the character enters sleep mode on the floor'],
                ].map(([title, desc]) => (
                  <div key={title as string} className="flex gap-3 p-3 rounded-xl border border-border bg-white">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div><span className="font-semibold text-sm">{title}</span><span className="text-muted-foreground text-sm"> — {desc}</span></div>
                  </div>
                ))}
              </div>

              <H2>Movement modes</H2>
              <P>In MiniMode, JARVIS autonomously roams using these movement types:</P>
              <Code lang="typescript">{`type MovementArc =
  | 'walk'       // standard walk to new position
  | 'run'        // fast movement
  | 'jump'       // arc jump to location
  | 'bounce'     // multi-bounce path
  | 'teleport'   // instant warp (blur effect)
  | 'hover'      // float above floor
  | 'zigzag'     // erratic path
  | 'sneak'      // slow stealth crawl
  | 'cartwheel'  // roll across screen
  | 'pace';      // back-and-forth nervous walk`}</Code>
              <Callout type="info">Movement arcs are chosen automatically based on the destination distance and the character's current mood. Excited characters teleport; sad characters pace.</Callout>
            </Section>

            {/* Voice */}
            <Section id="voice">
              <H1>Voice Control</H1>
              <P>JARVIS features full voice integration with background wake word listener, hands-free voice activity detection (VAD), and multi-engine voice output.</P>

              <H2>Wake word</H2>
              <P>The default wake word is <strong>"hey jarvis"</strong>. This is processed 100% locally and offline on the client side using the <strong>Vosk</strong> engine (loaded from a local <code>vosk-model.zip</code>) to protect your privacy.</P>

              <H2>Speech-to-text (STT)</H2>
              <P>Once the wake word is detected and you stop speaking, the recorded audio segment is sent to the backend and transcribed using Groq's high-speed <strong>Whisper-large-v3</strong> model.</P>

              <H2>Text-to-speech (TTS)</H2>
              <P>JARVIS supports three distinct voice output engines:</P>
              <div className="space-y-3 my-4">
                {[
                  ['🌐 Browser', 'Web Speech API (free, offline system voices). Speed and pitch are adjustable.'],
                  ['🎙️ Orpheus via Groq', 'High-quality expressive English speech synthesis using `canopylabs/orpheus-v1-english`. Supports tone direction tags (e.g. `[cheerful]`, `[whisper]`) and auto-chunking for responses over 175 words.'],
                  ['📂 Custom WAV', 'Specify an absolute local path to a `.wav` file (e.g. C:\\sounds\\jarvis.wav) to play a static SFX notification chime instead of spoken speech.'],
                ].map(([title, desc]) => (
                  <div key={title} className="p-3 rounded-xl border border-border bg-white text-sm">
                    <strong>{title}</strong> — {desc}
                  </div>
                ))}
              </div>
              <Callout type="tip">To use Orpheus, ensure you select **Orpheus via Groq** in Settings under Voice Output, select a voice (autumn, diana, hannah, austin, daniel, troy), and save settings.</Callout>
            </Section>

            {/* Vision */}
            <Section id="vision">
              <H1>Screen Vision</H1>
              <P>JARVIS can capture and interpret your screen contents. This lets it understand what you're working on without you having to describe it.</P>

              <H2>How it works</H2>
              <P>When you ask JARVIS to "look at your screen", it:</P>
              <Code lang="text">{`1. Captures a screenshot of the active window (or full screen)
2. Compresses and crops to the relevant region
3. Sends the image to your configured vision model (GPT-4o, Claude 3, etc.)
4. The model returns a description, and JARVIS acts on it`}</Code>

              <H2>Configuration</H2>
              <Code lang="json">{`{
  "vision": {
    "enabled": true,
    "captureMode": "activeWindow",  // "activeWindow" | "fullScreen" | "region"
    "model": "gpt-4o",
    "maxTokens": 1000,
    "redactPasswords": true          // blur password fields before capture
  }
}`}</Code>
              <Callout type="warn">Screen vision is opt-in. Enable it only if you trust your LLM provider with your screen contents, or use a local model like LLaVA.</Callout>
            </Section>

            {/* Drawing */}
            <Section id="drawing">
              <H1>Screen Drawing</H1>
              <P>JARVIS can annotate your screen by drawing directly on a transparent overlay layer. This is useful for pointing at things, circling errors, or creating visual step-by-step guides.</P>

              <H2>Draw commands</H2>
              <Code lang="text">{`"JARVIS, circle the error on screen"
"Draw an arrow pointing to the submit button"
"Highlight the code block in the editor"
"Clear the drawing"
"Draw step-by-step how to do this"`}</Code>

              <H2>Drawing API</H2>
              <Code lang="typescript">{`interface DrawCommand {
  type: 'arrow' | 'circle' | 'rect' | 'text' | 'highlight' | 'clear';
  x: number;         // screen coordinate (0–1 normalized)
  y: number;
  width?: number;
  height?: number;
  label?: string;    // text for annotations
  color?: string;    // defaults to primary brand color
  duration?: number; // ms before auto-clear (0 = permanent)
}`}</Code>
            </Section>

            {/* Relationship Engine */}
            <Section id="relationship">
              <H1>Relationship Engine</H1>
              <P>JARVIS maintains a persistent <strong>affection score</strong> (0–100) stored locally across sessions. The score grows as you interact and degrades if you neglect JARVIS for more than 48 hours. This score is injected into every LLM message so the AI genuinely adjusts its tone based on your relationship.</P>

              <H2>Mood levels</H2>
              <div className="grid grid-cols-2 gap-3 my-4">
                {[
                  ['Neglected', '0–39 after 24h+ absence', 'bg-slate-50 border-slate-200 text-slate-700'],
                  ['Neutral', '0–39 score', 'bg-blue-50 border-blue-200 text-blue-700'],
                  ['Friendly', '40–74 score', 'bg-green-50 border-green-200 text-green-700'],
                  ['Best Friends', '75–100 score', 'bg-purple-50 border-purple-200 text-purple-700'],
                ].map(([mood, cond, cls]) => (
                  <div key={mood as string} className={`p-3 rounded-xl border text-sm ${cls}`}>
                    <div className="font-bold mb-1">{mood}</div>
                    <div className="text-xs opacity-75">{cond}</div>
                  </div>
                ))}
              </div>

              <H2>How affection grows</H2>
              <div className="space-y-2 my-4">
                {[
                  ['💬 Short reply (< 20 words)', '+1 affection per message'],
                  ['💬 Medium reply (20–50 words)', '+2 affection per message'],
                  ['💬 Long detailed reply (50+ words)', '+3 affection per message'],
                  ['🐾 Petting the character in MiniMode', '+5 affection (vigorous mouse-over)'],
                  ['📁 Dropping a file onto the character', '+2 affection'],
                  ['⏰ 48+ hours without interaction', '−5 affection (passive decay)'],
                ].map(([action, effect]) => (
                  <div key={action as string} className="flex justify-between text-sm p-2 rounded-lg bg-secondary/50 border border-border">
                    <span>{action}</span>
                    <span className="font-mono text-primary font-semibold">{effect}</span>
                  </div>
                ))}
              </div>
              <Callout type="info">The mood and affection score are sent to the LLM with every message as a system note. JARVIS will genuinely speak differently when you are <strong>Best Friends</strong> versus when you have been <strong>Neglected</strong> for two days.</Callout>
            </Section>

            {/* Contextual Awareness */}
            <Section id="contextual">
              <H1>Contextual Awareness Mode</H1>
              <P>When enabled, JARVIS actively watches your active windows and system events and <strong>reacts proactively</strong> — commenting on what you are doing, offering help, or cracking jokes — without you having to say a word.</P>

              <H2>Enabling it</H2>
              <P>Go to <strong>Settings → Voice & Behavior → Contextual Awareness Mode</strong> and toggle the switch on.</P>

              <H2>Persona selector</H2>
              <P>When Contextual Awareness Mode is on, you can also pick how JARVIS behaves:</P>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
                {[
                  ['Friendly & Helpful', 'Warm, supportive, focused on getting things done.'],
                  ['Funny & Playful', 'Makes jokes, uses memes, keeps things light.'],
                  ['Sarcastic & Witty', 'Dry humour, playful jabs, still gets the job done.'],
                  ['Professional Assistant', 'Concise, formal, no fluff.'],
                  ['Chaotic & Random', 'Unpredictable, wild, chaotic energy.'],
                ].map(([name, desc]) => (
                  <div key={name as string} className="p-3 rounded-xl border border-border bg-white text-sm">
                    <div className="font-semibold mb-0.5">{name}</div>
                    <div className="text-muted-foreground text-xs">{desc}</div>
                  </div>
                ))}
              </div>

              <H2>Attention seeker</H2>
              <P>If JARVIS is in MiniMode and you have not interacted for <strong>15 minutes</strong>, it will grab your attention using one of three behaviours (chosen randomly):</P>
              <div className="space-y-2 my-4 text-sm">
                {[
                  ['🌀 Physics tumble', 'Throws itself across the screen with a dizzy animation.'],
                  ['❓ Canvas drawing', 'Draws a giant animated question mark on your screen.'],
                  ['👀 Jealous screen capture', 'Captures your screen and sends a sassy one-liner reacting to what it sees.'],
                ].map(([icon, desc]) => (
                  <div key={icon as string} className="flex gap-3 p-3 rounded-xl border border-border bg-white">
                    <span className="text-xl">{icon}</span>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Drag & Drop */}
            <Section id="dragdrop">
              <H1>Drag & Drop Files</H1>
              <P>You can drag files directly onto the floating MiniMode character — it will read the file and automatically send its contents to the AI for analysis or action.</P>

              <H2>Supported file types</H2>
              <div className="space-y-3 my-4">
                {[
                  ['🖼️ Images (PNG, JPG, GIF, WebP)', 'Character jumps excitedly, says "Ooh, yummy data!", then sends the image to the vision model for analysis. You get a full description and can ask follow-up questions about it.'],
                  ['📄 Text & Code files (.txt, .ts, .py, .md, ...)', 'File contents are read as UTF-8 text and sent to the AI. Useful for asking JARVIS to review, explain, or edit a file instantly.'],
                  ['🚫 Video / Audio files', 'Not supported yet. JARVIS will show a "can\'t eat this" message.'],
                  ['🚫 Files over 2 MB', 'Rejected with a "too big" message to avoid overloading context.'],
                ].map(([type, desc]) => (
                  <div key={type as string} className="p-3 rounded-xl border border-border bg-white">
                    <div className="font-semibold text-sm mb-1">{type}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                ))}
              </div>
              <Callout type="tip">Dropping a file also gives JARVIS a <strong>+2 affection boost</strong> — it treats it as you sharing something with it.</Callout>
            </Section>

            {/* Agents */}
            <Section id="agents">
              <H1>AI Agents</H1>
              <P>JARVIS is powered by a LangGraph multi-agent system. When you ask it to do something complex, it spins up a graph of specialized agents that plan, execute, and verify the task.</P>

              <H2>Agent types</H2>
              <div className="space-y-3 my-4">
                {[
                  ['Planner', 'Creates the step-by-step execution plan based on the objective and system context.'],
                  ['Executor', 'Executes the current step by invoking the appropriate local or system tool.'],
                  ['Observer', 'Inspects tool outputs and collects evidence of what changed.'],
                  ['Verifier', 'Compares actual observations against expected outcomes to check step success.'],
                  ['Replanner', 'Re-evaluates and revises the plan from the failure point if steps keep failing.'],
                  ['Synthesizer', 'Combines all step execution results and observations into a conversational final answer.'],
                ].map(([name, desc]) => (
                  <div key={name as string} className="p-3 rounded-xl border border-border bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{name}</code>
                    </div>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>

              <H2>Tools & automation capabilities</H2>
              <P>Agents have access to 18 tool modules across 6 categories. Each tool call is displayed as an emoji accessory badge on the character overlay in real time.</P>
              <div className="space-y-4 my-4">
                {[
                  {
                    category: '🌐 Web & Browsing',
                    badge: '🔍',
                    tools: [
                      ['search_web', 'Full-text web search with result summaries'],
                      ['open_website', 'Open a URL in the system browser'],
                      ['browser (Playwright)', 'Headless browser — fill forms, click buttons, scrape dynamic pages'],
                      ['cdpBrowser', 'Chrome DevTools Protocol — low-level browser automation'],
                      ['web', 'Fetch and parse raw HTML or JSON from any URL'],
                    ]
                  },
                  {
                    category: '🖥️ System & Automation',
                    badge: '💻 / 🚀',
                    tools: [
                      ['shell / run_command', 'Execute PowerShell, CMD, or Bash commands (requires user approval)'],
                      ['computer', 'Mouse clicks, keyboard input, and screenshot capture via RobotJS'],
                      ['uiautomation', 'Windows UI Automation — interact with any native Win32 UI element'],
                      ['windowsSystem', 'Window management, focus control, taskbar, and system queries'],
                      ['everything', 'Instant file search across the entire disk via Voidtools Everything'],
                    ]
                  },
                  {
                    category: '📁 File System',
                    badge: '📄',
                    tools: [
                      ['fs (read_file)', 'Read any file from disk as text or binary'],
                      ['fs (write_file)', 'Create or overwrite files (requires approval)'],
                      ['fs (list_dir)', 'List directory contents with metadata'],
                    ]
                  },
                  {
                    category: '🧠 Memory & Scheduling',
                    badge: '',
                    tools: [
                      ['memory', 'Persistent vector memory — store and recall facts about you across sessions'],
                      ['cron', 'Schedule tasks to run at a specific time or on a recurring interval'],
                    ]
                  },
                  {
                    category: '🎨 UI & Notifications',
                    badge: '',
                    tools: [
                      ['drawing', 'Draw arrows, circles, text, and highlights on a screen overlay'],
                      ['notify', 'Send a native OS desktop notification with title and body'],
                    ]
                  },
                  {
                    category: '🔗 Integrations',
                    badge: '📝 🎵 🐙',
                    tools: [
                      ['notion', 'Search, read, and query your Notion workspace pages'],
                      ['spotify', 'Play, pause, skip, search tracks, and control Spotify playback'],
                      ['github', 'Read repos, list issues/PRs, view files, and check commits'],
                    ]
                  },
                ].map(({ category, tools }) => (
                  <div key={category} className="rounded-xl border border-border bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-secondary/50 border-b border-border font-semibold text-sm">{category}</div>
                    <div className="divide-y divide-border/50">
                      {tools.map(([name, desc]) => (
                        <div key={name} className="flex gap-3 px-4 py-2.5 text-sm">
                          <code className="text-primary font-mono text-xs font-bold shrink-0 mt-0.5 min-w-[140px]">{name}</code>
                          <span className="text-muted-foreground">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Callout type="warn">Shell, file-write, and computer-control operations always require explicit user approval via an in-app confirmation prompt before executing.</Callout>
            </Section>

            {/* Integrations */}
            <Section id="integrations">
              <H1>Integrations</H1>
              <P>JARVIS features native integrations with popular apps and platforms, enabling remote control, productivity syncing, and media playback control.</P>

              <H2>1. Telegram Sync</H2>
              <P>Send notification messages to your desktop companion remotely via a Telegram bot.</P>
              <Code lang="bash">{`# 1. Create a Telegram bot via @BotFather
#    Send: /newbot  →  follow prompts  →  copy the API token

# 2. Add the token to JARVIS settings
#    Settings → Integrations → Telegram → Paste token

# 3. Message the bot
#    Open your Telegram bot and send any text message. It will be immediately 
#    forwarded and broadcast as a system notification on your desktop assistant.`}</Code>

              <H2>2. Discord Integration</H2>
              <P>Control or receive notifications from your desktop assistant via a Discord bot client.</P>
              <Code lang="bash">{`# 1. Create a Discord Application
#    Go to discord.com/developers/applications, create an App and add a Bot.

# 2. Save the Bot Token in JARVIS Settings
#    Settings → Integrations → Discord Bot Token`}</Code>

              <H2>3. Notion Workspace</H2>
              <P>Allow JARVIS to query pages, search documents, and read page content directly from your Notion workspace.</P>
              <Code lang="bash">{`# 1. Create a Notion Integration
#    Go to developers.notion.com, select "My Integrations", create a token.

# 2. Copy the Internal Integration Token
#    Add the key to Settings → Integrations → notionApiKey

# 3. Share Pages/Databases
#    Open the Notion page, click Options (...), select "Add connections", and select your integration.`}</Code>

              <H2>4. Spotify Player</H2>
              <P>Command JARVIS to query playlists, play/pause music tracks, skip songs, or fetch playback states.</P>
              <Code lang="bash">{`# 1. Create a Spotify Developer App
#    Go to developer.spotify.com, create an app, and copy Client ID & Client Secret.

# 2. Save client keys in JARVIS Settings
#    Settings → Integrations → spotifyClientId & spotifyClientSecret

# 3. Set Redirect URI
#    Add redirect URL pointing to the local api-server authentication route.`}</Code>

              <H2>5. GitHub Developer Access</H2>
              <P>Query repository status, list issues/PRs, view files, or check commit details.</P>
              <Code lang="bash">{`# 1. Generate GitHub Personal Access Token (PAT)
#    Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Generate token (classic or fine-grained).

# 2. Save token in JARVIS Settings
#    Settings → Integrations → githubPat`}</Code>
            </Section>

            {/* Config */}
            <Section id="config">
              <H1>Configuration</H1>
              <P>Unlike traditional apps, JARVIS persists all settings, memory, and chat history in a local SQLite database file on your machine managed via Drizzle ORM:</P>
              <Code lang="bash">{`# Windows Database Path
%APPDATA%\\JARVIS\\sqlite.db

# Developer Environment Path (Root Workspace)
E:\\Jarvis-Assistant-Companionzip\\sqlite.db`}</Code>

              <H2>Settings Table Schema</H2>
              <P>When reading or modifying settings via the Drizzle settings schema or backend REST routes, the fields mapped are as follows (Groq and Nvidia API keys are both required, and models are pre-selected by default):</P>
              <Code lang="json">{`{
  "id": 1,
  "groqApiKey": "gsk_...",              // Groq API Key (Required, masked on frontend)
  "nvidiaApiKey": "nvapi-...",          // Nvidia API Key (Required, masked on frontend)
  "selectedModel": "llama-3.3-70b-versatile", // Pre-selected by default
  "selectedProvider": "groq",           // Pre-selected by default
  "wakeWord": "hey jarvis",
  "voiceEnabled": true,
  "selectedCharacterId": "jarvis-bot",
  "miniModeEnabled": false,             // Floating overlay mode
  "telegramBotToken": "bot...",         // Optional Telegram Sync token
  "discordBotToken": "Nz...",           // Optional Discord Integration token
  "notionApiKey": "secret_...",         // Notion workspace integration key
  "spotifyClientId": "4a...",           // Spotify Developer API key
  "spotifyClientSecret": "e7...",       // Spotify Client Secret key
  "githubPat": "ghp_..."                // GitHub Personal Access Token
}`}</Code>
              <Callout type="tip">API keys are securely stored server-side. The Settings endpoints (`GET /api/settings`) automatically mask these keys for security before returning settings to the React frontend.</Callout>

              <div className="mt-12 pt-8 border-t border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">© {new Date().getFullYear()} JARVIS Project — MIT License</div>
                <a href="https://github.com/Abhishekkkk-15/jarvis-assistant" target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                  <ExternalLink className="w-4 h-4" /> GitHub
                </a>
              </div>
            </Section>

          </div>
        </main>
      </div>
    </div>
  );
};
