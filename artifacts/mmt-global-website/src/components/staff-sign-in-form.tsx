import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSignIn } from '@clerk/react/legacy';
import { Link, useLocation } from 'wouter';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function signInErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'errors' in error) {
    const errors = error.errors;
    if (Array.isArray(errors)) {
      const first = errors[0] as { longMessage?: unknown; message?: unknown } | undefined;
      const text = first?.longMessage || first?.message;
      if (typeof text === 'string' && text.trim()) return text;
    }
  }
  return 'Giriş isteği tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.';
}

type SignInFormProps = {
  redirectTo?: string;
  alternativeSignInUrl?: string;
  signUpUrl?: string;
  companyPanel?: boolean;
};

export function StaffSignInForm({
  redirectTo = '/staff/yonlendir',
  alternativeSignInUrl = '/staff/giris/standart',
  signUpUrl = '/staff/kayit',
  companyPanel = false,
}: SignInFormProps) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(0);
  const timeout = useRef<number | null>(null);

  useEffect(() => () => {
    attempt.current += 1;
    if (timeout.current !== null) window.clearTimeout(timeout.current);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!isLoaded || !signIn || !setActive) {
      setError('Giriş servisi henüz yüklenmedi. Birazdan yeniden deneyin.');
      return;
    }
    // Read the actual controls: Safari/password managers may autofill without
    // dispatching the onChange event that updates React state.
    const fields = new FormData(event.currentTarget);
    const identifier = String(fields.get('email') ?? email).trim();
    const submittedPassword = String(fields.get('password') ?? password);
    if (step === 'email' && !EMAIL_SHAPE.test(identifier)) {
      setError('Geçerli bir e-posta adresi yazın.');
      return;
    }
    if (step === 'password' && !submittedPassword) {
      setError('Şifrenizi yazın.');
      return;
    }

    const currentAttempt = ++attempt.current;
    setError(null);
    setBusy(true);
    const requestTimeout = window.setTimeout(() => {
      if (attempt.current !== currentAttempt) return;
      attempt.current += 1;
      setBusy(false);
      setError('Giriş servisi yanıt vermedi. Bağlantınızı kontrol edip yeniden deneyin.');
    }, 12000);
    timeout.current = requestTimeout;

    async function activateSession(sessionId: string) {
      await setActive!({
        session: sessionId,
        navigate: ({ session, decorateUrl }) => {
          if (attempt.current !== currentAttempt) return;
          const target = session.currentTask ? alternativeSignInUrl : redirectTo;
          const destination = decorateUrl(`${basePath}${target}`);
          // Clerk may return an absolute, decorated URL for Safari's cookie
          // refresh. Do not drop that decoration through client-only routing.
          if (/^https?:\/\//.test(destination)) {
            window.location.assign(destination);
          } else {
            navigate(basePath && destination.startsWith(`${basePath}/`)
              ? destination.slice(basePath.length) : destination);
          }
        },
      });
    }

    try {
      if (step === 'email') {
        const result = await signIn.create({ identifier });
        if (attempt.current !== currentAttempt) return;
        if (result.status === 'needs_first_factor' &&
            result.supportedFirstFactors?.some((factor) => factor.strategy === 'password')) {
          setEmail(identifier);
          setStep('password');
        } else if (result.status === 'complete' && result.createdSessionId) {
          await activateSession(result.createdSessionId);
        } else {
          setError('Bu hesap için şifreyle giriş kullanılamıyor. Diğer giriş yöntemlerini seçin.');
        }
      } else {
        const result = await signIn.attemptFirstFactor({ strategy: 'password', password: submittedPassword });
        if (attempt.current !== currentAttempt) return;
        if (result.status === 'complete' && result.createdSessionId) {
          await activateSession(result.createdSessionId);
        } else {
          setError('Bu hesap ek doğrulama gerektiriyor. Diğer giriş yöntemlerinden devam edin.');
        }
      }
    } catch (cause) {
      if (attempt.current === currentAttempt) setError(signInErrorMessage(cause));
    } finally {
      window.clearTimeout(requestTimeout);
      // A timed-out request may settle after a retry. It must not clear the
      // retry's watchdog or release the retry's busy state.
      if (timeout.current === requestTimeout) timeout.current = null;
      if (attempt.current === currentAttempt) setBusy(false);
    }
  }

  return (
    <main className="w-full max-w-[360px] border border-white/20 bg-[#111923] px-8 py-9 text-white shadow-xl">
      <div className="mb-9 flex justify-center">
        <img src={`${basePath}/logo.svg`} alt="MMT Global" className="h-9 max-w-[180px] object-contain" />
      </div>
      <h1 className="text-center text-xl font-semibold">{companyPanel ? 'MMT Connect — Giriş yap' : 'Personel — Giriş yap'}</h1>
      <p className="mt-1 text-center text-sm text-white/70">
        {companyPanel ? 'Şirket ve ekip panelinize giriş yapın.' : 'Personel çalışma alanınıza giriş yapın.'}
      </p>

      <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5">
        {step === 'email' ? (
          <label className="block text-sm">
            <span className="mb-2 block">E-posta adresi</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              readOnly={busy}
              onChange={(event) => { setEmail(event.target.value); setError(null); }}
              placeholder="ornek@email.com"
              className="h-11 w-full border border-white/15 bg-[#151f2d] px-3 text-white outline-none placeholder:text-white/35 focus:border-[#ef6500]"
            />
          </label>
        ) : (
          <>
            <div className="text-center text-sm text-white/70">
              <span className="break-all">{email}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setStep('email'); setPassword(''); setError(null); }}
                className="ml-2 text-[#ff842e] underline"
              >
                Değiştir
              </button>
            </div>
            <input type="hidden" name="email" value={email} autoComplete="username" />
            <label className="block text-sm">
              <span className="mb-2 block">Şifre</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                readOnly={busy}
                onChange={(event) => { setPassword(event.target.value); setError(null); }}
                className="h-11 w-full border border-white/15 bg-[#151f2d] px-3 text-white outline-none focus:border-[#ef6500]"
              />
            </label>
          </>
        )}
        {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
        {busy && <p role="status" className="text-sm text-white/65">Giriş kontrol ediliyor…</p>}
        {!isLoaded && <p role="status" className="text-sm text-white/70">Giriş servisi hazırlanıyor…</p>}
        <button
          type="submit"
          disabled={!isLoaded || busy}
          className="h-11 w-full bg-[#ef6500] font-medium text-white transition-colors hover:bg-[#d65a00] disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? 'Lütfen bekleyin…' : step === 'email' ? 'İleri' : 'Giriş yap'}
        </button>
      </form>

      <div className="mt-8 space-y-4 text-center text-sm">
        <Link href={alternativeSignInUrl} className="block text-[#ff842e] underline">
          Diğer giriş yöntemleri / Şifremi unuttum
        </Link>
        <p className="text-white/55">
          Hesabınız yok mu? <Link href={signUpUrl} className="text-[#ff842e]">Kayıt ol</Link>
        </p>
      </div>
    </main>
  );
}