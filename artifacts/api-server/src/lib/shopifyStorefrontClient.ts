// Buyer requests go directly to the Shopify Storefront API, never the Admin proxy.
const API_VERSION = "2026-04";
const TIMEOUT_MS = 10000;
let configCache: { domain: string; token: string; expires: number } | undefined;

export class CheckoutNotReadyError extends Error {}
// An operator attestation is required AFTER confirming Shopify-side test gateway
// activation or real live payment/shipping readiness. These env vars do not
// themselves change any merchant setting in Shopify.
export async function verifiedCheckoutDomain() {
  const mode = process.env.SHOPIFY_CHECKOUT_MODE;
  const domain = process.env.SHOPIFY_CHECKOUT_VERIFIED_SHOP_DOMAIN;
  const attestedAt = process.env.SHOPIFY_CHECKOUT_MERCHANT_VERIFIED_AT;
  if ((mode !== "test" && mode !== "live") ||
      process.env.SHOPIFY_CHECKOUT_MERCHANT_VERIFIED !== "true" ||
      !domain || !attestedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(attestedAt)) {
    throw new CheckoutNotReadyError("Shopify merchant checkout readiness has not been verified");
  }
  const age = Date.now() - Date.parse(attestedAt);
  if (!Number.isFinite(age) || age < 0 || age > 30 * 24 * 60 * 60 * 1000) {
    throw new CheckoutNotReadyError("Shopify checkout verification expired or invalid");
  }
  const connected = await config();
  if (domain !== connected.domain) {
    throw new CheckoutNotReadyError("Checkout verification does not match connected Shopify shop");
  }
  return connected.domain;
}

async function config(refresh = false) {
  if (!refresh && configCache && configCache.expires > Date.now()) return configCache;
  const host = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const identity = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!host || !identity) throw new Error("Shopify connector environment is unavailable");
  const url = new URL(`${host.startsWith("localhost") ? "http" : "https"}://${host}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "shopify-store");
  url.searchParams.set("refresh_policy", "none");
  const response = await fetch(url, {
    headers: { Accept: "application/json", X_REPLIT_TOKEN: identity },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Shopify connector returned ${response.status}`);
  const payload = await response.json() as {
    items?: Array<{ settings?: { shop_domain?: string; storefront_access_token?: string } }>;
  };
  const settings = payload.items?.[0]?.settings;
  if (!settings?.shop_domain || !settings.storefront_access_token ||
      !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(settings.shop_domain)) {
    throw new Error("Shopify Storefront connection settings missing or invalid");
  }
  configCache = { domain: settings.shop_domain, token: settings.storefront_access_token, expires: Date.now() + 60000 };
  return configCache;
}

export async function shopifyStorefrontRequest<T>(query: string, variables: Record<string, unknown> = {}, retry = true): Promise<T> {
  const { domain, token } = await config();
  const response = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (retry && (response.status === 401 || response.status === 403)) {
    configCache = undefined;
    await config(true);
    return shopifyStorefrontRequest<T>(query, variables, false);
  }
  const payload = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || payload.errors?.length || !payload.data) {
    // Avoid echoing upstream response: it may contain sensitive request context.
    throw new Error(`Shopify Storefront API failed (${response.status})`);
  }
  return payload.data;
}

type Money = { amount: string; currencyCode: string };
type Collection = { id: string; title: string; handle: string };
type Variant = { id: string; title: string; availableForSale: boolean; quantityAvailable: number | null; price: Money; product?: { tags: string[] } };
type Product = {
  id: string; title: string; handle: string; description: string; productType: string; vendor: string;
  tags: string[]; featuredImage: { url: string; altText: string | null } | null;
  collections: { nodes: Collection[] };
  variants: { nodes: Variant[]; pageInfo: { hasNextPage: boolean } };
};
const PRODUCT_FIELDS = `id title handle description productType vendor tags featuredImage { url altText }
  collections(first: 100) { nodes { id title handle } }
  variants(first: 100) { nodes { id title availableForSale quantityAvailable price { amount currencyCode } } pageInfo { hasNextPage } }`;
