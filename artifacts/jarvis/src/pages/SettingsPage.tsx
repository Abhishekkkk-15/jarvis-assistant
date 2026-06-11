import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Key, Cpu, Mic, MessageSquareCode, Save, Volume2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useTTS } from '@/hooks/useTTS';

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tts = useTTS((settings as any)?.groqApiKey ?? null);

  const [miniModeEnabled, setMiniModeEnabled] = useLocalStorage('miniModeEnabled', true);
  const [autonomousMode, setAutonomousMode] = useLocalStorage('jarvisAutonomousMode', false);
  const [persona, setPersona] = useLocalStorage('jarvisPersona', 'Friendly');

  const form = useForm({
    defaultValues: {
      nvidiaApiKey: '',
      groqApiKey: '',
      wakeWord: 'jarvis',
      voiceEnabled: true,

    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        nvidiaApiKey: '',
        groqApiKey: '',
        notionApiKey: '',
        spotifyClientId: '',
        spotifyClientSecret: '',
        githubPat: '',
        wakeWord: settings.wakeWord || 'jarvis',
        voiceEnabled: settings.voiceEnabled ?? true,

      });
    }
  }, [settings, form]);

  const onSubmit = (values: any) => {
    const payload = { ...values };
    if (!payload.nvidiaApiKey) delete payload.nvidiaApiKey;
    if (!payload.groqApiKey) delete payload.groqApiKey;
    if (!payload.notionApiKey) delete payload.notionApiKey;
    if (!payload.spotifyClientId) delete payload.spotifyClientId;
    if (!payload.spotifyClientSecret) delete payload.spotifyClientSecret;
    if (!payload.githubPat) delete payload.githubPat;
    updateSettings.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved" });
        form.reset({ ...values, nvidiaApiKey: '', groqApiKey: '' });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading settings…</div>;
  }

  const sectionClass = "rounded-xl border border-border bg-white p-6 space-y-5";
  const sectionHeadingClass = "text-sm font-semibold text-foreground flex items-center gap-2 pb-4 border-b border-border";

  return (
    <div className="h-full flex flex-col p-5 md:p-8 max-w-4xl mx-auto w-full overflow-y-auto">
      <header className="mb-6 shrink-0">
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your JARVIS assistant</p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-24">

          {/* API Keys */}
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>
              <Key size={15} className="text-primary" /> API Keys
            </h3>
            <div className="grid grid-cols-1 gap-5">
              <FormField
                control={form.control}
                name="nvidiaApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">NVIDIA API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={settings?.nvidiaApiKeySet ? "Already set — enter new key to update" : "Enter your NVIDIA API key"}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Used for LLaMA 3.1 & Nemotron models</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="groqApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Groq API Key</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={settings?.groqApiKeySet ? "Already set — enter new key to update" : "Enter your Groq API key"}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Used for ultra-fast inference (LPU)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="githubPat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">GitHub Personal Access Token</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={settings?.githubPatSet ? "Already set — enter new key to update" : "Enter your GitHub PAT"}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Required for reading repos, issues, and opening PRs</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Voice & Behavior */}
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>
              <Mic size={15} className="text-primary" /> Voice & Behavior
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="wakeWord"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Wake Word</FormLabel>
                      <FormControl>
                        <Input placeholder="jarvis" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voiceEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <FormLabel className="text-sm font-medium cursor-pointer">Voice Responses</FormLabel>
                        <FormDescription className="text-xs mt-0.5">JARVIS speaks its replies aloud</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Mini Mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Floating character overlay</p>
                  </div>
                  <Switch checked={miniModeEnabled} onCheckedChange={setMiniModeEnabled} />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Contextual Awareness Mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Character actively watches your active windows and reacts to your tasks</p>
                  </div>
                  <Switch checked={autonomousMode} onCheckedChange={setAutonomousMode} />
                </div>

                {autonomousMode && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Character Persona</label>
                    <Select value={persona} onValueChange={setPersona}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a persona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Friendly">Friendly & Helpful</SelectItem>
                        <SelectItem value="Funny">Funny & Playful</SelectItem>
                        <SelectItem value="Sarcastic">Sarcastic & Witty</SelectItem>
                        <SelectItem value="Professional">Professional Assistant</SelectItem>
                        <SelectItem value="Chaotic">Chaotic & Random</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">How the character reacts to what you are doing.</p>
                  </div>
                )}
              </div>


            </div>
          </section>

          {/* Official Integrations */}
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>
              <Cpu size={15} className="text-primary" /> Official Integrations
            </h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="telegramBotToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Telegram Bot Token</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter Telegram Bot Token from BotFather" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormDescription className="text-xs">JARVIS will connect to this bot to receive notifications and messages.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discordBotToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Discord Bot Token</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter Discord Bot Token" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormDescription className="text-xs">Connect JARVIS to your Discord servers to receive notifications.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notionApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Notion API Key</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter Notion API Key" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormDescription className="text-xs">Used by JARVIS to search and read your Notion workspace.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="spotifyClientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Spotify Client ID</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Enter Spotify Client ID" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="spotifyClientSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Spotify Client Secret</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter Spotify Client Secret" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormDescription className="text-xs">Used by JARVIS to search and control your Spotify playback.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* TTS Voice Settings */}
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>
              <Volume2 size={15} className="text-primary" /> Voice Output (TTS)
            </h3>
            <div className="space-y-5">

              {/* Enable/Disable */}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable TTS</p>
                  <p className="text-xs text-muted-foreground mt-0.5">JARVIS speaks responses aloud</p>
                </div>
                <Switch checked={tts.isEnabled} onCheckedChange={tts.toggleEnabled} />
              </div>

              {tts.isEnabled && (
                <>
                  {/* TTS Engine Selector */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">TTS Engine</label>
                    <Select value={tts.engine} onValueChange={(v: any) => tts.updateEngine(v)}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="browser">🌐 Browser (Web Speech API, free)</SelectItem>
                        <SelectItem value="orpheus">🎙️ Orpheus via Groq (canopylabs/orpheus-v1-english)</SelectItem>
                        <SelectItem value="custom">📂 Custom WAV file</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {tts.engine === "orpheus" && "Uses your Groq API key. Requires a Groq key to be set above."}
                      {tts.engine === "browser" && "Uses the system's built-in voices. Free, no API key needed."}
                      {tts.engine === "custom" && "Plays a local .wav file whenever JARVIS responds. Useful for a custom SFX."}
                    </p>
                  </div>

                  {/* ── Browser engine controls */}
                  {tts.engine === "browser" && (
                    <>
                      {tts.voices.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-foreground">Voice</label>
                          <Select
                            value={tts.selectedVoice?.name || ""}
                            onValueChange={(name) => {
                              const v = tts.voices.find(v => v.name === name);
                              if (v) tts.updateVoice(v);
                            }}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Select a voice" />
                            </SelectTrigger>
                            <SelectContent>
                              {tts.voices
                                .filter(v => v.lang.startsWith("en"))
                                .map(v => (
                                  <SelectItem key={v.name} value={v.name}>
                                    {v.name} ({v.lang})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Windows Microsoft voices sound best.</p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium text-foreground">Speed</label>
                          <span className="text-xs text-muted-foreground">{tts.rate.toFixed(1)}x</span>
                        </div>
                        <input type="range" min="0.5" max="2" step="0.1" value={tts.rate}
                          onChange={(e) => tts.updateRate(parseFloat(e.target.value))}
                          className="w-full accent-primary" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Slow (0.5x)</span><span>Normal (1.0x)</span><span>Fast (2.0x)</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium text-foreground">Pitch</label>
                          <span className="text-xs text-muted-foreground">{tts.pitch.toFixed(1)}</span>
                        </div>
                        <input type="range" min="0.5" max="2" step="0.1" value={tts.pitch}
                          onChange={(e) => tts.updatePitch(parseFloat(e.target.value))}
                          className="w-full accent-primary" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Low</span><span>Normal</span><span>High</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Orpheus engine controls */}
                  {tts.engine === "orpheus" && (
                    <>
                      {!settings?.groqApiKeySet && (
                        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
                          ⚠️ Groq API key not set. Add it in the <strong>API Keys</strong> section above and save settings first.
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Orpheus Voice</label>
                        <Select value={tts.orpheusVoice} onValueChange={(v: any) => tts.updateOrpheusVoice(v)}>
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["tara","leah","jess","leo","dan","mia","zac","zoe"] as const).map(id => (
                              <SelectItem key={id} value={id}>
                                {id.charAt(0).toUpperCase() + id.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Powered by <code className="bg-muted px-1 rounded">canopylabs/orpheus-v1-english</code> via Groq.
                        </p>
                      </div>
                    </>
                  )}

                  {/* ── Custom WAV controls */}
                  {tts.engine === "custom" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">WAV File Path</label>
                      <input
                        type="text"
                        placeholder="C:\sounds\jarvis_response.wav or /path/to/file.wav"
                        value={tts.customWavPath}
                        onChange={(e) => tts.updateCustomWavPath(e.target.value)}
                        className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the absolute path to a <code className="bg-muted px-1 rounded">.wav</code> file. JARVIS will play it when responding. Useful for a notification sound.
                      </p>
                    </div>
                  )}

                  {/* Test button */}
                  <button
                    type="button"
                    onClick={() => tts.speak("Hello! I am JARVIS, your AI assistant. How may I help you today?")}
                    disabled={tts.isSpeaking}
                    className="w-full py-2 rounded-lg border border-primary/40 text-primary text-sm hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    {tts.isSpeaking ? "🔊 Speaking…" : "🔊 Test Voice"}
                  </button>
                </>
              )}
            </div>
          </section>

          <div className="flex justify-end sticky bottom-4">
            <button
              type="submit"
              disabled={updateSettings.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
              data-testid="button-save-settings"
            >
              <Save size={15} /> Save Settings
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
};
