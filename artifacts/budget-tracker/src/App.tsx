import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout';
import { Home } from '@/pages/home';
import { Login } from '@/pages/login';
import { Register } from '@/pages/register';
import { Dashboard } from '@/pages/dashboard';
import { Transactions } from '@/pages/transactions';
import { Categories } from '@/pages/categories';
import { Budgets } from '@/pages/budgets';
import { Settings } from '@/pages/settings';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/"><Login /></Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Authenticated Routes wrapped in Layout */}
      <Route path="/dashboard">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/transactions">
        <Layout><Transactions /></Layout>
      </Route>
      <Route path="/categories">
        <Layout><Categories /></Layout>
      </Route>
      <Route path="/budgets">
        <Layout><Budgets /></Layout>
      </Route>
      <Route path="/settings">
        <Layout><Settings /></Layout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;