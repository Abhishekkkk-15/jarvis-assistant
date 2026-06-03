import React, { useState } from 'react';
import { charactersMap, CharacterAnimation } from '@/components/characters/CharacterRenderer';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { CheckCircle2 } from 'lucide-react';
import { useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export const CharactersPage: React.FC = () => {
  const [selectedCharacterId, setSelectedCharacterId] = useLocalStorage('selectedCharacterId', 'jarvis-bot');
  const [hoveredChar, setHoveredChar] = useState<string | null>(null);
  const [activeAnimation, setActiveAnimation] = useState<CharacterAnimation>('idle');

  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const characterList = [
    { id: 'jarvis-bot', name: 'JARVIS Bot', desc: 'Classic intelligent companion' },
    { id: 'pixel-fox', name: 'Pixel Fox', desc: 'Quick and curious' },
    { id: 'space-cat', name: 'Astro Feline', desc: 'Zero-gravity explorer' },
    { id: 'fire-drake', name: 'Ignis Drake', desc: 'Fiery and spirited' },
    { id: 'ninja', name: 'Shinobi', desc: 'Swift and silent human' },
    { id: 'wizard', name: 'Archmage', desc: 'Magical human companion' },
    { id: 'cyber-punk', name: 'Cyber Dweller', desc: 'Neon future human' },
    { id: 'minion-bob', name: 'Minion Blob', desc: 'Yellow and silly cartoon' },
    { id: 'space-bean', name: 'Space Bean', desc: 'Kinda sus cartoon' },
    { id: 'alien-dude', name: 'Alien Dude', desc: 'Out of this world funny alien' },
  ];

  const animations: CharacterAnimation[] = ['idle', 'walk', 'run', 'wave', 'dance', 'sleep', 'excited', 'talk'];

  const handleSetActive = (id: string) => {
    setSelectedCharacterId(id);
    updateSettings.mutate({ data: { selectedCharacterId: id } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Companion updated", description: `Now using ${characterList.find(c => c.id === id)?.name}` });
      }
    });
  };

  return (
    <div className="h-full flex flex-col p-5 md:p-8 max-w-6xl mx-auto w-full">
      <header className="mb-6 shrink-0">
        <h2 className="text-xl font-semibold text-foreground">Characters</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Choose your AI companion</p>
      </header>

      {/* Animation filter */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 shrink-0">
        {animations.map(anim => (
          <button
            key={anim}
            onClick={() => setActiveAnimation(anim)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors whitespace-nowrap ${
              activeAnimation === anim
                ? 'bg-primary text-white'
                : 'bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-slate-50'
            }`}
            data-testid={`button-anim-${anim}`}
          >
            {anim}
          </button>
        ))}
      </div>

      {/* Character cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {characterList.map((char) => {
          const Character = charactersMap[char.id];
          const isActive = selectedCharacterId === char.id;
          const isHovered = hoveredChar === char.id;

          return (
            <div
              key={char.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden flex flex-col bg-white ${
                isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-slate-300'
              }`}
              onMouseEnter={() => setHoveredChar(char.id)}
              onMouseLeave={() => setHoveredChar(null)}
              data-testid={`card-character-${char.id}`}
            >
              {/* Character preview */}
              <div className="h-44 flex items-center justify-center bg-slate-50 relative">
                {isActive && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-primary text-xs font-medium">
                    <CheckCircle2 size={14} /> Active
                  </div>
                )}
                <Character
                  animation={isHovered ? activeAnimation : (isActive ? 'idle' : 'sleep')}
                  size={110}
                  flipped={false}
                />
              </div>

              {/* Info + action */}
              <div className="p-4 flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{char.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{char.desc}</p>
                </div>
                <button
                  onClick={() => handleSetActive(char.id)}
                  disabled={isActive}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary cursor-default'
                      : 'bg-slate-100 hover:bg-primary hover:text-white text-foreground'
                  }`}
                  data-testid={`button-set-active-${char.id}`}
                >
                  {isActive ? 'Selected' : 'Select'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