const quoteTag = (tags: string[]) => tags.some(tag => tag.toLowerCase() === "quote-only");
export function isQuoteRequired(variant: Pick<Variant, "price">, tags: string[]) {
  return quoteTag(tags) || !Number.isFinite(Number(variant.price.amount)) || Number(variant.price.amount) <= 0;
}
function mapProduct(product: Product) {
  if (product.variants.pageInfo.hasNextPage) throw new Error("Product exceeds supported variant page size");
  const variants = product.variants.nodes.map(v => ({
    id: v.id, title: v.title, price: v.price.amount, currency: v.price.currencyCode,
    inventoryQuantity: v.quantityAvailable, availableForSale: v.availableForSale,
    quoteRequired: isQuoteRequired(v, product.tags),
  }));
  const priced = variants.filter(v => !v.quoteRequired).sort((a, b) => Number(a.price) - Number(b.price));
  return {
    id: product.id, title: product.title, handle: product.handle, description: product.description,
    category: product.productType || "other", vendor: product.vendor,
    imageUrl: product.featuredImage?.url ?? null, imageAlt: product.featuredImage?.altText ?? null,
    price: priced[0]?.price ?? null, currency: priced[0]?.currency ?? null,
    inventory: variants.every(v => v.inventoryQuantity !== null) ? variants.reduce((n, v) => n + (v.inventoryQuantity ?? 0), 0) : null,
    variants, collections: product.collections.nodes, quoteRequired: quoteTag(product.tags) || !priced.length,
  };
}
const catalogCache = new Map<string, { expires: number; value: Awaited<ReturnType<typeof loadCatalog>> }>();
async function loadCatalog(first: number, after?: string) {
  const data = await shopifyStorefrontRequest<{
    shop: { name: string };
    products: { nodes: Product[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
    collections: { nodes: Collection[]; pageInfo: { hasNextPage: boolean } };
  }>(`query ConstructionCatalog($first: Int!, $after: String) {
    shop { name }
    products(first: $first, after: $after) { nodes { ${PRODUCT_FIELDS} } pageInfo { hasNextPage endCursor } }
    collections(first: 100) { nodes { id title handle } pageInfo { hasNextPage } }
  }`, { first, after: after ?? null });
  if (data.collections.pageInfo.hasNextPage) throw new Error("Shop collections exceed supported page size");
  return {
    connected: true as const, shopName: data.shop.name, fetchedAt: new Date().toISOString(),
    products: data.products.nodes.map(mapProduct), collections: data.collections.nodes,
    pageInfo: data.products.pageInfo,
  };
}
export async function getConstructionCatalog(first = 20, after?: string) {
  const key = JSON.stringify([first, after]);
  const cached = catalogCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await loadCatalog(first, after);
  if (catalogCache.size > 50) catalogCache.clear();
  catalogCache.set(key, { expires: Date.now() + 60000, value });
  return value;
}
export async function getConstructionProduct(handle: string) {
  const data = await shopifyStorefrontRequest<{ productByHandle: Product | null }>(
    `query ConstructionProduct($handle: String!) { productByHandle(handle: $handle) { ${PRODUCT_FIELDS} } }`, { handle },
  );
  return data.productByHandle ? mapProduct(data.productByHandle) : null;
}

const CART_FIELDS = `id cost { totalAmount { amount currencyCode } }
  lines(first: 100) { nodes { id quantity merchandise {
    ... on ProductVariant { id title product { title } price { amount currencyCode } }
  } } pageInfo { hasNextPage } }`;
type Cart = {
  id: string; cost: { totalAmount: Money };
  lines: { nodes: Array<{ id: string; quantity: number; merchandise: { id: string; title: string; product: { title: string }; price: Money } }>; pageInfo: { hasNextPage: boolean } };
};
function mapCart(cart: Cart) {
  if (cart.lines.pageInfo.hasNextPage) throw new Error("Cart exceeds supported line page size");
  return {
    id: cart.id, totalAmount: cart.cost.totalAmount.amount, currency: cart.cost.totalAmount.currencyCode,
    lines: cart.lines.nodes.map(line => ({
      id: line.id, variantId: line.merchandise.id, quantity: line.quantity,
      title: `${line.merchandise.product.title}${line.merchandise.title === "Default Title" ? "" : ` — ${line.merchandise.title}`}`,
      price: line.merchandise.price.amount, currency: line.merchandise.price.currencyCode,
    })),
  };
}
export async function getConstructionCart(id: string) {
  const data = await shopifyStorefrontRequest<{ cart: Cart | null }>(
    `query ConstructionCart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`, { id });
  return data.cart ? mapCart(data.cart) : null;
}
export class CartValidationError extends Error {}
export async function validateVariant(variantId: string, quantity: number) {
  const data = await shopifyStorefrontRequest<{ node: (Variant & { product: { tags: string[] } }) | null }>(
    `query CartVariant($id: ID!) { node(id: $id) { ... on ProductVariant {
      id availableForSale quantityAvailable price { amount currencyCode } product { tags }
    } } }`, { id: variantId },
  );
  const variant = data.node;
  if (!variant || variant.id !== variantId || !variant.availableForSale || isQuoteRequired(variant, variant.product.tags))
    throw new CartValidationError("Variant unavailable or requires a quote");
  if (variant.quantityAvailable !== null && variant.quantityAvailable < quantity)
    throw new CartValidationError("Requested quantity exceeds available stock");
}
async function mutateCart(field: string, query: string, variables: Record<string, unknown>) {
  const data = await shopifyStorefrontRequest<Record<string, { cart: Cart | null; userErrors: Array<{ message: string }> }>>(query, variables);
  const result = data[field];
  if (result.userErrors.length || !result.cart)
    throw new CartValidationError(result.userErrors.map(e => e.message).join("; ") || "Cart unavailable");
  return mapCart(result.cart);
}
export async function createConstructionCart(variantId: string, quantity: number) {
  await validateVariant(variantId, quantity);
  return mutateCart("cartCreate", `mutation($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) { cart { ${CART_FIELDS} } userErrors { message } }
  }`, { lines: [{ merchandiseId: variantId, quantity }] });
}
export async function addConstructionCartLine(cartId: string, variantId: string, quantity: number) {
  const cart = await getConstructionCart(cartId);
  if (!cart) throw new CartValidationError("Cart not found");
  const current = cart.lines.filter(line => line.variantId === variantId).reduce((n, line) => n + line.quantity, 0);
  await validateVariant(variantId, current + quantity);
  return mutateCart("cartLinesAdd", `mutation($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message } }
  }`, { cartId, lines: [{ merchandiseId: variantId, quantity }] });
}
export async function updateConstructionCartLine(cartId: string, lineId: string, quantity: number) {
  const cart = await getConstructionCart(cartId);
  const line = cart?.lines.find(line => line.id === lineId);
  if (!line) throw new CartValidationError("Cart line not found");
  const others = cart!.lines.filter(item => item.id !== lineId && item.variantId === line.variantId).reduce((n, item) => n + item.quantity, 0);
  await validateVariant(line.variantId, quantity + others);
  return mutateCart("cartLinesUpdate", `mutation($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message } }
  }`, { cartId, lines: [{ id: lineId, quantity }] });
}
export async function removeConstructionCartLine(cartId: string, lineId: string) {
  const cart = await getConstructionCart(cartId);
  if (!cart?.lines.some(line => line.id === lineId)) throw new CartValidationError("Cart line not found");
  return mutateCart("cartLinesRemove", `mutation($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } userErrors { message } }
  }`, { cartId, lineIds: [lineId] });
}

export async function checkoutConstructionCart(cartId: string) {
  const domain = await verifiedCheckoutDomain();
  // Fresh read, not cached catalog/cart data. Do not return a checkout URL for
  // an empty cart, a stale variant, an oversold variant, or quote-only goods.
  const data = await shopifyStorefrontRequest<{ cart: {
    lines: { nodes: Array<{ quantity: number; merchandise: (Variant & { product: { tags: string[] } }) | null }>; pageInfo: { hasNextPage: boolean } };
  } | null }>(`query CheckoutEligibility($id: ID!) { cart(id: $id) {
    lines(first: 100) { nodes { quantity merchandise {
      ... on ProductVariant { id availableForSale quantityAvailable price { amount currencyCode } product { tags } }
    } } pageInfo { hasNextPage } }
  } }`, { id: cartId });
  const cart = data.cart;
  if (!cart || cart.lines.pageInfo.hasNextPage || cart.lines.nodes.length === 0)
    throw new CartValidationError("Cart empty, unavailable or too large for checkout");
  const requested = new Map<string, number>();
  for (const line of cart.lines.nodes) {
    const variant = line.merchandise;
    if (!variant?.id || !Number.isInteger(line.quantity) || line.quantity < 1 ||
        !variant.availableForSale || !Array.isArray(variant.product?.tags) ||
        isQuoteRequired(variant, variant.product.tags))
      throw new CartValidationError("Cart contains an unavailable or quote-only item");
    requested.set(variant.id, (requested.get(variant.id) ?? 0) + line.quantity);
    if (variant.quantityAvailable !== null && requested.get(variant.id)! > variant.quantityAvailable)
      throw new CartValidationError("Cart quantity exceeds available stock");
  }
  // Keep this field out of all catalog, cart, and eligibility queries.
  const checkout = await shopifyStorefrontRequest<{ cart: { checkoutUrl: string } | null }>(
    `query HostedCheckout($id: ID!) { cart(id: $id) { checkoutUrl } }`, { id: cartId });
  if (!checkout.cart?.checkoutUrl) throw new CheckoutNotReadyError("Shopify checkout URL unavailable");
  let url: URL;
  try { url = new URL(checkout.cart.checkoutUrl); }
  catch { throw new CheckoutNotReadyError("Invalid Shopify checkout URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      (url.hostname !== domain && url.hostname !== "checkout.shopify.com") ||
      !/^\/(?:checkouts?(?:\/|$)|cart\/c\/[^/]+$)/.test(url.pathname)) {
    throw new CheckoutNotReadyError("Untrusted Shopify checkout URL");
  }
  return { checkoutUrl: url.toString() };
}