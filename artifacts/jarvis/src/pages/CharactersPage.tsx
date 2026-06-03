import React, { useState } from 'react';
import { charactersMap, CharacterAnimation, CustomCharacter, CustomCharacterRenderer } from '@/components/characters/CharacterRenderer';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { CheckCircle2, Plus, Upload, Trash2, Edit2 } from 'lucide-react';
import { useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export const CharactersPage: React.FC = () => {
  const [selectedCharacterId, setSelectedCharacterId] = useLocalStorage('selectedCharacterId', 'jarvis-bot');
  const [customCharacters, setCustomCharacters] = useLocalStorage<CustomCharacter[]>('jarvisCustomCharacters', []);
  const [hoveredChar, setHoveredChar] = useState<string | null>(null);
  const [activeAnimation, setActiveAnimation] = useState<CharacterAnimation>('idle');
  const [activeTab, setActiveTab] = useState<'builtin' | 'custom'>('builtin');
  const [editingCustomChar, setEditingCustomChar] = useState<string | null>(null);

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
    { id: 'spider-man', name: 'Spider-Man', desc: 'Your friendly neighborhood web-slinger' },
    { id: 'iron-hero', name: 'Iron Hero', desc: 'Armored flying genius' },
    { id: 'electric-mouse', name: 'Electric Mouse', desc: 'Yellow shocking friend' },
    { id: 'dark-knight', name: 'Dark Knight', desc: 'Brooding vigilante' },
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
      <header className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Characters</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Choose your AI companion</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'builtin' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            onClick={() => setActiveTab('builtin')}
          >
            Built-in
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'custom' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom Studio
          </button>
        </div>
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

      {/* Built-in characters */}
      {activeTab === 'builtin' && (
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
      )}

      {/* Custom Studio */}
      {activeTab === 'custom' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Create New Card */}
            <div 
              className="rounded-xl border border-dashed border-slate-300 hover:border-primary/50 hover:bg-slate-50 transition-all duration-200 overflow-hidden flex flex-col items-center justify-center min-h-[300px] cursor-pointer"
              onClick={() => {
                const newChar: CustomCharacter = {
                  id: `custom-${Date.now()}`,
                  name: 'New Custom Character',
                  sprites: {}
                };
                setCustomCharacters([...customCharacters, newChar]);
                setEditingCustomChar(newChar.id);
              }}
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-500">
                <Plus size={24} />
              </div>
              <h3 className="font-medium text-foreground">Create New Character</h3>
              <p className="text-xs text-muted-foreground mt-2 text-center px-6">Upload your own GIFs or images to create a custom companion.</p>
            </div>

            {/* Custom Characters List */}
            {customCharacters.map((char) => {
              const isActive = selectedCharacterId === char.id;
              const isHovered = hoveredChar === char.id;
              const isEditing = editingCustomChar === char.id;

              if (isEditing) {
                return (
                  <div key={char.id} className="rounded-xl border border-primary ring-1 ring-primary/20 overflow-hidden flex flex-col bg-white col-span-1 md:col-span-2 lg:col-span-3">
                    <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                      <input 
                        type="text" 
                        value={char.name}
                        onChange={(e) => {
                          const updated = customCharacters.map(c => c.id === char.id ? { ...c, name: e.target.value } : c);
                          setCustomCharacters(updated);
                        }}
                        className="font-semibold text-lg bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none px-1 py-0.5 w-64"
                        placeholder="Character Name"
                      />
                      <div className="flex gap-2">
                        <button 
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          onClick={() => {
                            if (confirm('Delete this character?')) {
                              setCustomCharacters(customCharacters.filter(c => c.id !== char.id));
                              if (selectedCharacterId === char.id) handleSetActive('jarvis-bot');
                              setEditingCustomChar(null);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button 
                          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                          onClick={() => setEditingCustomChar(null)}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-white grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {animations.map(anim => (
                        <div key={anim} className="flex flex-col items-center">
                          <p className="text-xs font-medium text-slate-500 capitalize mb-2">{anim}</p>
                          <label className="w-full aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 overflow-hidden relative group">
                            {char.sprites[anim] ? (
                              <>
                                <img src={char.sprites[anim]} className="w-full h-full object-contain" alt={`${anim} sprite`} />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Upload className="text-white w-6 h-6" />
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center text-slate-400 gap-2">
                                <Upload size={20} />
                                <span className="text-xs">Upload</span>
                              </div>
                            )}
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/png, image/jpeg, image/gif, image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 1024 * 1024 * 5) {
                                  toast({ title: 'File too large', description: 'Max 5MB allowed.', variant: 'destructive' });
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const base64 = event.target?.result as string;
                                  const updated = customCharacters.map(c => {
                                    if (c.id === char.id) {
                                      return { ...c, sprites: { ...c.sprites, [anim]: base64 } };
                                    }
                                    return c;
                                  });
                                  setCustomCharacters(updated);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={char.id}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden flex flex-col bg-white ${
                    isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-slate-300'
                  }`}
                  onMouseEnter={() => setHoveredChar(char.id)}
                  onMouseLeave={() => setHoveredChar(null)}
                >
                  <div className="h-44 flex items-center justify-center bg-slate-50 relative">
                    {isActive && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 text-primary text-xs font-medium z-10">
                        <CheckCircle2 size={14} /> Active
                      </div>
                    )}
                    <button 
                      className="absolute top-3 left-3 p-1.5 bg-white shadow-sm border rounded-md text-slate-500 hover:text-slate-900 z-10"
                      onClick={() => setEditingCustomChar(char.id)}
                    >
                      <Edit2 size={14} />
                    </button>
                    <CustomCharacterRenderer
                      character={char}
                      animation={isHovered ? activeAnimation : (isActive ? 'idle' : 'sleep')}
                      size={110}
                      flipped={false}
                    />
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{char.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Custom Character</p>
                    </div>
                    <button
                      onClick={() => handleSetActive(char.id)}
                      disabled={isActive}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary cursor-default'
                          : 'bg-slate-100 hover:bg-primary hover:text-white text-foreground'
                      }`}
                    >
                      {isActive ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
