import { type ComponentProps, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp } from '@clerk/react';
import { arSA, enUS, ruRU, trTR } from '@clerk/localizations';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  I18nProvider,
  LanguageSelector,
  useI18n,
  type Locale,
} from '@/lib/i18n';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Limit, { LimitChooser } from '@/pages/limit';
import StaffApplications from '@/pages/staff-applications';
import StaffB2BListings from '@/pages/staff-b2b-listings';
import StaffB2BVerifications from '@/pages/staff-b2b-verifications';
import StaffB2BReports from '@/pages/staff-b2b-reports';
import DemoWallet from '@/pages/demo-wallet';
import ConstructionStorePage from '@/pages/construction-store';
import PaymentPage, { MockPaymentPage, PaymentResultPage } from '@/pages/payment';
import FreeB2BNetworkPage from '@/pages/free-b2b-network';
import B2BListingDetail from '@/pages/b2b-listing-detail';
import B2BJoinPage from '@/pages/b2b-join';
import B2BRequestPage from '@/pages/b2b-request';
import StaffB2BRequests from '@/pages/staff-b2b-requests';
import StaffMediaCenter from '@/pages/staff-media-center';
import LogisticsHubPage from '@/pages/logistics-hub';
import DepartmentsOverviewPage, { DepartmentPage } from '@/pages/departments';
import StaffResponsibilityCenter from '@/pages/staff-responsibility-center';
import StaffOperationsDesk from '@/pages/staff-operations-desk';
import {
  AboutPage,
  CareersPage,
  CookiePage,
  ContactPage,
  DeliveryPage,
  DistanceSalesPage,
  InvestmentsPage,
  KvkkPage,
  PrivacyPage,
  RefundPage,
  ServiceTermsPage,
} from '@/pages/site-pages';
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
type ClerkLocalization = NonNullable<
  ComponentProps<typeof ClerkProvider>["localization"]
>;
const clerkLocalizations: Record<Locale, ClerkLocalization> = {
  tr: trTR as unknown as ClerkLocalization,
  en: enUS as unknown as ClerkLocalization,
  ar: arSA as unknown as ClerkLocalization,
  ru: ruRU as unknown as ClerkLocalization,
};

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
        fallbackRedirectUrl={`${basePath}/b2b-agi/katil`}
      />
    </div>
  );
}

function StaffSignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <SignIn
        routing="path"
        path={`${basePath}/staff/giris`}
        signUpUrl={`${basePath}/staff/kayit`}
        fallbackRedirectUrl={`${basePath}/staff/sorumluluk-merkezi`}
      />
    </div>
  );
}

function StaffSignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <SignUp
        routing="path"
        path={`${basePath}/staff/kayit`}
        signInUrl={`${basePath}/staff/giris`}
        fallbackRedirectUrl={`${basePath}/staff/sorumluluk-merkezi`}
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
        fallbackRedirectUrl={`${basePath}/b2b-agi/katil?welcome=1`}
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
        <Route path="/insaat-magaza" component={ConstructionStorePage} />
        <Route path="/cuzdan-demo" component={DemoWallet} />
        <Route path="/b2b-agi" component={FreeB2BNetworkPage} />
        <Route path="/b2b-agi/katil" component={B2BJoinPage} />
        <Route path="/b2b-agi/talep" component={B2BRequestPage} />
        <Route path="/b2b-agi/ilan/:id" component={B2BListingDetail} />
        <Route path="/lojistik" component={LogisticsHubPage} />
        <Route path="/birimler" component={DepartmentsOverviewPage} />
        <Route path="/birimler/:slug" component={DepartmentPage} />
        <Route path="/odeme" component={PaymentPage} />
        <Route path="/odeme/test" component={MockPaymentPage} />
        <Route path="/odeme/sonuc" component={PaymentResultPage} />
        <Route path="/hakkimizda" component={AboutPage} />
        <Route path="/iletisim" component={ContactPage} />
        <Route path="/hizmet-kosullari" component={ServiceTermsPage} />
        <Route path="/iade" component={RefundPage} />
        <Route path="/teslimat" component={DeliveryPage} />
        <Route path="/mesafeli-satis" component={DistanceSalesPage} />
        <Route path="/gizlilik" component={PrivacyPage} />
        <Route path="/cerez" component={CookiePage} />
        <Route path="/kvkk" component={KvkkPage} />
        <Route path="/yatirimlar" component={InvestmentsPage} />
        <Route path="/kariyer" component={CareersPage} />
        <Route path="/staff/applications" component={StaffApplications} />
        <Route path="/staff/ilanlar" component={StaffB2BListings} />
        <Route path="/staff/medya-merkezi" component={StaffMediaCenter} />
        <Route path="/staff/b2b-dogrulamalar" component={StaffB2BVerifications} />
        <Route path="/staff/b2b-sikayetler" component={StaffB2BReports} />
        <Route path="/staff/b2b-talepler" component={StaffB2BRequests} />
        <Route path="/staff/sorumluluk-merkezi" component={StaffResponsibilityCenter} />
        <Route path="/staff/operasyon-masasi" component={StaffOperationsDesk} />
        <Route path="/staff/giris/*?" component={StaffSignInPage} />
        <Route path="/staff/kayit/*?" component={StaffSignUpPage} />
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
    <I18nProvider>
      <WouterRouter base={basePath}>
        <LanguageSelector />
        <ClerkApp />
      </WouterRouter>
    </I18nProvider>
  );
}

function ClerkApp() {
  const [location, setLocation] = useLocation();
  const { locale } = useI18n();
  const clerkRoute =
    location === '/staff/applications' ||
    location === '/staff/ilanlar' ||
    location === '/staff/medya-merkezi' ||
    location === '/staff/b2b-dogrulamalar' ||
    location === '/staff/b2b-sikayetler' ||
    location === '/staff/b2b-talepler' ||
    location === '/staff/sorumluluk-merkezi' ||
     location === '/staff/operasyon-masasi' ||
    location.startsWith('/staff/giris') ||
     location.startsWith('/staff/kayit') ||
    location === '/b2b-agi' ||
    location.startsWith('/b2b-agi/ilan/') ||
    location === '/b2b-agi/katil' ||
    location === '/b2b-agi/talep' ||
    location.startsWith('/sign-in') ||
    location.startsWith('/sign-up');
  const routedContent = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );

  return (
    clerkRoute ? (
      <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        localization={clerkLocalizations[locale]}
        appearance={clerkAppearance}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        routerPush={(to) => setLocation(stripBase(to))}
        routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      >
        {routedContent}
      </ClerkProvider>
    ) : (
      routedContent
    )
  );
}

export default App;
