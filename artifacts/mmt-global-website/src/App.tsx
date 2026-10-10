import { lazy, Suspense, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import { arSA, enUS, ruRU, trTR, ukUA } from '@clerk/localizations';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { StaffSignInForm } from '@/components/staff-sign-in-form';
import { getAuthNavigation } from '@/lib/auth-navigation';
import {
  I18nProvider,
  LanguageSelector,
  useI18n,
  type Locale,
} from '@/lib/i18n';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Route,
  Redirect,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const status =
            typeof error === 'object' && error !== null && 'status' in error
              ? error.status
              : undefined;
          if (status === 401) return failureCount < 1;
          if (status === 403) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

// Public, non-Clerk routes can share cache; authenticated routes use a separate
// client instance per Clerk identity below.
const publicQueryClient = createQueryClient();

const NotFound = lazy(() => import('@/pages/not-found'));
const CorporateHome = lazy(() => import('@/pages/corporate-home'));

const LogisticsPreview = import.meta.env.DEV
  ? lazy(() => import('@/pages/logistics-preview'))
  : null;
const LimitChooser = lazy(() =>
  import('@/pages/limit').then((module) => ({ default: module.LimitChooser })),
);
const Limit = lazy(() => import('@/pages/limit'));
const StaffApplications = lazy(() => import('@/pages/staff-applications'));
const StaffB2BListings = lazy(() => import('@/pages/staff-b2b-listings'));
const StaffB2BVerifications = lazy(() => import('@/pages/staff-b2b-verifications'));
const StaffB2BReports = lazy(() => import('@/pages/staff-b2b-reports'));
const DemoWallet = lazy(() => import('@/pages/demo-wallet'));
const ConstructionStorePage = lazy(() => import('@/pages/construction-store'));
const ConstructionProductPage = lazy(() =>
  import('@/pages/construction-shop').then((module) => ({ default: module.ConstructionProductPage })),
);
const ConstructionCartPage = lazy(() =>
  import('@/pages/construction-shop').then((module) => ({ default: module.ConstructionCartPage })),
);
const ConstructionQuotePage = lazy(() =>
  import('@/pages/construction-shop').then((module) => ({ default: module.ConstructionQuotePage })),
);
const StaffConstructionQuotes = lazy(() => import('@/pages/staff-construction-quotes'));

const StaffNexusDesk = lazy(() => import('@/pages/staff-nexus-desk'));
const PaymentPage = lazy(() => import('@/pages/payment'));
const MockPaymentPage = lazy(() =>
  import('@/pages/payment').then((module) => ({ default: module.MockPaymentPage })),
);
const PaymentResultPage = lazy(() =>
  import('@/pages/payment').then((module) => ({ default: module.PaymentResultPage })),
);
const TestPaymentPage = lazy(() =>
  import('@/pages/payment').then((module) => ({ default: module.TestPaymentPage })),
);
const FreeB2BNetworkPage = lazy(() => import('@/pages/free-b2b-network'));
const B2BListingDetail = lazy(() => import('@/pages/b2b-listing-detail'));
const B2BJoinPage = lazy(() => import('@/pages/b2b-join'));
const B2BRequestPage = lazy(() => import('@/pages/b2b-request'));
const B2BCompanyPanel = lazy(() => import('@/pages/b2b-company-panel'));
const StaffB2BRequests = lazy(() => import('@/pages/staff-b2b-requests'));
const StaffMediaCenter = lazy(() => import('@/pages/staff-media-center'));
const LogisticsHubPage = lazy(() => import('@/pages/logistics-hub'));
const DepartmentsOverviewPage = lazy(() =>
  import('@/pages/departments').then((module) => ({ default: module.default })),
);
const DepartmentPage = lazy(() =>
  import('@/pages/departments').then((module) => ({ default: module.DepartmentPage })),
);
const StaffResponsibilityCenter = lazy(() => import('@/pages/staff-responsibility-center'));
const StaffOperationsDesk = lazy(() => import('@/pages/staff-operations-desk'));
const StaffExpertWorkspace = lazy(() =>
  import('@/pages/staff-expert-workspace').then((module) => ({ default: module.StaffExpertWorkspace })),
);
const StaffWorkspaceRedirect = lazy(() =>
  import('@/pages/staff-workspace').then((module) => ({ default: module.StaffWorkspaceRedirect })),
);
const FounderDashboard = lazy(() =>
  import('@/pages/staff-workspace').then((module) => ({ default: module.FounderDashboard })),
);

const StaffLogisticsListings = lazy(() => import('@/pages/staff-logistics-listings'));

const StaffLogisticsOperations = lazy(() => import('@/pages/staff-logistics-operations'));
const AboutPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.AboutPage })));
const CareersPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.CareersPage })));
const CookiePage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.CookiePage })));
const ContactPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.ContactPage })));
const DeliveryPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.DeliveryPage })));
const DistanceSalesPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.DistanceSalesPage })));
const InvestmentsPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.InvestmentsPage })));
const KvkkPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.KvkkPage })));
const PrivacyPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.PrivacyPage })));
const RefundPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.RefundPage })));
const ServiceTermsPage = lazy(() => import('@/pages/site-pages').then((module) => ({ default: module.ServiceTermsPage })));
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const isStaffDomain = window.location.hostname.toLowerCase() === 'panel.mmtglobal.com.tr';
type ClerkLocalization = NonNullable<
  ComponentProps<typeof ClerkProvider>["localization"]
