import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Key, Cpu, Mic, MessageSquareCode, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocalStorage } from '@/hooks/use-local-storage';

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [miniModeEnabled, setMiniModeEnabled] = useLocalStorage('miniModeEnabled', true);

  const form = useForm({
    defaultValues: {
      groqApiKey: '',
      nvidiaApiKey: '',
      selectedProvider: 'groq',
      selectedModel: 'llama-3.3-70b-versatile',
      wakeWord: 'jarvis',
      voiceEnabled: true,

    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        groqApiKey: '',
        nvidiaApiKey: '',
        selectedProvider: settings.selectedProvider || 'groq',
        selectedModel: settings.selectedModel || 'llama-3.3-70b-versatile',
        wakeWord: settings.wakeWord || 'jarvis',
        voiceEnabled: settings.voiceEnabled ?? true,

      });
    }
  }, [settings, form]);

  const onSubmit = (values: any) => {
    const payload = { ...values };
    if (!payload.groqApiKey) delete payload.groqApiKey;
    if (!payload.nvidiaApiKey) delete payload.nvidiaApiKey;
    updateSettings.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved" });
        form.reset({ ...values, groqApiKey: '', nvidiaApiKey: '' });
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    <FormDescription className="text-xs">Used for LLaMA 3 models</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    <FormDescription className="text-xs">Used for Nemotron models</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Model */}
          <section className={sectionClass}>
            <h3 className={sectionHeadingClass}>
              <Cpu size={15} className="text-primary" /> Model
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="selectedProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Provider</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="groq">Groq</SelectItem>
                        <SelectItem value="nvidia">NVIDIA</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="selectedModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {form.watch('selectedProvider') === 'groq' ? (
                          <>
                            <SelectItem value="llama-3.3-70b-versatile">LLaMA 3.3 70B (Recommended)</SelectItem>
                            <SelectItem value="llama-3.1-8b-instant">LLaMA 3.1 8B</SelectItem>
                            <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="meta/llama-3.1-405b-instruct">LLaMA 3.1 405B</SelectItem>
                            <SelectItem value="meta/llama-3.1-70b-instruct">LLaMA 3.1 70B</SelectItem>
                            <SelectItem value="nvidia/nemotron-4-340b-instruct">Nemotron 4 340B</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
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
              </div>


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
