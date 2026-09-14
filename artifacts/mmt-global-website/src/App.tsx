import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Limit, { LimitChooser } from '@/pages/limit';
import StaffApplications from '@/pages/staff-applications';
import DemoWallet from '@/pages/demo-wallet';
import PaymentPage, { MockPaymentPage, PaymentResultPage } from '@/pages/payment';
import {
  Route,
  Redirect,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#ea580c',
    colorForeground: '#f8f6f3',
    colorMutedForeground: '#a3a3a3',
    colorDanger: '#ef4444',
    colorBackground: '#121822',
    colorInput: '#1d2633',
    colorInputForeground: '#f8f6f3',
    colorNeutral: '#334155',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: '0rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#121822] rounded-none w-[440px] max-w-full overflow-hidden border border-[#334155]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#f8f6f3]',
    headerSubtitle: 'text-[#a3a3a3]',
    socialButtonsBlockButtonText: 'text-[#f8f6f3]',
    formFieldLabel: 'text-[#f8f6f3]',
    footerActionLink: 'text-[#ea580c]',
    footerActionText: 'text-[#a3a3a3]',
    dividerText: 'text-[#a3a3a3]',
    formFieldSuccessText: 'text-[#ea580c]',
    alertText: 'text-[#f8f6f3]',
    logoBox: 'mb-4',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#334155] bg-[#1d2633] hover:bg-[#263344]',
    formButtonPrimary: 'bg-[#ea580c] hover:bg-[#c2410c] text-white',
    formFieldInput: 'border-[#334155] bg-[#1d2633] text-[#f8f6f3]',
    footerAction: 'text-[#a3a3a3]',
    dividerLine: 'bg-[#334155]',
    alert: 'border-[#7f1d1d] bg-[#450a0a]',
    otpCodeFieldInput: 'border-[#334155] bg-[#1d2633] text-[#f8f6f3]',
    formFieldRow: 'text-[#f8f6f3]',
    main: 'text-[#f8f6f3]',
  },
};

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/limit" component={LimitChooser} />
        <Route path="/limit/bireysel" component={IndividualLimit} />
        <Route path="/limit/ticari" component={CommercialLimit} />
        <Route path="/limit/konut" component={HousingLimit} />
        <Route path="/limit/tasit" component={VehicleLimit} />
        <Route path="/cuzdan-demo" component={DemoWallet} />
        <Route path="/odeme" component={PaymentPage} />
        <Route path="/odeme/test" component={MockPaymentPage} />
        <Route path="/odeme/sonuc" component={PaymentResultPage} />
        <Route path="/staff/applications" component={StaffApplications} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function IndividualLimit() {
  return <Limit category="individual" />;
}

function CommercialLimit() {
  return <Limit category="commercial" />;
}

function HousingLimit() {
  return <Limit category="housing" />;
}

function VehicleLimit() {
  return <Limit category="vehicle" />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkApp />
    </WouterRouter>
  );
}

function ClerkApp() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