>;
const clerkLocalizations: Record<Locale, ClerkLocalization> = {
  tr: trTR as unknown as ClerkLocalization,
  en: enUS as unknown as ClerkLocalization,
  ar: arSA as unknown as ClerkLocalization,
  ru: ruRU as unknown as ClerkLocalization,
  uk: ukUA as unknown as ClerkLocalization,
  // Clerk has no bundled Kurmanji pack. Its own dialogs use English;
  // MMT Global's surrounding pages use the Kurmanji UI pack.
  ku: enUS as unknown as ClerkLocalization,
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

function getInviteToken() {
  if (typeof window === 'undefined') return '';
  const token = new URLSearchParams(window.location.search).get('invite');
  if (token !== null) return token;
  try {
    return window.sessionStorage.getItem('mmt-connect-invite') ?? '';
  } catch {
    return '';
  }
}

function rememberInviteToken() {
  const inviteToken = getInviteToken();
  if (inviteToken && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem('mmt-connect-invite', inviteToken);
    } catch {
      // Query parameters still carry the invite when storage is unavailable.
    }
  }
}

function getInviteAwarePanelRedirect(fallback: string) {
  const inviteToken = getInviteToken();
  return inviteToken
    ? `${basePath}/b2b-agi/panel?invite=${encodeURIComponent(inviteToken)}`
    : fallback;
}

function getInviteAwareAuthUrl(path: string) {
  const inviteToken = getInviteToken();
  return inviteToken
    ? `${path}?invite=${encodeURIComponent(inviteToken)}`
    : path;
}

function normalizeRoutePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

function SignInPage() {
  rememberInviteToken();
  const { isLoaded, isSignedIn } = useAuth();
  const panelUrl = getInviteAwarePanelRedirect(`${basePath}/b2b-agi/panel`);
  const [location] = useLocation();
  const navigation = getAuthNavigation('company', window.location.search, getInviteToken());
  const simpleSignIn = normalizeRoutePath(location) === '/sign-in';
  const standardPath = location.startsWith('/sign-in/standart')
    ? '/sign-in/standart' : '/sign-in';

  if (isLoaded && isSignedIn) {
    return <Redirect to={stripBase(panelUrl)} />;
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      {simpleSignIn ? (
        <StaffSignInForm
          redirectTo={navigation.returnPath}
          alternativeSignInUrl={navigation.standardSignInUrl}
          signUpUrl={navigation.signUpUrl}
          companyPanel
        />
      ) : <SignIn
        routing="path"
        path={`${basePath}${standardPath}`}
        signUpUrl={getInviteAwareAuthUrl(`${basePath}/sign-up`)}
        fallbackRedirectUrl={panelUrl}
        forceRedirectUrl={panelUrl}
      />}
    </div>
  );
}

function StaffSignInPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [location] = useLocation();
  const navigation = getAuthNavigation('staff', window.location.search, getInviteToken());
  if (navigation.scope === 'company') rememberInviteToken();
  if (isLoaded && isSignedIn) return <Redirect to={navigation.returnPath} />;
  const standardSignIn = location === '/staff/giris/standart' ||
    location.startsWith('/staff/giris/standart/');
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      {standardSignIn ? (
        <SignIn
          routing="path"
          path={`${basePath}/staff/giris/standart`}
          signUpUrl={`${basePath}${navigation.signUpUrl}`}
          fallbackRedirectUrl={`${basePath}${navigation.returnPath}`}
          forceRedirectUrl={`${basePath}${navigation.returnPath}`}
        />
      ) : <StaffSignInForm
        redirectTo={navigation.returnPath}
        alternativeSignInUrl={navigation.standardSignInUrl}
        signUpUrl={navigation.signUpUrl}
        companyPanel={navigation.scope === 'company'}
      />}
    </div>
  );
}

