import React from 'react';
import { Switch, Route, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/Layout";
import { JarvisMain } from "@/pages/JarvisMain";
import { CharactersPage } from "@/pages/CharactersPage";
import { ConversationsPage } from "@/pages/ConversationsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { QuickInputPage } from "@/pages/QuickInputPage";
import { SchedulerPage } from "@/pages/SchedulerPage";
import { BootSequence } from "@/components/BootSequence";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/quick-input" component={QuickInputPage} />
      <Route path="*">
        <Layout>
          <Switch>
            <Route path="/" component={JarvisMain} />
            <Route path="/characters" component={CharactersPage} />
            <Route path="/conversations" component={ConversationsPage} />
            <Route path="/scheduler" component={SchedulerPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

// The backend takes a moment to come up (it's spawned by the Electron main process after the
// renderer already starts loading), so every query fired before then fails outright — and since
// the global default is `retry: false`, nothing ever recovers them until something remounts the
// component. Gate the real UI behind a health check that retries indefinitely until the backend
// actually responds, instead of letting the first round of queries fail for good.
function useBackendReady() {
  const { data } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), retry: true, retryDelay: 500, refetchOnWindowFocus: false },
  });
  return !!data;
}

function StartupSplash() {
  return <BootSequence />;
}

function AppContent() {
  const backendReady = useBackendReady();

  const [isQuickInput, setIsQuickInput] = React.useState(
    window.location.hash === '#/quick-input' || window.location.hash === '#quick-input'
  );

  React.useEffect(() => {
    const handleHashChange = () => {
      setIsQuickInput(window.location.hash === '#/quick-input' || window.location.hash === '#quick-input');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!backendReady) {
    return <StartupSplash />;
  }

  if (isQuickInput) {
    return (
      <>
        <QuickInputPage />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <WouterRouter hook={useHashLocation}>
        <Router />
      </WouterRouter>
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
