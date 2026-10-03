export type PaymentStatus = "pending" | "success" | "failed" | "cancelled";

export function resolveVerifiedPaymentStatus(
  current: PaymentStatus,
  incoming: PaymentStatus,
): PaymentStatus {
  if (current === "success") return "success";
  if (current !== "pending" && incoming === "pending") return current;
  return incoming;
}

export function amountToCents(value: string | number): bigint | null {
  const normalized = String(value);
  if (!/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function centsToAmount(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("90")) return digits;
  if (digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}

export function mapTamiPaymentStatus(
  payload: Record<string, unknown>,
): PaymentStatus {
  const fields = [payload.paymentStatus, payload.orderStatus, payload.status];
  const status = fields.find((value) => typeof value === "string");
  const normalized = typeof status === "string" ? status.trim().toUpperCase() : "";

  if (["CANCELLED", "CANCELED", "VOIDED", "ABORTED"].includes(normalized)) {
    return "cancelled";
  }
  if (["SUCCESS", "SUCCEEDED", "PAID", "CAPTURED", "APPROVED"].includes(normalized)) {
    return "success";
  }
  if (
    ["FAIL", "FAILED", "FAILURE", "ERROR", "DECLINED", "REJECTED", "TIME_OUT", "TIMEOUT"].includes(
      normalized,
    )
  ) {
    return "failed";
  }
  return "pending";
}

export function signedRefundOutcome(
  payload: Record<string, unknown>,
  expectedOrderId: string,
  expectedCents: bigint,
  expectedCurrency: string,
  expectedCorrelationId: string,
): "success" | "failed" | null {
  if (payload.orderId !== expectedOrderId) return null;
  if (payload.correlationId !== expectedCorrelationId) return null;
  if (
    typeof payload.currency !== "string" ||
    payload.currency.toUpperCase() !== expectedCurrency
  ) return null;
  const returnedCents = amountToCents(
    typeof payload.amount === "number" || typeof payload.amount === "string"
      ? payload.amount
      : "",
  );
  if (returnedCents === null || returnedCents !== expectedCents) return null;
  if (payload.success === true) return "success";
  if (payload.success === false) return "failed";
  return null;
}

export function hasSignedRefundTransaction(
  payload: Record<string, unknown>,
  orderId: string,
  amount: string,
  expectedRemainingAmount: string,
): boolean {
  const expectedCents = amountToCents(amount);
  const expectedRemainingCents = amountToCents(expectedRemainingAmount);
  const providerNetAmount = amountToCents(
    typeof payload.amount === "number" || typeof payload.amount === "string"
      ? payload.amount
      : "",
  );
  if (
    expectedCents === null ||
    expectedRemainingCents === null ||
    providerNetAmount !== expectedRemainingCents
  ) return false;
  const transactions = [
    payload.transactions,
    payload.transactionDetails,
    payload.transactionList,
  ].find(Array.isArray);
  if (!Array.isArray(transactions)) return false;

  return transactions.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const transaction = item as Record<string, unknown>;
    const operation = [
      transaction.transactionType,
      transaction.operation,
      transaction.type,
    ].find((value) => typeof value === "string");
    const operationName = typeof operation === "string" ? operation.toUpperCase() : "";
    if (!/REFUND|REVERSE|VOID/.test(operationName)) return false;
    const status = [
      transaction.transactionStatus,
      transaction.status,
      transaction.paymentStatus,
      transaction.result,
    ]
      .find((value) => typeof value === "string");
    if (typeof status !== "string" || !["SUCCESS", "SUCCEEDED", "APPROVED"].includes(status.toUpperCase())) {
      return false;
    }
    if (payload.orderId !== orderId) return false;
    const transactionOrderId = transaction.orderId ?? transaction.originalOrderId;
    if (transactionOrderId !== undefined && transactionOrderId !== orderId) return false;
    const transactionCents = amountToCents(
      typeof transaction.amount === "number" || typeof transaction.amount === "string"
        ? transaction.amount
        : "",
    );
    return transactionCents === expectedCents;
  });
}