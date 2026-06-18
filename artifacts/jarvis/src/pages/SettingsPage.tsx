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
import { useTTS, ORPHEUS_VOICES } from '@/hooks/useTTS';

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tts = useTTS();

  const [miniModeEnabled, setMiniModeEnabled] = useLocalStorage('miniModeEnabled', true);
  const [autonomousMode, setAutonomousMode] = useLocalStorage('jarvisAutonomousMode', false);
  const [persona, setPersona] = useLocalStorage('jarvisPersona', 'Friendly');
  const [muteCharacterNotifications, setMuteCharacterNotifications] = useLocalStorage('muteCharacterNotifications', false);
  const [startupLaunchEnabled, setStartupLaunchEnabled] = React.useState(false);

  useEffect(() => {
    if (window.electronAPI?.getStartupLaunch) {
      window.electronAPI.getStartupLaunch().then((enabled: boolean) => {
        setStartupLaunchEnabled(enabled);
      });
    }
  }, []);

  const handleToggleStartupLaunch = (val: boolean) => {
    setStartupLaunchEnabled(val);
    if (window.electronAPI?.setStartupLaunch) {
      window.electronAPI.setStartupLaunch(val);
    }
  };

  const form = useForm({
    defaultValues: {
      nvidiaApiKey: '',
      groqApiKey: '',
      openaiApiKey: '',
      anthropicApiKey: '',
      mistralApiKey: '',
      openrouterApiKey: '',
      geminiApiKey: '',
      customTextApiUrl: '',
      customTextApiKey: '',
      customVisionApiUrl: '',
      customVisionApiKey: '',
      wakeWord: 'jarvis',
      voiceEnabled: true,
      selectedProvider: 'groq',
      selectedModel: 'llama-3.3-70b-versatile',
      visionProvider: 'groq',
      visionModel: 'llama-3.2-90b-vision-preview',
      telegramBotToken: '',
      discordBotToken: '',
      notionApiKey: '',
      spotifyClientId: '',
      spotifyClientSecret: '',
      githubPat: '',
      googleClientId: '',
      googleClientSecret: '',
      emailAddress: '',
      emailPassword: '',
      emailProvider: 'gmail',
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        nvidiaApiKey: (settings as any).nvidiaApiKey || '',
        groqApiKey: (settings as any).groqApiKey || '',
        openaiApiKey: (settings as any).openaiApiKey || '',
        anthropicApiKey: (settings as any).anthropicApiKey || '',
        mistralApiKey: (settings as any).mistralApiKey || '',
        openrouterApiKey: (settings as any).openrouterApiKey || '',
        geminiApiKey: (settings as any).geminiApiKey || '',
        customTextApiUrl: settings.customTextApiUrl || '',
        customTextApiKey: (settings as any).customTextApiKey || '',
        customVisionApiUrl: settings.customVisionApiUrl || '',
        customVisionApiKey: (settings as any).customVisionApiKey || '',
        telegramBotToken: settings.telegramBotToken || '',
        discordBotToken: settings.discordBotToken || '',
        notionApiKey: settings.notionApiKey || '',
        spotifyClientId: settings.spotifyClientId || '',
        spotifyClientSecret: settings.spotifyClientSecret || '',
        githubPat: (settings as any).githubPat || '',
        googleClientId: (settings as any).googleClientId || '',
        googleClientSecret: (settings as any).googleClientSecret || '',
        wakeWord: settings.wakeWord || 'jarvis',
        emailAddress: settings.emailAddress || '',
        emailPassword: (settings as any).emailPassword || '',
        emailProvider: settings.emailProvider || 'gmail',
        selectedProvider: settings.selectedProvider || 'groq',
        selectedModel: settings.selectedModel || 'llama-3.3-70b-versatile',
        visionProvider: settings.visionProvider || 'groq',
        visionModel: settings.visionModel || 'llama-3.2-90b-vision-preview',
      });
    }
  }, [settings, form]);

  const onSubmit = (values: any) => {
    const payload = { ...values };
    const keysToDelete = [
      'nvidiaApiKey', 'groqApiKey', 'openaiApiKey', 'anthropicApiKey',
      'mistralApiKey', 'openrouterApiKey', 'geminiApiKey',
      'customTextApiKey', 'customVisionApiKey', 'notionApiKey',
      'spotifyClientId', 'spotifyClientSecret', 'githubPat',
      'emailPassword', 'telegramBotToken', 'discordBotToken',
      'googleClientId', 'googleClientSecret'
    ];
    keysToDelete.forEach(k => {
      if (!payload[k]) payload[k] = null; // update to null if cleared
    });
    updateSettings.mutate({ data: payload }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved" });
        form.reset(values);
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


  const renderProviderApiKeyField = (provider: string) => {
    if (!provider || provider === 'custom') return null;

    const keyMap: Record<string, { label: string; name: string; placeholderSet: string; placeholderUnset: string; desc: string }> = {
      groq: {
        label: "Groq API Key",
        name: "groqApiKey",
        placeholderSet: "Already set — enter new key to update",
        placeholderUnset: "Enter your Groq API key",
        desc: "Used for ultra-fast LPU inference"
      },
      nvidia: {
        label: "NVIDIA API Key",
        name: "nvidiaApiKey",
        placeholderSet: "Already set — enter new key to update",
        placeholderUnset: "Enter your NVIDIA API key",
        desc: "Used for LLaMA 3.1 & Nemotron models"
      },
      openai: {
        label: "OpenAI API Key",
        name: "openaiApiKey",
        placeholderSet: "Already set — enter new key to update",
        placeholderUnset: "Enter your OpenAI API key",
        desc: "Used for GPT-4o and text embeddings"
      },
      anthropic: {
        label: "Anthropic API Key",
        name: "anthropicApiKey",
        placeholderSet: "Already set — enter new key to update",
        placeholderUnset: "Enter your Anthropic API key",
        desc: "Used for Claude 3.5 Sonnet & Claude 3 Opus"
      },
      gemini: {
        label: "Gemini API Key",
        name: "geminiApiKey",
        placeholderSet: "Already set — enter new key to update",
        placeholderUnset: "Enter your Gemini API key",
        desc: "Used for Gemini 1.5 & Gemini 2.0 models"
      },
      mistral: {
        label: "Mistral API Key",
        name: "mistralApiKey",
        placeholderSet: "Already set — enter new key to update",
        placeholderUnset: "Enter your Mistral API key",
        desc: "Used for Mistral Large & Pixtral models"
      },
      openrouter: {
        label: "OpenRouter API Key",
        name: "openrouterApiKey",
        placeholderSet: "Already set — enter new key to update",
        placeholderUnset: "Enter your OpenRouter API key",
        desc: "Access unified open-source and proprietary models"
      }
    };

    const config = keyMap[provider];
    if (!config) return null;

    const isSet = settings ? (settings as any)[`${config.name}Set`] : false;

    return (
      <FormField
        control={form.control}
        name={config.name as any}
        render={({ field }) => (
          <FormItem className="animate-in fade-in slide-in-from-top-1 duration-200">
            <FormLabel className="text-sm">{config.label}</FormLabel>
            <FormControl>
              <Input
                type="password"
                placeholder={isSet ? config.placeholderSet : config.placeholderUnset}
                {...field}
              />
            </FormControl>
            <FormDescription className="text-xs">{config.desc}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <div className="h-full flex flex-col p-5 md:p-8 max-w-4xl mx-auto w-full overflow-y-auto">
      <header className="mb-6 shrink-0">
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your JARVIS assistant</p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-24">
          {/* Model Selection */}
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>
              <Cpu size={15} className="text-primary" /> Model Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Text / Agent Model */}
              <div className="space-y-5">
                <h4 className="text-sm font-semibold text-foreground">Agent Model (Text)</h4>
                <FormField
                  control={form.control}
                  name="selectedProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Agent Provider</FormLabel>
                      <Select key={field.value} value={field.value} defaultValue={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="groq">Groq</SelectItem>
                          <SelectItem value="nvidia">NVIDIA NIM</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="gemini">Google Gemini</SelectItem>
                          <SelectItem value="mistral">Mistral AI</SelectItem>
                          <SelectItem value="openrouter">OpenRouter</SelectItem>
                          <SelectItem value="custom">Custom Endpoint</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {renderProviderApiKeyField(form.watch('selectedProvider'))}

                {form.watch('selectedProvider') === 'custom' && (
                  <>
                    <FormField
                      control={form.control}
                      name="customTextApiUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Custom API Base URL</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. http://localhost:11434/v1" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">The custom OpenAI-compatible API base URL</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customTextApiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Custom API Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={settings?.customTextApiKeySet ? "Already set — enter new key to update" : "Enter Custom API Key"}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">Optional custom API key</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="selectedModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Agent Model Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. llama-3.3-70b-versatile" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription className="text-xs">The model JARVIS uses to think and orchestrate tools.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Vision Model */}
              <div className="space-y-5">
                <h4 className="text-sm font-semibold text-foreground">Vision Model</h4>
                <FormField
                  control={form.control}
                  name="visionProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Vision Provider</FormLabel>
                      <Select key={field.value} value={field.value} defaultValue={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="groq">Groq</SelectItem>
                          <SelectItem value="nvidia">NVIDIA NIM</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="gemini">Google Gemini</SelectItem>
                          <SelectItem value="mistral">Mistral AI</SelectItem>
                          <SelectItem value="openrouter">OpenRouter</SelectItem>
                          <SelectItem value="custom">Custom Endpoint</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {renderProviderApiKeyField(form.watch('visionProvider'))}

                {form.watch('visionProvider') === 'custom' && (
                  <>
                    <FormField
                      control={form.control}
                      name="customVisionApiUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Custom Vision API Base URL</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. http://localhost:11434/v1" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">The custom OpenAI-compatible Vision API base URL</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customVisionApiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Custom Vision API Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={settings?.customVisionApiKeySet ? "Already set — enter new key to update" : "Enter Custom Vision API Key"}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">Optional custom Vision API key</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="visionModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Vision Model Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. microsoft/phi-4-multimodal-instruct" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription className="text-xs">The model used to extract descriptions from uploaded images.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Mute Character Notifications</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Do not display or read aloud incoming notifications (like Telegram/Discord messages) on the character</p>
                  </div>
                  <Switch checked={muteCharacterNotifications} onCheckedChange={setMuteCharacterNotifications} />
                </div>

                {window.electronAPI && (
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Launch on Startup</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Automatically open JARVIS when your computer starts up</p>
                    </div>
                    <Switch checked={startupLaunchEnabled} onCheckedChange={handleToggleStartupLaunch} />
                  </div>
                )}

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

          {/* Google Calendar */}
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>
              <Cpu size={15} className="text-primary" /> Google Calendar
            </h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="googleClientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Google Client ID</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={settings?.googleClientIdSet ? "Already set — enter new ID to update" : "Enter your Google OAuth2 Client ID"}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">From Google Cloud Console → APIs & Services → Credentials</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="googleClientSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Google Client Secret</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={settings?.googleClientSecretSet ? "Already set — enter new secret to update" : "Enter your Google OAuth2 Client Secret"}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Connection Status</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {settings?.googleRefreshTokenSet
                      ? "✅ Connected — JARVIS can read and write your calendar"
                      : "Not connected — save your Client ID & Secret first, then click Connect"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const resp = await fetch('http://localhost:4444/api/auth/google/url');
                      if (!resp.ok) {
                        const err = await resp.json();
                        alert(err.error || 'Failed to get authorization URL');
                        return;
                      }
                      const { url } = await resp.json();
                      window.open(url, '_blank');
                    } catch (e: any) {
                      alert('Could not connect to server: ' + e.message);
                    }
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  Connect Google Calendar
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Add <code className="bg-muted px-1 rounded">http://localhost:4444/api/auth/google/callback</code> as an authorized redirect URI in your Google Cloud Console OAuth2 app.
              </p>
            </div>
          </section>

          {/* Email Configuration */}
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>
              <MessageSquareCode size={15} className="text-primary" /> Email Configuration
            </h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="emailProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Email Provider</FormLabel>
                    <Select key={field.value} value={field.value} defaultValue={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select email provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gmail">Gmail</SelectItem>
                        <SelectItem value="outlook">Outlook / Hotmail</SelectItem>
                        <SelectItem value="yahoo">Yahoo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">App Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter 16-character App Password" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Do not use your main password. Create an "App Password" in your email provider's security settings.
                    </FormDescription>
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
                            {ORPHEUS_VOICES.map(voice => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.label}
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
