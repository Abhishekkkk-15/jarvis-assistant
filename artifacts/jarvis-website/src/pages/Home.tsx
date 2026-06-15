import React, { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { triggerDownload } from "../lib/utils";
import {
  Download, Github, Mic, PenTool, Monitor, Network,
  MessageSquare, ChevronRight, Bot, Star, Eye, ArrowRight, Book
} from "lucide-react";
import {
  JarvisBot, PixelFox, SpaceCat, FireDrake, Ninja, Wizard,
  CyberPunk, MinionBob, AlienDude, Astronaut, SpaceBean,
  SpiderMan, IronHero, ElectricMouse, DarkKnight, NinjaTurtle,
  PirateCaptain, ZombieGuy, CyberBot, VampireLord, GhostBoo,
  SamuraiWarrior, type CharacterAnimation
} from "../characters/CharacterRenderer";

// ─── Animated Character helper ───────────────────────────────────────────────
const CYCLE: CharacterAnimation[] = ['idle', 'wave', 'dance', 'excited', 'happy', 'thinking', 'cool'];

export const AnimatedCharacter = ({
  Component, size = 120, offset = 0, defaultAnim = 'idle', forcedAnim, loop = true,
}: {
  Component: React.FC<any>; size?: number; offset?: number;
  defaultAnim?: CharacterAnimation; forcedAnim?: CharacterAnimation | null; loop?: boolean;
}) => {
  const [anim, setAnim] = useState<CharacterAnimation>(defaultAnim);
  const [isBlinking, setIsBlinking] = useState(false);


  useEffect(() => {
    if (forcedAnim) { setAnim(forcedAnim); return; }
    if (!loop) return;
    const t = setTimeout(() => {
      const id = setInterval(() => {
        setAnim(p => { const i = CYCLE.indexOf(p); return CYCLE[(i + 1) % CYCLE.length]; });
      }, 2800);
      return () => clearInterval(id);
    }, offset * 800);
    return () => clearTimeout(t);
  }, [offset, forcedAnim, loop]);

  useEffect(() => {
    const blink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 140);
      setTimeout(blink, 2000 + Math.random() * 4000);
    };
    const t = setTimeout(blink, Math.random() * 3000 + offset * 500);
    return () => clearTimeout(t);
  }, [offset]);

  return <Component animation={anim} size={size} isBlinking={isBlinking} />;
};

// ─── Stat counter ─────────────────────────────────────────────────────────────
const StatCounter = ({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let s = 0;
    const inc = value / (1400 / 16);
    const id = setInterval(() => {
      s += inc;
      if (s >= value) { setCount(value); clearInterval(id); }
      else setCount(Math.floor(s));
    }, 16);
    return () => clearInterval(id);
  }, [inView, value]);
  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl md:text-5xl font-extrabold text-foreground tabular-nums">{count}{suffix}</div>
      <div className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-widest">{label}</div>
    </div>
  );
};

