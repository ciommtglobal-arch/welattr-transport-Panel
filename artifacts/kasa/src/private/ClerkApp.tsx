import { useEffect, useRef } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { trTR } from '@clerk/localizations';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Logo } from '@/components/kit';
import NotFound from '@/pages/not-found';
import { Gate } from './Gate';
import PanelPage from '@/pages/panel';
import RequestsPage from '@/pages/requests';
import NewRequestPage from '@/pages/request-new';
import RequestDetailPage from '@/pages/request-detail';
import BranchesPage from '@/pages/branches';
import UsersPage from '@/pages/users';
import ReportsPage from '@/pages/reports';

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const appearance = {
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: `${basePath}/`,
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#0f3d44',
    colorForeground: '#12282c',
    colorMutedForeground: '#4f6165',
    colorDanger: '#a3301f',
    colorBackground: '#fbf7ec',
    colorInput: '#fffdf6',
    colorInputForeground: '#12282c',
    colorNeutral: '#12282c',
    fontFamily: "'Hanken Grotesk', sans-serif",
    borderRadius: '0.375rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf7ec] border border-[#d8cfb8] rounded-xl w-[420px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#12282c] font-bold',
    headerSubtitle: 'text-[#4f6165]',
    socialButtonsBlockButtonText: 'text-[#12282c] font-semibold',
    formFieldLabel: 'text-[#12282c] font-semibold',
    footerActionLink: 'text-[#0f3d44] font-bold underline',
    footerActionText: 'text-[#4f6165]',
    dividerText: 'text-[#4f6165]',
    identityPreviewEditButton: 'text-[#0f3d44]',
    formFieldSuccessText: 'text-[#1e6b4e]',
    alertText: 'text-[#a3301f]',
    formButtonPrimary: 'bg-[#0f3d44] hover:bg-[#165560] text-[#fbf7ec] font-semibold',
    formFieldInput: 'border-[#b9ae92]',
    socialButtonsBlockButton: 'border-[#b9ae92] bg-[#fffdf6]',
    dividerLine: 'bg-[#d8cfb8]',
    otpCodeFieldInput: 'border-[#b9ae92]',
  },
};

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] md:grid-cols-[1fr_1.1fr]">
      <div className="ruled relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground md:flex">
        <Logo light />
        <div className="rise">
          <p className="font-display text-4xl font-bold leading-tight">
            İstenen tutar ile<br />
            <span className="text-sidebar-primary">tahsil edilen</span> tutar<br />ayrı satırlardır.
          </p>
          <p className="mt-4 max-w-sm text-sm text-sidebar-foreground/70">
            MMT Kasa, bekleyen ödeme taleplerini gelir saymaz. Oturum açarak şubenizin defterine geçin.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Canlı ödeme kapalıdır. Mali Z raporu değildir.</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="md:hidden"><Logo /></div>
        {children}
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <AuthFrame>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthFrame>
  );
}
function SignUpPage() {
  return (
    <AuthFrame>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthFrame>
  );
}

function CacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prev.current !== undefined && prev.current !== id) qc.clear();
      prev.current = id;
    });
  }, [addListener, qc]);
  return null;
}

function HomeRedirect() {
  return <Show when="signed-in"><Redirect to="/panel" /></Show>;
}

export default function ClerkApp() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={appearance}
      localization={trTR}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInForceRedirectUrl={`${basePath}/panel`}
      signUpForceRedirectUrl={`${basePath}/panel`}
      afterSignOutUrl={`${basePath}/`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <CacheInvalidator />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/panel"><Gate><PanelPage /></Gate></Route>
        <Route path="/requests"><Gate><RequestsPage /></Gate></Route>
        <Route path="/requests/new"><Gate><NewRequestPage /></Gate></Route>
        <Route path="/requests/:id"><Gate><RequestDetailPage /></Gate></Route>
        <Route path="/branches"><Gate admin><BranchesPage /></Gate></Route>
        <Route path="/users"><Gate admin><UsersPage /></Gate></Route>
        <Route path="/reports"><Gate admin><ReportsPage /></Gate></Route>
        <Route component={NotFound} />
      </Switch>
    </ClerkProvider>
  );
}
