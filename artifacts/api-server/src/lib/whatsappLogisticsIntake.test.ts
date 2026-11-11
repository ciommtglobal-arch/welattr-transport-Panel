import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  applyWhatsAppMessageToDraft,
  buildMissingInformationReply,
  extractWhatsAppTextMessages,
  getMissingIntakeFields,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
  type LogisticsIntakeValues,
} from "./whatsappLogisticsIntake";

const emptyDraft: LogisticsIntakeValues = {
  requesterName: null,
  organization: null,
  email: null,
  origin: null,
  destination: null,
  cargoType: null,
  weightKg: null,
  volumeM3: null,
  transportMode: null,
  loadingDate: null,
  notes: null,
};

describe("WhatsApp logistics intake", () => {
  it("parses labeled Turkish details and normalized numbers", () => {
    const result = applyWhatsAppMessageToDraft(
      emptyDraft,
      [
        "E-posta: me@example.com",
        "Nereden: Mersin",
        "Nereye: Erbil",
        "Yük türü: Makine",
        "Ağırlık (kg): 1.250,5",
        "Hacim (m³): 12,5",
        "Taşıma modu: kara",
        "Yükleme tarihi: 09.10.2026",
      ].join("\n"),
      "Mehmet",
    );

    expect(result.values).toMatchObject({
      requesterName: "Mehmet",
      email: "me@example.com",
      origin: "Mersin",
      destination: "Erbil",
      cargoType: "Makine",
      weightKg: 1250.5,
      volumeM3: 12.5,
      transportMode: "road",
      loadingDate: "2026-10-09",
    });
    expect(result.missingFields).toEqual([]);
  });

  it("uses a plain reply when only one required field remains", () => {
    const partial = {
      ...emptyDraft,
      requesterName: "Mehmet",
      email: "me@example.com",
      origin: "Mersin",
      destination: "Erbil",
      cargoType: "Makine",
      weightKg: 1200,
      volumeM3: 10,
      transportMode: "road" as const,
      loadingDate: null,
    };

    const result = applyWhatsAppMessageToDraft(partial, "2026-10-12", null);
    expect(result.values.loadingDate).toBe("2026-10-12");
    expect(result.missingFields).toEqual([]);
  });

  it("keeps invalid values missing and asks for completion", () => {
    const result = applyWhatsAppMessageToDraft(
      emptyDraft,
      "E-posta: bozuk-adres\nAğırlık (kg): -3",
      null,
    );

    expect(result.values.email).toBeNull();
    expect(result.values.weightKg).toBeNull();
    expect(result.invalidFields).toContain("email");
    expect(result.invalidFields).toContain("weightKg");
    expect(buildMissingInformationReply(result.missingFields, result.invalidFields))
      .toContain("okuyamadım");
    expect(getMissingIntakeFields(result.values)).toContain("email");
  });

  it("verifies Meta signatures and rejects tampered bodies", () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac("sha256", "app-secret")
      .update(body)
      .digest("hex")}`;

    expect(verifyMetaWebhookSignature(body, signature, "app-secret")).toBe(true);
    expect(verifyMetaWebhookSignature(Buffer.from("tampered"), signature, "app-secret"))
      .toBe(false);
    expect(verifyMetaWebhookSignature(body, "sha256=bad", "app-secret")).toBe(false);
  });

  it("checks the webhook handshake token without accepting another token", () => {
    expect(
      verifyMetaWebhookChallenge("subscribe", "challenge", "verify-token", "verify-token"),
    ).toBe("challenge");
    expect(
      verifyMetaWebhookChallenge("subscribe", "challenge", "wrong", "verify-token"),
    ).toBeNull();
  });

  it("extracts only text messages for the configured business number", () => {
    const result = extractWhatsAppTextMessages(
      {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "phone-1" },
                  contacts: [
                    { wa_id: "905551112233", profile: { name: "Mehmet" } },
                  ],
                  messages: [
                    {
                      id: "wamid.1",
                      from: "905551112233",
                      type: "text",
                      text: { body: "Nereden: Mersin" },
                    },
                    {
                      id: "wamid.2",
                      from: "905551112233",
                      type: "image",
                      image: { id: "media-1" },
                    },
                  ],
                },
              },
              {
                value: {
                  metadata: { phone_number_id: "another-phone" },
                  messages: [
                    {
                      id: "wamid.3",
                      from: "905551112233",
                      type: "text",
                      text: { body: "ignored" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      "phone-1",
    );

    expect(result).toEqual([
      {
        providerMessageId: "wamid.1",
        senderPhone: "905551112233",
        profileName: "Mehmet",
        text: "Nereden: Mersin",
      },
    ]);
  });
});