// ─── Hero ─────────────────────────────────────────────────────────────────────
export const HeroSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const charsY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const [stars, setStars] = useState(0)

  async function fetchGithubStars() {
    const res = await fetch(
      "https://api.github.com/repos/abhishekkkk-15/jarvis-assistant"
    );

    const repo = await res.json();

    console.log(repo.stargazers_count);
    setStars(repo.stargazers_count)
  }
  useEffect(() => {
    fetchGithubStars()
  }, [])
  return (
    <section ref={ref} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/8 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[500px] h-[400px] bg-violet-300/5 rounded-full blur-[100px]" />
      </div>

      <motion.div style={{ y: heroY, opacity }} className="text-center max-w-4xl mx-auto px-4 mb-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-8 border border-primary/20"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          JARVIS v1.0 — Open Source, Runs Locally
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-6xl md:text-8xl font-extrabold tracking-tight text-foreground mb-6 leading-[0.92]"
        >
          An AI that{' '}
          <span className="relative inline-block text-primary">
            lives
            <svg className="absolute -bottom-1 left-0 w-full overflow-visible" viewBox="0 0 120 6" fill="none">
              <motion.path
                d="M2 4 C 25 1, 50 5, 75 2 C 95 0, 110 4, 118 3"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="text-primary/50"
              />
            </svg>
          </span>{' '}
          on<br className="hidden md:block" /> your desktop.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Choose a character companion, give it a voice, let it see your screen — and watch it automate your day.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button onClick={triggerDownload} size="lg" className="h-14 px-10 text-base shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all">
            <Download className="mr-2 h-5 w-5" /> Download Free
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-10 text-base" asChild>
            <Link href="/docs">
              <span className="flex items-center">
                <Book className="mr-2 h-5 w-5" />
                Read the Docs
              </span>
            </Link>
          </Button>
          <Button size="lg" variant="ghost" className="h-14 px-8 text-base text-muted-foreground hover:text-foreground">
            <Github className="mr-2 h-5 w-5" />
            <Star className="w-3.5 h-3.5 mr-1" />{stars}
          </Button>
        </motion.div>
      </motion.div>

      <motion.div style={{ y: charsY, opacity }} className="w-full max-w-5xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-end justify-center gap-1 sm:gap-4 md:gap-8"
        >
          {[
            { C: Astronaut, s: 90, off: 3 },
            { C: PixelFox, s: 120, off: 0.6 },
            { C: SpaceCat, s: 145, off: 1.8 },
            { C: JarvisBot, s: 200, off: 0, def: 'wave' as CharacterAnimation },
            { C: FireDrake, s: 145, off: 1.2 },
            { C: Wizard, s: 120, off: 0.3 },
            { C: Ninja, s: 90, off: 2.2 },
          ].map(({ C, s, off, def }, i) => (
            <motion.div
              key={i}
              className={`${i === 0 || i === 6 ? 'hidden sm:block opacity-60' : i === 3 ? 'z-10 drop-shadow-2xl' : 'opacity-85'} hover:opacity-100 transition-opacity`}
              whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}
            >
              <AnimatedCharacter Component={C} size={s} offset={off} defaultAnim={def ?? 'idle'} />
            </motion.div>
          ))}
        </motion.div>
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mt-2" />
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground/40"
      >
        <div className="flex flex-col items-center gap-1 text-xs font-medium tracking-widest uppercase">
          <span>Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-muted-foreground/40 to-transparent" />
        </div>
      </motion.div>
    </section>
  );
};

// ─── Scroll Story ─────────────────────────────────────────────────────────────
const STORY_CHAPTERS = [
  {
    tag: "Chapter 01",
    title: "Pick your companion.",
    body: "Choose from 22 fully-animated characters — from a nano-robot to a space dragon. Each one has its own personality, emotions, and voice.",
    Character: JarvisBot,
    anim: 'wave' as CharacterAnimation,
    accent: "text-blue-500",
    bg: "from-blue-50/80",
  },
  {
    tag: "Chapter 02",
    title: "It watches. It listens.",
    body: "JARVIS sees your screen, hears your voice, and reads your context. It knows when you're coding, when you're stuck, and when you need help.",
    Character: SpaceCat,
    anim: 'thinking' as CharacterAnimation,
    accent: "text-indigo-500",
    bg: "from-indigo-50/80",
  },
  {
    tag: "Chapter 03",
    title: "Then it gets things done.",
    body: "Backed by LangGraph agents, it browses the web, writes code, sends emails, and manages files. Not just a chat window — an autonomous teammate.",
    Character: FireDrake,
    anim: 'excited' as CharacterAnimation,
    accent: "text-emerald-500",
    bg: "from-emerald-50/80",
  },
  {
    tag: "Chapter 04",
    title: "And it stays with you.",
    body: "In MiniMode, your character drops onto your real desktop with physics. They bounce, sleep, hang, and cheer — always there, never in the way.",
    Character: PixelFox,
    anim: 'dance' as CharacterAnimation,
    accent: "text-violet-500",
    bg: "from-violet-50/80",
  },
];

