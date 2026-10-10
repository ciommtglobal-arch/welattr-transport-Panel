import { createHmac, timingSafeEqual } from "node:crypto";

export const REQUIRED_INTAKE_FIELDS = [
  "requesterName",
  "email",
  "origin",
  "destination",
  "cargoType",
  "weightKg",
  "volumeM3",
  "transportMode",
  "loadingDate",
] as const;

export type RequiredIntakeField = (typeof REQUIRED_INTAKE_FIELDS)[number];
export type LogisticsTransportMode = "road" | "sea" | "air";

export type LogisticsIntakeValues = {
  requesterName: string | null;
  organization: string | null;
  email: string | null;
  origin: string | null;
  destination: string | null;
  cargoType: string | null;
  weightKg: number | null;
  volumeM3: number | null;
  transportMode: LogisticsTransportMode | null;
  loadingDate: string | null;
  notes: string | null;
};

export type WhatsAppTextMessage = {
  providerMessageId: string;
  senderPhone: string;
  profileName: string | null;
  text: string;
};

const FIELD_LABELS: Record<RequiredIntakeField, string> = {
  requesterName: "Ad soyad",
  email: "E-posta",
  origin: "Çıkış noktası",
  destination: "Varış noktası",
  cargoType: "Yük türü",
  weightKg: "Ağırlık (kg)",
  volumeM3: "Hacim (m³)",
  transportMode: "Taşıma modu (kara/deniz/hava)",
  loadingDate: "Yükleme tarihi (YYYY-AA-GG)",
};

const FIELD_ALIASES: Record<RequiredIntakeField | "organization", string[]> = {
  requesterName: ["ad", "adsoyad", "isim", "name", "customername", "requestername"],
  email: ["email", "eposta", "mail"],
  origin: ["cikis", "cikisnoktasi", "nereden", "origin", "from"],
  destination: ["varis", "varisnoktasi", "nereye", "destination", "to"],
  cargoType: ["yuk", "yukcinsi", "yuktur", "yukturu", "cargotype", "cargo"],
  weightKg: ["agirlik", "agirlikkg", "weight", "weightkg"],
  volumeM3: ["hacim", "hacimm3", "volume", "volumem3"],
  transportMode: ["tasima", "tasimamodu", "tasimatipi", "transport", "transportmode"],
  loadingDate: ["yuklemetarihi", "tarih", "loadingdate", "date"],
  organization: ["firma", "organizasyon", "organization", "company"],
};

function normalizeLabel(value: string) {
  return value
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]/gu, "");
}

const FIELD_BY_ALIAS = new Map(
  Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) =>
    aliases.map((alias) => [normalizeLabel(alias), field] as const),
  ),
);

