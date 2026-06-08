import React from 'react';
import { Switch, Route, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/Layout";
import { JarvisMain } from "@/pages/JarvisMain";
import { CharactersPage } from "@/pages/CharactersPage";
import { ConversationsPage } from "@/pages/ConversationsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { QuickInputPage } from "@/pages/QuickInputPage";

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
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
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

  if (isQuickInput) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <QuickInputPage />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter hook={useHashLocation}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