const StoryChapter: React.FC<{ c: typeof STORY_CHAPTERS[0]; index: number }> = ({ c, index }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-30% 0px -30% 0px" });

  return (
    <div
      ref={ref}
      className={`h-screen flex items-center relative overflow-hidden scroll-story ${index === 0 ? '' : ''}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} to-white`} />
      <div className="max-w-6xl mx-auto px-4 w-full grid grid-cols-1 md:grid-cols-2 items-center gap-12 md:gap-20 relative z-10">
        {/* Text */}
        <motion.div
          animate={{ opacity: inView ? 1 : 0, x: inView ? 0 : -50 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={`text-sm font-bold uppercase tracking-widest ${c.accent} mb-4 block`}>{c.tag}</span>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
            {c.title}
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">{c.body}</p>
        </motion.div>

        {/* Character card */}
        <motion.div
          className="flex items-center justify-center"
          animate={{ opacity: inView ? 1 : 0, scale: inView ? 1 : 0.85, y: inView ? 0 : 30 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        >
          <div className="relative w-64 h-64 md:w-80 md:h-80">
            <div className="w-full h-full rounded-[40px] bg-white border border-border shadow-xl flex items-center justify-center relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${c.bg} to-white opacity-70`} />
              <c.Character animation={c.anim} size={180} />
              <motion.div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-muted-foreground bg-white/90 backdrop-blur-sm border border-border rounded-full px-3 py-1"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {c.anim} mode
              </motion.div>
            </div>
            <motion.div
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary z-10"
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </div>

      {/* Chapter progress indicator */}
      <div className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
        {STORY_CHAPTERS.map((_, i) => (
          <motion.div
            key={i}
            animate={{ scale: i === index ? 1 : 0.5, opacity: i === index ? 1 : 0.25 }}
            className="w-2.5 h-2.5 rounded-full bg-primary"
          />
        ))}
      </div>
    </div>
  );
};

export const ScrollStory = () => (
  <div className="scroll-story">
    {STORY_CHAPTERS.map((c, i) => (
      <StoryChapter key={i} c={c} index={i} />
    ))}
  </div>
);

// ─── Stats ────────────────────────────────────────────────────────────────────
export const StatsSection = () => (
  <section className="py-16 bg-secondary/40 border-y border-border">
    <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-10">
      <StatCounter value={22} label="Characters" suffix="+" />
      <StatCounter value={38} label="Animations each" suffix="+" />
      <StatCounter value={100} label="Runs locally" suffix="%" />
      <StatCounter value={0} label="Subscription" suffix="$" />
    </div>
  </section>
);

// ─── Emotion Playground ───────────────────────────────────────────────────────
const EMOTIONS: { anim: CharacterAnimation; emoji: string; label: string; color: string }[] = [
  { anim: 'idle', emoji: '😌', label: 'Idle', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { anim: 'wave', emoji: '👋', label: 'Wave', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { anim: 'dance', emoji: '🎵', label: 'Dance', color: 'bg-purple-50 text-purple-700 border-purple-100' },
  { anim: 'excited', emoji: '⚡', label: 'Excited', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
  { anim: 'happy', emoji: '😊', label: 'Happy', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  { anim: 'sad', emoji: '😔', label: 'Sad', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { anim: 'angry', emoji: '😤', label: 'Angry', color: 'bg-red-50 text-red-700 border-red-100' },
  { anim: 'love', emoji: '❤️', label: 'Love', color: 'bg-pink-50 text-pink-700 border-pink-100' },
  { anim: 'thinking', emoji: '🤔', label: 'Thinking', color: 'bg-violet-50 text-violet-700 border-violet-100' },
  { anim: 'cool', emoji: '😎', label: 'Cool', color: 'bg-teal-50 text-teal-700 border-teal-100' },
  { anim: 'sleep', emoji: '💤', label: 'Sleep', color: 'bg-slate-50 text-slate-500 border-slate-100' },
  { anim: 'confused', emoji: '❓', label: 'Confused', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  { anim: 'laughing', emoji: '😄', label: 'Laugh', color: 'bg-lime-50 text-lime-700 border-lime-100' },
  { anim: 'scared', emoji: '😰', label: 'Scared', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { anim: 'dizzy', emoji: '⭐', label: 'Dizzy', color: 'bg-rose-50 text-rose-700 border-rose-100' },
  { anim: 'shy', emoji: '🌸', label: 'Shy', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100' },
];

const CHAR_PICKS = [
  { name: 'JARVIS', C: JarvisBot },
  { name: 'Pixel Fox', C: PixelFox },
  { name: 'Space Cat', C: SpaceCat },
  { name: 'Fire Drake', C: FireDrake },
  { name: 'Ninja', C: Ninja },
  { name: 'Wizard', C: Wizard },
  { name: 'Cyberpunk', C: CyberPunk },
  { name: 'Minion', C: MinionBob },
  { name: 'Alien', C: AlienDude },
  { name: 'Astronaut', C: Astronaut },
  { name: 'Spider-Man', C: SpiderMan },
  { name: 'Iron Hero', C: IronHero },
];

export const EmotionPlayground = () => {
  const [sel, setSel] = useState<CharacterAnimation>('wave');
  const [charIdx, setCharIdx] = useState(0);
  const [burst, setBurst] = useState(false);

  const pick = (a: CharacterAnimation) => {
    setSel(a);
    if (['excited', 'happy', 'dance', 'love', 'laughing'].includes(a)) {
      setBurst(true); setTimeout(() => setBurst(false), 900);
    }
  };

  const C = CHAR_PICKS[charIdx].C;

  return (
    <section id="emotions" className="py-24 px-4 bg-white border-b border-border">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
            They actually <span className="text-primary">feel things.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Emotions are driven by AI context — your words, completed tasks, time of day. Try them yourself below.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-shrink-0 flex flex-col items-center gap-5">
            <div className="relative w-60 h-60 rounded-3xl bg-gradient-to-br from-secondary to-secondary/40 border border-border flex items-center justify-center shadow-inner">
              <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_60%,hsl(239_84%_67%/0.07),transparent_70%)]" />
              <AnimatePresence mode="wait">
                <motion.div key={charIdx} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.25 }}>
                  <C animation={sel} size={150} showParticleBurst={burst} />
                </motion.div>
              </AnimatePresence>
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-bold border border-border shadow-sm">
                {EMOTIONS.find(e => e.anim === sel)?.emoji} {sel}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              {CHAR_PICKS.map((c, i) => (
                <button key={c.name} onClick={() => setCharIdx(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${charIdx === i ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-primary'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-4 gap-2">
            {EMOTIONS.map(({ anim, emoji, label, color }) => (
              <motion.button key={anim} whileTap={{ scale: 0.92 }} onClick={() => pick(anim)}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${color} ${sel === anim ? 'ring-2 ring-primary ring-offset-1 shadow-md scale-105' : 'hover:scale-102'}`}>
                <span className="text-xl leading-none">{emoji}</span>
                <span>{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Mic, title: "Wake Word", body: "Say 'Hey JARVIS' anywhere. No clicks needed.", C: JarvisBot, anim: 'talk' as CharacterAnimation },
  { icon: Monitor, title: "MiniMode", body: "Characters with real physics on your desktop.", C: PixelFox, anim: 'bounce' as CharacterAnimation },
  { icon: Eye, title: "Screen Vision", body: "Reads your screen, understands your context.", C: SpaceCat, anim: 'thinking' as CharacterAnimation },
  { icon: PenTool, title: "Draw on Screen", body: "Annotates your display live with arrows & text.", C: CyberPunk, anim: 'draw' as CharacterAnimation },
  { icon: Network, title: "LangGraph AI", body: "Multi-agent loop: plan → validate → execute → verify → synthesize.", C: AlienDude, anim: 'excited' as CharacterAnimation },
  { icon: MessageSquare, title: "Telegram Sync", body: "Control your desktop agent remotely via Telegram.", C: Astronaut, anim: 'wave' as CharacterAnimation },
];

export const FeaturesSection = () => (
  <section id="features" className="py-24 px-4 bg-secondary/30">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
          Seriously powerful.<br />
          <span className="text-primary">Surprisingly delightful.</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-lg">Under the hood, a serious automation tool. On the surface, a companion you'll look forward to opening.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((f, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} whileHover={{ y: -5 }}
            className="bg-white rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-all flex flex-col group">
            <div className="flex items-start justify-between mb-5">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                <f.icon className="w-5 h-5" />
              </div>
              <div className="w-16 h-16 flex-shrink-0">
                <f.C animation={f.anim} size={64} />
              </div>
            </div>
            <h3 className="text-lg font-bold mb-2">{f.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed flex-1">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Chat Demo ────────────────────────────────────────────────────────────────
const MSGS = [
  { from: 'user', text: 'Hey JARVIS, summarise my emails from today.' },
  { from: 'jarvis', text: "Done! 12 new emails. 3 need urgent replies — your manager twice and an invoice due tomorrow. Draft responses?", anim: 'talk' as CharacterAnimation },
  { from: 'user', text: 'Yes, and set a reminder for the invoice.' },
  { from: 'jarvis', text: "Drafts saved. Reminder set for 9 AM tomorrow. 🎉", anim: 'excited' as CharacterAnimation },
];

export const ChatDemoSection = () => {
  const [vis, setVis] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    const show = (i: number) => { if (i >= MSGS.length) return; setVis(i + 1); setTimeout(() => show(i + 1), 1300); };
    setTimeout(() => show(0), 200);
  }, [inView]);

  const curAnim = [...MSGS].slice(0, vis).reverse().find(m => m.from === 'jarvis')?.anim ?? 'idle';

  return (
    <section className="chat-demo-section py-24 px-4 bg-white border-y border-border">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex-1">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Have a real conversation.<br /><span className="text-primary">Watch them react.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8">Every reply shifts their mood — face, posture, energy. JARVIS isn't reading a script; it's feeling the moment.</p>
          {['Sentiment-aware animation', 'Eye tracking follows cursor', 'Lip-sync during voice', 'Particle burst on task complete'].map((b, i) => (
            <div key={i} className="flex items-center gap-3 text-sm font-medium mb-3">
              <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0"><ChevronRight className="w-3 h-3" /></div>
              {b}
            </div>
          ))}
        </motion.div>

        <div ref={ref} className="flex-1 w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-white">
            <div className="bg-secondary px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="flex gap-1.5">
                {['bg-red-400', 'bg-yellow-400', 'bg-green-400'].map(c => <div key={c} className={`w-3 h-3 rounded-full ${c}`} />)}
              </div>
              <div className="flex-1 text-center text-xs font-semibold text-muted-foreground">JARVIS Assistant</div>
              <JarvisBot animation={curAnim} size={28} />
            </div>
            <div className="p-4 space-y-3 min-h-[240px] bg-white">
              <AnimatePresence>
                {MSGS.slice(0, vis).map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3 }}
                    className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] text-sm rounded-2xl px-4 py-2.5 ${m.from === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-secondary text-foreground rounded-bl-sm'}`}>
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {vis < MSGS.length && vis > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                    {[0, 0.2, 0.4].map((d, i) => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, delay: d, repeat: Infinity }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ─── Meet the Cast ────────────────────────────────────────────────────────────
const CAST = [
  { C: JarvisBot, name: "JARVIS Bot", tag: "The Classic" },
  { C: PixelFox, name: "Pixel Fox", tag: "The Trickster" },
  { C: SpaceCat, name: "Space Cat", tag: "The Explorer" },
  { C: FireDrake, name: "Fire Drake", tag: "The Fierce" },
  { C: Ninja, name: "Ninja", tag: "The Silent" },
  { C: Wizard, name: "Wizard", tag: "The Wise" },
  { C: CyberPunk, name: "Cyberpunk", tag: "The Rebel" },
  { C: MinionBob, name: "Minion Bob", tag: "The Goofball" },
  { C: AlienDude, name: "Alien Dude", tag: "The Oddball" },
  { C: Astronaut, name: "Astronaut", tag: "The Drifter" },
  { C: SpaceBean, name: "Space Bean", tag: "The Wanderer" },
  { C: SpiderMan, name: "Spider-Man", tag: "The Wall-Crawler" },
  { C: IronHero, name: "Iron Hero", tag: "The Titan" },
  { C: ElectricMouse, name: "Electric Mouse", tag: "The Spark" },
  { C: DarkKnight, name: "Dark Knight", tag: "The Vigilante" },
  { C: NinjaTurtle, name: "Ninja Turtle", tag: "The Radical" },
  { C: PirateCaptain, name: "Pirate Captain", tag: "The Seafarer" },
  { C: ZombieGuy, name: "Zombie Guy", tag: "The Undead" },
  { C: CyberBot, name: "Cyber Bot", tag: "The Machine" },
  { C: VampireLord, name: "Vampire Lord", tag: "The Immortal" },
  { C: GhostBoo, name: "Ghost Boo", tag: "The Phantom" },
  { C: SamuraiWarrior, name: "Samurai", tag: "The Blade" },
];

const HOVER_ANIMS: CharacterAnimation[] = ['wave', 'dance', 'excited', 'happy', 'love', 'cool', 'laughing', 'shy', 'surprised', 'thinking'];

const CastCard = ({ C, name, tag, idx }: { C: React.FC<any>; name: string; tag: string; idx: number }) => {
  const [hovered, setHovered] = useState(false);
  const hoverAnim = HOVER_ANIMS[idx % HOVER_ANIMS.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)}
      className="flex flex-col items-center bg-white p-5 rounded-2xl border border-border cursor-default hover:shadow-xl hover:border-primary/30 transition-all relative"
    >
      <div className="h-24 flex items-center justify-center mb-3 relative">
        <C animation={hovered ? hoverAnim : 'idle'} size={80} />
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity: 0, scale: 0.7, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.7 }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
              {hoverAnim}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className="font-bold text-sm">{name}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{tag}</span>
    </motion.div>
  );
};

export const MeetTheCast = () => (
  <section id="cast" className="py-24 px-4 bg-secondary/20">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Meet the cast.</h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">22 companions, each with their own look, voice, and emotional range. Hover to see them come alive.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {CAST.map(({ C, name, tag }, i) => (
          <CastCard key={name} C={C} name={name} tag={tag} idx={i} />
        ))}
      </div>
    </div>
  </section>
);

// ─── CTA ──────────────────────────────────────────────────────────────────────
export const CTASection = () => (
  <section className="py-32 px-4 relative overflow-hidden bg-primary">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,0,0,0.12),transparent_60%)]" />
    <div className="max-w-4xl mx-auto text-center relative z-10">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="flex justify-center mb-8">
        <JarvisBot animation="dance" size={130} />
      </motion.div>
      <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">Wake up your desktop.</h2>
      <p className="text-xl text-white/75 mb-10 max-w-xl mx-auto">Free. Open-source. 100% local. No accounts, subscriptions, or cloud required.</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Button onClick={triggerDownload} size="lg" className="h-14 px-10 text-base bg-white text-primary hover:bg-white/95 shadow-2xl w-full sm:w-auto font-bold">
          <Download className="mr-2 h-5 w-5" /> Get JARVIS Free
        </Button>
        <Link href="/docs" passHref>
          <Button size="lg" variant="outline" className="h-14 px-10 text-base border-white/30 text-white hover:bg-white/10 w-full sm:w-auto">
            <Book className="mr-2 h-5 w-5" /> Read the Docs <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  </section>
);

// ─── Footer ───────────────────────────────────────────────────────────────────
export const Footer = () => (
  <footer className="py-10 bg-white border-t border-border">
    <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2 font-bold text-foreground"><Bot className="w-5 h-5 text-primary" /> JARVIS Project</div>
      <p>© {new Date().getFullYear()} JARVIS. Open source — MIT License.</p>
      <div className="flex gap-6">
        {['GitHub'].map(l => <a key={l} href="https://github.com/abhishekkkk-15/jarvis-assistant" className="hover:text-primary transition-colors">{l}</a>)}
      </div>
    </div>
  </footer>
);