function StaffSignUpPage() {
  const navigation = getAuthNavigation('staff', window.location.search, getInviteToken());
  if (navigation.scope === 'company') rememberInviteToken();
  const returnUrl = navigation.scope === 'company'
    ? getInviteAwarePanelRedirect(`${basePath}/b2b-agi/katil?welcome=1`)
    : `${basePath}/staff/yonlendir`;
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-background px-4 py-10">
      <SignUp
        routing="path"
        path={`${basePath}/staff/kayit`}
        signInUrl={`${basePath}${navigation.signInUrl}`}
        fallbackRedirectUrl={returnUrl}
        forceRedirectUrl={returnUrl}
      />
      <p className="max-w-md text-center text-sm leading-6 text-foreground/60">
        Hesap oluşturmak tek başına personel, kurucu veya deneme erişimi vermez. Bu erişimler ayrı olarak yetkilendirilir; kayıt ekranı herhangi bir rol ya da erişim tanımlamaz.
      </p>
    </div>
  );
}

function SignUpPage() {
  rememberInviteToken();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={getInviteAwareAuthUrl(`${basePath}/sign-in`)}
        fallbackRedirectUrl={getInviteAwarePanelRedirect(`${basePath}/b2b-agi/katil?welcome=1`)}
        forceRedirectUrl={getInviteAwarePanelRedirect(`${basePath}/b2b-agi/katil?welcome=1`)}
      />
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Suspense fallback={<RouteLoading />}>
      <Switch>
        {LogisticsPreview && <Route path="/lojistik-onizleme" component={LogisticsPreview} />}
        <Route path="/" component={PanelAwareHome} />
        <Route path="/ecosystem" component={PanelAwareHome} />
        <Route path="/limit" component={LimitChooser} />
        <Route path="/limit/bireysel" component={IndividualLimit} />
        <Route path="/limit/ticari" component={CommercialLimit} />
        <Route path="/limit/konut" component={HousingLimit} />
        <Route path="/limit/tasit" component={VehicleLimit} />
        <Route path="/insaat-magaza" component={ConstructionStorePage} />
        <Route path="/insaat-magaza/sepet" component={ConstructionCartPage} />
        <Route path="/insaat-magaza/teklif" component={ConstructionQuotePage} />
        <Route path="/insaat-magaza/urun/:handle" component={ConstructionProductPage} />
        <Route path="/cuzdan-demo" component={DemoWallet} />
        <Route path="/b2b-agi" component={FreeB2BNetworkPage} />
        <Route path="/b2b-agi/katil" component={B2BJoinPage} />
        <Route path="/b2b-agi/panel" component={B2BCompanyPanel} />
        <Route path="/b2b-agi/talep" component={B2BRequestPage} />
        <Route path="/b2b-agi/ilan/:id" component={B2BListingDetail} />
        <Route path="/lojistik" component={LogisticsHubPage} />
        <Route path="/birimler" component={DepartmentsOverviewPage} />
        <Route path="/birimler/:slug" component={DepartmentPage} />
        <Route path="/odeme" component={PaymentPage} />
        <Route path="/odeme/test-baslat" component={TestPaymentPage} />
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
        <Route path="/staff/insaat-teklifleri" component={StaffConstructionQuotes} />
        <Route path="/staff/nexus-denetim" component={StaffNexusDesk} />
        <Route path="/staff/sorumluluk-merkezi" component={StaffResponsibilityCenter} />
        <Route path="/staff/yonlendir" component={StaffWorkspaceRedirect} />
        <Route path="/staff/yonetim-paneli" component={FounderDashboard} />
        <Route path="/staff/calisma-alani" component={StaffExpertWorkspace} />
        <Route path="/staff/lojistik-ilanlari" component={StaffLogisticsListings} />
        <Route path="/staff/lojistik-operasyon" component={StaffLogisticsOperations} />
        <Route path="/staff/operasyon-masasi" component={StaffOperationsDesk} />
        <Route path="/staff/giris/*?" component={StaffSignInPage} />
        <Route path="/staff/kayit/*?" component={StaffSignUpPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </RoutedErrorBoundary>
  );
}

