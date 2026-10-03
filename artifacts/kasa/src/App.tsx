import { Component, type ReactNode, Suspense, lazy, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { initApi } from '@/lib/api';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import PublicRequestPage from '@/pages/public-request';

initApi();

const ClerkApp = lazy(() => import('@/private/ClerkApp'));

class Quiet extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

function PrivateFailed() {
  return (
    <div className="mx-auto max-w-md p-10 text-center" data-testid="error-auth-load">
      <h1 className="text-2xl font-bold">Oturum bileşeni yüklenemedi</h1>
      <p className="mt-2 text-sm text-muted-foreground">Bağlantınızı kontrol edip sayfayı yenileyin.</p>
      <a href={import.meta.env.BASE_URL} className="mt-4 inline-block font-semibold underline">Ana sayfaya dön</a>
    </div>
  );
}

function PrivateTree() {
  return (
    <Quiet fallback={<PrivateFailed />}>
      <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Yükleniyor…</div>}>
        <ClerkApp />
      </Suspense>
    </Quiet>
  );
}

function App() {
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15000, refetchOnWindowFocus: false } } }),
    [],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Switch>
          <Route path="/talep/:reference" component={PublicRequestPage} />
          <Route path="/">
            <Landing />
            {/* Clerk yüklenemezse tanıtım sayfası çalışmaya devam eder; yalnızca oturumlu yönlendirme kaybolur. */}
            <Quiet>
              <Suspense fallback={null}>
                <ClerkApp />
              </Suspense>
            </Quiet>
          </Route>
          <Route path="/sign-in/*?" component={PrivateTree} />
          <Route path="/sign-up/*?" component={PrivateTree} />
          <Route path="/panel" component={PrivateTree} />
          <Route path="/requests/*?" component={PrivateTree} />
          <Route path="/branches" component={PrivateTree} />
          <Route path="/users" component={PrivateTree} />
          <Route path="/reports" component={PrivateTree} />
          <Route path="/service-invoices" component={PrivateTree} />
          <Route component={NotFound} />
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
