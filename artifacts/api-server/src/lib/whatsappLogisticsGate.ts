export type WhatsAppLogisticsGate = {
  intakeEnabled: boolean;
  autoReplyEnabled: boolean;
  createRealRequests: boolean;
};

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

/**
 * All external or real-world behavior is opt-in. The intake flag is the
 * parent gate; child flags cannot activate on their own.
 */
export function getWhatsAppLogisticsGate(
  env: Record<string, string | undefined> = process.env,
): WhatsAppLogisticsGate {
  const intakeEnabled = isExplicitlyEnabled(env.WHATSAPP_LOGISTICS_INTAKE_ENABLED);
  return {
    intakeEnabled,
    autoReplyEnabled: intakeEnabled && isExplicitlyEnabled(env.WHATSAPP_LOGISTICS_AUTO_REPLY_ENABLED),
    createRealRequests: intakeEnabled && isExplicitlyEnabled(env.WHATSAPP_LOGISTICS_CREATE_REAL_REQUESTS_ENABLED),
  };
}