function RouteLoading() {
  const { locale } = useI18n();
  const labels: Record<Locale, string> = {
    tr: 'Yükleniyor…',
    en: 'Loading…',
    ar: 'جارٍ التحميل…',
    ru: 'Загрузка…',
    ku: 'Tê barkirin…',
    uk: 'Завантаження…',
  };
  return (
    <main className="flex min-h-[50vh] items-center justify-center bg-background px-5 text-sm text-muted-foreground" role="status">
      {labels[locale]}
    </main>
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
        <PageLanguageSelector />
        <ClerkApp />
      </WouterRouter>
    </I18nProvider>
  );
}

function PageLanguageSelector() {
  const [location] = useLocation();
  if (import.meta.env.DEV && normalizeRoutePath(location) === '/lojistik-onizleme') return null;
  const isCorporateHome = ['/', '/ecosystem'].includes(normalizeRoutePath(location));
  return isCorporateHome && !isStaffDomain ? null : <LanguageSelector />;
}

function PanelAwareHome() {
  const [location] = useLocation();
  if (isStaffDomain) {
    return <Redirect to="/staff/yonlendir" />;
  }
  // Only the development preview's home changes; production keeps CorporateHome.
  // /ecosystem remains available for the existing business-area presentation.
  if (LogisticsPreview && normalizeRoutePath(location) === '/') {
    return <LogisticsPreview />;
  }
  return <CorporateHome />;
}

function AuthServiceLoading() {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setTimedOut(true), 12000);
    return () => window.clearTimeout(timeout);
  }, []);
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <section className="max-w-sm space-y-5 border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold">MMT Global — Giriş</h1>
        <p role={timedOut ? 'alert' : 'status'} className="text-base leading-7">
          {timedOut
            ? 'Giriş servisi yüklenemedi. Bağlantınızı kontrol edip sayfayı yeniden açın.'
            : 'Giriş servisi hazırlanıyor…'}
        </p>
        {timedOut && <button type="button" onClick={() => window.location.reload()}
          className="w-full bg-primary px-5 py-3 font-semibold text-primary-foreground">
          Yeniden yükle
        </button>}
      </section>
    </main>
  );
}

function ClerkIdentityQueryProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const identityKey = isSignedIn && userId ? userId : 'signed-out';
  const client = useMemo(
    () => isLoaded ? createQueryClient() : null,
    [isLoaded, identityKey],
  );

  if (!isLoaded || !client) return <AuthServiceLoading />;
  return (
    <QueryClientProvider key={identityKey} client={client}>
      {children}
    </QueryClientProvider>
  );
}

function ClerkApp() {
  const [location, setLocation] = useLocation();
  const { locale } = useI18n();
  const normalizedLocation = normalizeRoutePath(location);
  const clerkRoute =
    normalizedLocation === '/staff' ||
    normalizedLocation.startsWith('/staff/') ||
    normalizedLocation === '/b2b-agi' ||
    normalizedLocation.startsWith('/b2b-agi/ilan/') ||
    normalizedLocation === '/b2b-agi/katil' ||
    normalizedLocation === '/b2b-agi/panel' ||
    normalizedLocation === '/b2b-agi/talep' ||
    normalizedLocation.startsWith('/sign-in') ||
    normalizedLocation.startsWith('/sign-up');
  const routedContent = (
    <TooltipProvider>
      <Router />
      <Toaster />
    </TooltipProvider>
  );

  return (
    clerkRoute ? (
      <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        localization={clerkLocalizations[locale]}
        appearance={clerkAppearance}
        signInUrl={`${basePath}${isStaffDomain ? '/staff/giris' : '/sign-in'}`}
        signUpUrl={`${basePath}${isStaffDomain ? '/staff/kayit' : '/sign-up'}`}
        routerPush={(to) => setLocation(stripBase(to))}
        routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
      >
        <ClerkIdentityQueryProvider>{routedContent}</ClerkIdentityQueryProvider>
      </ClerkProvider>
    ) : (
      <QueryClientProvider client={publicQueryClient}>
        {routedContent}
      </QueryClientProvider>
    )
  );
}

export default App;