function parsePositiveNumber(value: string): number | null {
  let normalized = value.trim().replace(/\s/g, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = normalized.replace(",", ".");
  }
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseTransportMode(value: string): LogisticsTransportMode | null {
  const normalized = normalizeLabel(value);
  if (["road", "land", "kara", "karayolu", "karatasima"].includes(normalized)) {
    return "road";
  }
  if (["sea", "deniz", "denizyolu", "deniztasima"].includes(normalized)) {
    return "sea";
  }
  if (["air", "hava", "havayolu", "havatasima"].includes(normalized)) {
    return "air";
  }
  return null;
}

function parseLoadingDate(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const localMatch = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(trimmed);
  const parts = isoMatch
    ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
    : localMatch
      ? [Number(localMatch[3]), Number(localMatch[2]), Number(localMatch[1])]
      : null;
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseFieldValue(
  field: RequiredIntakeField | "organization",
  raw: string,
): string | number | LogisticsTransportMode | null {
  const value = raw.trim().slice(0, 500);
  if (!value) return null;

  if (field === "email") {
    const email = value.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }
  if (field === "weightKg" || field === "volumeM3") {
    return parsePositiveNumber(value);
  }
  if (field === "transportMode") return parseTransportMode(value);
  if (field === "loadingDate") return parseLoadingDate(value);
  if (field === "requesterName" && value.length < 2) return null;
  if (
    field !== "organization" &&
    (field === "requesterName" ||
      field === "origin" ||
      field === "destination" ||
      field === "cargoType") &&
    value.length < 2
  ) {
    return null;
  }
  return value;
}

function isCompleteValue(
  field: RequiredIntakeField,
  value: LogisticsIntakeValues[RequiredIntakeField],
) {
  if (value === null || value === undefined) return false;
  if (field === "weightKg" || field === "volumeM3") {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }
  return typeof value === "string" && value.trim().length > 0;
}

export function getMissingIntakeFields(values: LogisticsIntakeValues) {
  return REQUIRED_INTAKE_FIELDS.filter(
    (field) => !isCompleteValue(field, values[field]),
  );
}

export function applyWhatsAppMessageToDraft(
  current: LogisticsIntakeValues,
  message: string,
  profileName: string | null,
) {
  const values: LogisticsIntakeValues = { ...current };
  const invalidFields = new Set<RequiredIntakeField>();
  if (!values.requesterName && profileName?.trim()) {
    values.requesterName = profileName.trim().slice(0, 120);
  }

  const labeledValues = new Map<
    RequiredIntakeField | "organization",
    string
  >();
  for (const line of message.split(/[\n;]+/)) {
    const match = /^\s*([^:：=]+)\s*[:：=]\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const field = FIELD_BY_ALIAS.get(normalizeLabel(match[1]));
    if (field) labeledValues.set(field as RequiredIntakeField | "organization", match[2]);
  }

  if (labeledValues.size === 0) {
    const missing = getMissingIntakeFields(values);
    if (missing.length === 1 && message.trim()) {
      labeledValues.set(missing[0], message.trim());
    }
  }

  for (const [field, rawValue] of labeledValues) {
    const parsed = parseFieldValue(field, rawValue);
    if (parsed === null) {
      if (field !== "organization") invalidFields.add(field);
      continue;
    }
    if (field === "organization") {
      values.organization = String(parsed);
    } else {
      (values as Record<RequiredIntakeField, unknown>)[field] = parsed;
    }
  }

  return {
    values,
    missingFields: getMissingIntakeFields(values),
    invalidFields: [...invalidFields],
  };
}

export function buildMissingInformationReply(
  missingFields: RequiredIntakeField[],
  invalidFields: RequiredIntakeField[] = [],
) {
  const invalidText = invalidFields.length
    ? ` Şu değerleri okuyamadım: ${invalidFields.map((field) => FIELD_LABELS[field]).join(", ")}.`
    : "";

  if (missingFields.length === 1) {
    const field = missingFields[0];
    const example =
      field === "email"
        ? "ornek@firma.com"
        : field === "weightKg" || field === "volumeM3"
          ? "ör. 1200"
          : field === "transportMode"
            ? "kara, deniz veya hava"
            : field === "loadingDate"
              ? "2026-10-09"
              : "bilgiyi yazın";
    return `Lojistik talebinizi taslak olarak kaydettim.${invalidText} Eksik bilgi: ${FIELD_LABELS[field]}. Lütfen yanıt olarak ${example} gönderin.`;
  }

  const fields = missingFields.map((field) => FIELD_LABELS[field]).join(", ");
  const example = missingFields
    .map((field) => `${FIELD_LABELS[field]}: …`)
    .join("\n");
  return `Lojistik talebinizi taslak olarak kaydettim.${invalidText} Tamamlamak için şu bilgiler eksik: ${fields}.\nLütfen eksik alanları şu biçimde yanıtlayın:\n${example}`;
}

export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string | undefined,
) {
  if (!appSecret || !signature) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signature);
  if (!match) return false;
  const provided = Buffer.from(match[1], "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function verifyMetaWebhookChallenge(
  mode: unknown,
  challenge: unknown,
  providedToken: unknown,
  expectedToken: string | undefined,
) {
  if (
    mode !== "subscribe" ||
    typeof challenge !== "string" ||
    typeof providedToken !== "string" ||
    !expectedToken
  ) {
    return null;
  }
  const supplied = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }
  return challenge;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function extractWhatsAppTextMessages(
  payload: unknown,
  expectedPhoneNumberId: string,
): WhatsAppTextMessage[] {
  const root = record(payload);
  if (!root || !Array.isArray(root.entry)) return [];

  const messages: WhatsAppTextMessage[] = [];
  for (const entryValue of root.entry) {
    const entry = record(entryValue);
    if (!entry || !Array.isArray(entry.changes)) continue;
    for (const changeValue of entry.changes) {
      const change = record(changeValue);
      const value = record(change?.value);
      const metadata = record(value?.metadata);
      if (metadata?.phone_number_id !== expectedPhoneNumberId) continue;
      if (!Array.isArray(value?.messages)) continue;

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      for (const messageValue of value.messages) {
        const message = record(messageValue);
        const text = record(message?.text);
        if (
          message?.type !== "text" ||
          typeof message.id !== "string" ||
          typeof message.from !== "string" ||
          typeof text?.body !== "string"
        ) {
          continue;
        }
        const senderPhone = message.from.replace(/[^\d+]/g, "");
        if (!/^\+?\d{7,15}$/.test(senderPhone)) continue;
        const contact = contacts
          .map(record)
          .find((candidate) => candidate?.wa_id === message.from);
        const profile = record(contact?.profile);
        messages.push({
          providerMessageId: message.id,
          senderPhone,
          profileName:
            typeof profile?.name === "string" ? profile.name.slice(0, 120) : null,
          text: text.body.slice(0, 4000),
        });
      }
    }
  }
  return messages;
}
