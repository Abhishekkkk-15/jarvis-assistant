import React, { useState, useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  motion, useMotionValue, useSpring, AnimatePresence
} from "framer-motion";
import { Bot, Book, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  JarvisBot,
  type CharacterAnimation
} from "./characters/CharacterRenderer";
import {
  HeroSection, ScrollStory, StatsSection, EmotionPlayground,
  FeaturesSection, ChatDemoSection, MeetTheCast, CTASection, Footer
} from "./pages/Home";
import { DocsPage } from "./pages/Docs";

const queryClient = new QueryClient();

// ─── Section quips ────────────────────────────────────────────────────────────
const SECTION_QUIPS: Record<string, { text: string; anim: CharacterAnimation }> = {
  hero:      { text: "Hey! I live on your desktop 👋",    anim: 'wave'     },
  story:     { text: "Which one will you choose? 🤔",      anim: 'thinking' },
  emotions:  { text: "Try clicking 'Angry'… I dare you 😤", anim: 'excited' },
  features:  { text: "Psst — I can do ALL of this!",       anim: 'excited'  },
  chat:      { text: "That's literally me in there!",       anim: 'happy'    },
  cast:      { text: "Pick me! Pick me! 🙋",               anim: 'wave'     },
  cta:       { text: "Download is free, I promise 🎉",      anim: 'dance'    },
  default:   { text: "Hey! 👋",                             anim: 'idle'     },
};

// ─── Mouse-Following Character ─────────────────────────────────────────────────
const MouseFollower: React.FC<{ show: boolean }> = ({ show }) => {
  const mouseX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 400);
  const mouseY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 300);
  const springX = useSpring(mouseX, { stiffness: 100, damping: 20, mass: 0.9 });
  const springY = useSpring(mouseY, { stiffness: 100, damping: 20, mass: 0.9 });

  const [anim, setAnim]           = useState<CharacterAnimation>('idle');
  const [flipped, setFlipped]     = useState(false);
  const [visible, setVisible]     = useState(false);
  const [quip, setQuip]           = useState<string | null>(null);
  const prevMouseRef              = useRef({ x: 0, y: 0 });
  const movingTimer               = useRef<ReturnType<typeof setTimeout>>();
  const quipTimer                 = useRef<ReturnType<typeof setTimeout>>();
  const lastSection               = useRef('default');

  // Detect which section the mouse is over
  const detectSection = (y: number): string => {
    const sections: [string, string][] = [
      ['cta',      'section.py-32'],
      ['cast',     '#cast'],
      ['chat',     '.chat-demo-section'],
      ['features', '#features'],
      ['emotions', '#emotions'],
      ['story',    '.scroll-story'],
    ];
    for (const [key, selector] of sections) {
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (y >= rect.top && y <= rect.bottom) return key;
      }
    }
    // Hero = top ~100vh
    if (document.documentElement.scrollTop < window.innerHeight * 0.8) return 'hero';
    return 'default';
  };

  // Show quip bubble for current section
  const showQuip = (sec: string) => {
    if (sec === lastSection.current) return;
    lastSection.current = sec;
    setQuip(SECTION_QUIPS[sec]?.text ?? null);
    setAnim(SECTION_QUIPS[sec]?.anim ?? 'idle');
    clearTimeout(quipTimer.current);
    quipTimer.current = setTimeout(() => setQuip(null), 3200);
  };

  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setVisible(true);
      setQuip(SECTION_QUIPS.hero.text);
      setAnim(SECTION_QUIPS.hero.anim);
      quipTimer.current = setTimeout(() => setQuip(null), 3200);
    }, 900);

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - prevMouseRef.current.x;
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      if (Math.abs(dx) > 2) setFlipped(dx < 0);

      // Walk while moving, idle when still
      if (!quip) setAnim('walk');
      clearTimeout(movingTimer.current);
      movingTimer.current = setTimeout(() => {
        const sec = detectSection(e.clientY);
        showQuip(sec);
      }, 400);
    };

    // Also fire on scroll using last known mouse Y
    const onScroll = () => {
      clearTimeout(movingTimer.current);
      movingTimer.current = setTimeout(() => {
        const sec = detectSection(prevMouseRef.current.y || window.innerHeight / 2);
        showQuip(sec);
      }, 250);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      clearTimeout(movingTimer.current);
      clearTimeout(quipTimer.current);
      clearTimeout(revealTimer);
    };
  }, [mouseX, mouseY]);

  if (!show) return null;

  return (
    <motion.div
      className="fixed z-40 pointer-events-none select-none"
      style={{ x: springX, y: springY, translateX: '-50%', translateY: '-115%' }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.4 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Speech bubble */}
      <AnimatePresence>
        {quip && (
          <motion.div
            key={quip}
            initial={{ opacity: 0, scale: 0.7, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 4 }}
            transition={{ duration: 0.22 }}
            className={`absolute bottom-full mb-1 ${flipped ? 'right-1' : 'left-1'} whitespace-nowrap`}
          >
            <div className="relative bg-white border border-border shadow-lg rounded-2xl px-3 py-1.5 text-xs font-semibold text-foreground">
              {quip}
              {/* Tail */}
              <div className={`absolute -bottom-1.5 ${flipped ? 'right-4' : 'left-4'} w-3 h-3 bg-white border-r border-b border-border rotate-45`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <JarvisBot animation={anim} size={70} flipped={flipped} />
    </motion.div>
  );
};

// ─── Navbar ───────────────────────────────────────────────────────────────────
const Navbar: React.FC<{ isDocsPage: boolean }> = ({ isDocsPage }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  if (isDocsPage) return null;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/90 backdrop-blur-md border-b border-border shadow-sm'
        : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-lg text-foreground">
          <Bot className="w-6 h-6 text-primary" />
          JARVIS
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#emotions" className="hover:text-primary transition-colors">Try It</a>
          <a href="#cast" className="hover:text-primary transition-colors">Characters</a>
          <a href="/jarvis-website/docs" className="hover:text-primary transition-colors flex items-center gap-1.5">
            <Book className="w-3.5 h-3.5" /> Docs
          </a>
        </div>
        <Button size="sm" className="shadow-sm shadow-primary/20 hidden sm:flex">
          <Download className="w-4 h-4 mr-2" /> Download
        </Button>
      </div>
    </nav>
  );
};

// ─── Home page ────────────────────────────────────────────────────────────────
const HomePage = () => (
  <div className="min-h-screen w-full bg-background font-sans overflow-x-hidden">
    <HeroSection />
    <ScrollStory />
    <StatsSection />
    <EmotionPlayground />
    <FeaturesSection />
    <ChatDemoSection />
    <MeetTheCast />
    <CTASection />
    <Footer />
  </div>
);

// ─── Router ───────────────────────────────────────────────────────────────────
function AppRouter() {
  const [location] = useLocation();
  const isDocsPage = location === '/docs' || location === '/jarvis-website/docs';

  return (
    <>
      <MouseFollower show={!isDocsPage} />
      <Navbar isDocsPage={isDocsPage} />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/docs" component={DocsPage} />
        <Route path="/jarvis-website" component={HomePage} />
        <Route path="/jarvis-website/docs" component={DocsPage} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
