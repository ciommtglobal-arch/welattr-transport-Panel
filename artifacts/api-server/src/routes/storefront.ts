import { Router, type Request, type Response } from "express";
import {
  GetConstructionCatalogQueryParams, CreateConstructionCartBody, AddConstructionCartLineBody,
  UpdateConstructionCartLineBody, RemoveConstructionCartLineBody, CreateConstructionQuoteBody,
  UpdateConstructionQuoteStatusBody,
} from "@workspace/api-zod";
import { constructionQuotesTable, db, type ConstructionQuote } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireOperationsStaff } from "../lib/staffAuth";
import {
  getConstructionCatalog, getConstructionProduct, getConstructionCart,
  createConstructionCart, addConstructionCartLine, updateConstructionCartLine,
  removeConstructionCartLine, checkoutConstructionCart, CartValidationError,
} from "../lib/shopifyStorefrontClient";

const router = Router();
const base = "/storefront/construction";
// Pause buyer-facing construction commerce without deleting catalog or quote records.
// Staff can still review and update quotes that were submitted before closure.
function storeClosed(_req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.status(503).json({ error: "Construction products store is closed" });
}
function param(req: Request, key: string) {
  const value = req.params[key];
  return typeof value === "string" ? value : "";
}
function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T } }, req: Request, res: Response): T | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !parsed.data) {
    res.status(400).json({ error: "Invalid request body" });
    return null;
  }
  return parsed.data;
}
function shopifyError(error: unknown, res: Response) {
  if (error instanceof CartValidationError) return res.status(400).json({ error: error.message });
  return res.status(503).json({ error: "Shopify storefront currently unavailable" });
}
function cartId(req: Request, res: Response) {
  const id = param(req, "cartId");
  if (!/^gid:\/\/shopify\/Cart\/[^\s]{1,512}$/.test(id)) {
    res.status(400).json({ error: "Invalid Shopify cart ID" });
    return null;
  }
  return id;
}
function variantId(value: string) {
  return /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(value);
}
function lineId(value: string) {
  return /^gid:\/\/shopify\/CartLine\/[^\s]{1,512}$/.test(value);
}
router.get(`${base}/catalog`, storeClosed, async (req, res) => {
  const parsed = GetConstructionCatalogQueryParams.safeParse(req.query);
  if (!parsed.success || (parsed.data.after && parsed.data.after.length > 1024)) {
    res.status(400).json({ error: "Invalid catalog pagination" });
    return;
  }
  try {
    res.json(await getConstructionCatalog(parsed.data.first, parsed.data.after));
  } catch (error) { shopifyError(error, res); }
});
router.get(`${base}/products/:handle`, storeClosed, async (req, res) => {
  const handle = param(req, "handle");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,255}$/.test(handle)) {
    res.status(400).json({ error: "Invalid product handle" }); return;
  }
  try {
    const product = await getConstructionProduct(handle);
    if (!product) res.status(404).json({ error: "Product not found" });
    else res.json(product);
  } catch (error) { shopifyError(error, res); }
});
router.post(`${base}/cart`, storeClosed, async (req, res) => {
  const body = parseBody(CreateConstructionCartBody, req, res);
  if (!body) return;
  if (!variantId(body.variantId)) { res.status(400).json({ error: "Invalid Shopify variant ID" }); return; }
  try { res.status(201).json(await createConstructionCart(body.variantId, body.quantity)); }
  catch (error) { shopifyError(error, res); }
});
router.get(`${base}/cart/:cartId`, storeClosed, async (req, res) => {
  const id = cartId(req, res);
  if (!id) return;
  try {
    const cart = await getConstructionCart(id);
    if (!cart) res.status(404).json({ error: "Cart not found" });
    else res.json(cart);
  } catch (error) { shopifyError(error, res); }
});
router.post(`${base}/cart/:cartId/lines`, storeClosed, async (req, res) => {
  const id = cartId(req, res);
  if (!id) return;
  const body = parseBody(AddConstructionCartLineBody, req, res);
  if (!body) return;
  if (!variantId(body.variantId)) { res.status(400).json({ error: "Invalid Shopify variant ID" }); return; }
  try { res.json(await addConstructionCartLine(id, body.variantId, body.quantity)); }
  catch (error) { shopifyError(error, res); }
});
router.patch(`${base}/cart/:cartId/lines`, storeClosed, async (req, res) => {
  const id = cartId(req, res);
  if (!id) return;
  const body = parseBody(UpdateConstructionCartLineBody, req, res);
  if (!body) return;
  if (!lineId(body.lineId)) { res.status(400).json({ error: "Invalid Shopify cart line ID" }); return; }
  try { res.json(await updateConstructionCartLine(id, body.lineId, body.quantity)); }
  catch (error) { shopifyError(error, res); }
});
router.delete(`${base}/cart/:cartId/lines`, storeClosed, async (req, res) => {
  const id = cartId(req, res);
  if (!id) return;
  const body = parseBody(RemoveConstructionCartLineBody, req, res);
  if (!body) return;
  if (!lineId(body.lineId)) { res.status(400).json({ error: "Invalid Shopify cart line ID" }); return; }
  try { res.json(await removeConstructionCartLine(id, body.lineId)); }
  catch (error) { shopifyError(error, res); }
});
router.post(`${base}/cart/:cartId/checkout`, storeClosed, async (req, res) => {
  const id = param(req, "cartId");
  if (!/^gid:\/\/shopify\/Cart\/[^\s]{1,512}$/.test(id)) {
    res.status(503).json({ error: "Shopify hosted checkout unavailable" }); return;
  }
  try { res.json(await checkoutConstructionCart(id)); }
  catch { res.status(503).json({ error: "Shopify hosted checkout unavailable or merchant readiness unverified" }); }
});

