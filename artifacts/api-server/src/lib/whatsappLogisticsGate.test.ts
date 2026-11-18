import { describe, expect, it } from "vitest";
import { getWhatsAppLogisticsGate } from "./whatsappLogisticsGate";

describe("WhatsApp logistics gates", () => {
  it("keeps intake, external replies, and real requests disabled by default", () => {
    expect(getWhatsAppLogisticsGate({})).toEqual({
      intakeEnabled: false,
      autoReplyEnabled: false,
      createRealRequests: false,
    });
  });

  it("does not let child switches bypass the closed intake gate", () => {
    expect(getWhatsAppLogisticsGate({
      WHATSAPP_LOGISTICS_AUTO_REPLY_ENABLED: "true",
      WHATSAPP_LOGISTICS_CREATE_REAL_REQUESTS_ENABLED: "true",
    })).toEqual({
      intakeEnabled: false,
      autoReplyEnabled: false,
      createRealRequests: false,
    });
  });

  it("enables each behavior only with its own explicit switch", () => {
    expect(getWhatsAppLogisticsGate({
      WHATSAPP_LOGISTICS_INTAKE_ENABLED: "true",
    })).toEqual({
      intakeEnabled: true,
      autoReplyEnabled: false,
      createRealRequests: false,
    });
    expect(getWhatsAppLogisticsGate({
      WHATSAPP_LOGISTICS_INTAKE_ENABLED: "true",
      WHATSAPP_LOGISTICS_AUTO_REPLY_ENABLED: "true",
    })).toEqual({
      intakeEnabled: true,
      autoReplyEnabled: true,
      createRealRequests: false,
    });
    expect(getWhatsAppLogisticsGate({
      WHATSAPP_LOGISTICS_INTAKE_ENABLED: "true",
      WHATSAPP_LOGISTICS_CREATE_REAL_REQUESTS_ENABLED: "true",
    })).toEqual({
      intakeEnabled: true,
      autoReplyEnabled: false,
      createRealRequests: true,
    });
  });

  it("does not treat non-true values as authorization", () => {
    expect(getWhatsAppLogisticsGate({
      WHATSAPP_LOGISTICS_INTAKE_ENABLED: "1",
      WHATSAPP_LOGISTICS_AUTO_REPLY_ENABLED: "yes",
      WHATSAPP_LOGISTICS_CREATE_REAL_REQUESTS_ENABLED: "on",
    })).toEqual({
      intakeEnabled: false,
      autoReplyEnabled: false,
      createRealRequests: false,
    });
  });
});
