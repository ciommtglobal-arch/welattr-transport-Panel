import additionalLocales from "./additional-locales.json";

export type CoreLocale = "tr" | "en" | "ar" | "ru";
export type Locale = CoreLocale | "ku" | "uk";

const cache = new WeakMap<object, Partial<Record<"ku" | "uk", unknown>>>();

function translateCopy(value: unknown, locale: "ku" | "uk", key = ""): unknown {
  if (typeof value === "string") {
    // Identifiers and navigation targets are not language-dependent.
    if (key === "id" || /^(https?:|\/|mailto:|tel:|#)/.test(value)) return value;
    const dictionary: Record<string, string> = additionalLocales[locale];
    const translated = dictionary[value];
    if (!translated) throw new Error(`Missing ${locale} UI translation: ${value}`);
    return translated;
  }
  if (Array.isArray(value)) return value.map((item) => translateCopy(item, locale));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, translateCopy(item, locale, name)]),
    );
  }
  return value;
}

/** Preserve the existing four language packs and translate only additional locales. */
export function getLocaleCopy<T>(copies: Record<CoreLocale, T>, locale: Locale): T {
  if (locale !== "ku" && locale !== "uk") return copies[locale];
  const existing = cache.get(copies) ?? {};
  if (!(locale in existing)) {
    existing[locale] = translateCopy(copies.en, locale);
    cache.set(copies, existing);
  }
  return existing[locale] as T;
}

export function normalizeLocale(value: string | null): Locale {
  // UA is the requested display label; uk is the standard Ukrainian language code.
  if (value === "ua") return "uk";
  return value === "en" || value === "ar" || value === "ru" ||
    value === "ku" || value === "uk" ? value : "tr";
}