function serializeQuote(quote: ConstructionQuote) {
  return {
    id: quote.id, reference: quote.reference, status: quote.status,
    quantity: quote.quantity, dimensions: quote.dimensions, deliveryLocation: quote.deliveryLocation,
    contactName: quote.contactName, contactEmail: quote.contactEmail, contactPhone: quote.contactPhone,
    ...(quote.productId ? { productId: quote.productId } : {}),
    ...(quote.variantId ? { variantId: quote.variantId } : {}),
    ...(quote.notes ? { notes: quote.notes } : {}),
    createdAt: quote.createdAt.toISOString(),
  };
}
const quoteAttempts = new Map<string, { count: number; resets: number }>();
function quoteRateLimited(ip: string) {
  const now = Date.now();
  if (quoteAttempts.size > 5000) {
    for (const [key, value] of quoteAttempts) if (value.resets <= now) quoteAttempts.delete(key);
  }
  const current = quoteAttempts.get(ip);
  if (!current || current.resets <= now) {
    quoteAttempts.set(ip, { count: 1, resets: now + 15 * 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 5;
}
router.post(`${base}/quotes`, storeClosed, async (req, res) => {
  const input = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? Object.fromEntries(Object.entries(req.body).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]))
    : req.body;
  const parsed = CreateConstructionQuoteBody.safeParse(input);
  if (!parsed.success) { res.status(400).json({ error: "Invalid quote details" }); return; }
  const body = parsed.data;
  if (body.website?.trim()) { res.status(400).json({ error: "Invalid quote details" }); return; }
  if (quoteRateLimited(req.ip ?? "unknown")) {
    res.setHeader("Retry-After", "900").status(429).json({ error: "Too many quote requests; try again later" }); return;
  }
  const normalized = {
    quantity: body.quantity,
    dimensions: body.dimensions.trim(), deliveryLocation: body.deliveryLocation.trim(),
    contactName: body.contactName.trim(), contactEmail: body.contactEmail.trim().toLowerCase(),
    contactPhone: body.contactPhone.trim(), productId: body.productId?.trim() || null,
    variantId: body.variantId?.trim() || null, notes: body.notes?.trim() || null,
  };
  if ((normalized.productId && !/^gid:\/\/shopify\/Product\/\d+$/.test(normalized.productId)) ||
      (normalized.variantId && !variantId(normalized.variantId)) ||
      ![normalized.dimensions, normalized.deliveryLocation, normalized.contactName, normalized.contactPhone].every(Boolean)) {
    res.status(400).json({ error: "Invalid quote details" }); return;
  }
  try {
    const [quote] = await db.insert(constructionQuotesTable).values({
      ...normalized, reference: `INS-${new Date().getUTCFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`,
    }).returning();
    // Public response contains only a receipt. Contact PII is staff-only.
    res.status(201).json({
      id: quote.id, reference: quote.reference, status: quote.status, createdAt: quote.createdAt.toISOString(),
    });
  } catch {
    res.status(503).json({ error: "Quote could not be saved" });
  }
});
router.get(`${base}/quotes/staff`, async (req, res) => {
  if (!await requireOperationsStaff(req, res)) return;
  try {
    const quotes = await db.select().from(constructionQuotesTable).orderBy(desc(constructionQuotesTable.createdAt)).limit(100);
    res.json(quotes.map(serializeQuote));
  } catch { res.status(503).json({ error: "Quotes could not be loaded" }); }
});
router.patch(`${base}/quotes/staff/:id/status`, async (req, res) => {
  if (!await requireOperationsStaff(req, res)) return;
  const id = Number(param(req, "id"));
  const body = parseBody(UpdateConstructionQuoteStatusBody, req, res);
  if (!body) return;
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid quote ID" }); return; }
  try {
    const [quote] = await db.update(constructionQuotesTable).set({ status: body.status })
      .where(eq(constructionQuotesTable.id, id)).returning();
    if (!quote) res.status(404).json({ error: "Quote not found" });
    else res.json(serializeQuote(quote));
  } catch { res.status(503).json({ error: "Quote could not be updated" }); }
});
export default router;