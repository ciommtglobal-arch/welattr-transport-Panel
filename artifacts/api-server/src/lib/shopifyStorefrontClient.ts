import { ReplitConnectors } from "@replit/connectors-sdk";

const SHOPIFY_API_VERSION = "2025-10";
const CATALOG_CACHE_TTL_MS = 60_000;

type ShopifyImage = {
  url: string;
  altText: string | null;
};

type ShopifyVariant = {
  id: string;
  title: string;
  price: string;
  inventoryQuantity: number | null;
};

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  featuredImage: ShopifyImage | null;
  totalInventory: number | null;
  variants: { nodes: ShopifyVariant[] };
};

type ShopifyCatalogResponse = {
  shop: { name: string; myshopifyDomain: string };
  products: { nodes: ShopifyProduct[] };
  collections: { nodes: Array<{ id: string; title: string; handle: string }> };
};

export type ConstructionCatalog = {
  connected: true;
  shopName: string;
  fetchedAt: string;
  products: Array<{
    id: string;
    title: string;
    handle: string;
    description: string;
    category: string;
    vendor: string;
    imageUrl: string | null;
    imageAlt: string | null;
    price: string | null;
    currency: string | null;
    inventory: number | null;
    variants: Array<{
      id: string;
      title: string;
      price: string;
      inventoryQuantity: number | null;
    }>;
  }>;
  collections: Array<{ id: string; title: string; handle: string }>;
};

let catalogCache: { expiresAt: number; value: ConstructionCatalog } | null =
  null;

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrice(variants: ShopifyVariant[]) {
  const prices = variants
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price));
  return prices.length ? Math.min(...prices).toFixed(2) : null;
}

export async function getConstructionCatalog(): Promise<ConstructionCatalog> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.value;
  }

  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "shopify-store",
    `/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query ConstructionCatalog {
          shop { name myshopifyDomain }
          products(first: 100, query: "status:active") {
            nodes {
              id
              title
              handle
              descriptionHtml
              productType
              vendor
              featuredImage { url altText }
              totalInventory
              variants(first: 20) {
                nodes { id title price inventoryQuantity }
              }
            }
          }
          collections(first: 100) {
            nodes { id title handle }
          }
        }`,
      }),
    },
  );

  const payload = (await response.json()) as {
    data?: ShopifyCatalogResponse;
    errors?: Array<{ message: string }>;
  };
  if (!response.ok || payload.errors?.length || !payload.data) {
    throw new Error(
      payload.errors?.map((error) => error.message).join("; ") ??
        `Shopify katalogı ${response.status} döndürdü.`,
    );
  }

  const catalog: ConstructionCatalog = {
    connected: true,
    shopName: payload.data.shop.name,
    fetchedAt: new Date().toISOString(),
    products: payload.data.products.nodes.map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      description: stripHtml(product.descriptionHtml),
      category: product.productType || "other",
      vendor: product.vendor,
      imageUrl: product.featuredImage?.url ?? null,
      imageAlt: product.featuredImage?.altText ?? null,
      price: getPrice(product.variants.nodes),
      currency: null,
      inventory: product.totalInventory,
      variants: product.variants.nodes,
    })),
    collections: payload.data.collections.nodes,
  };

  catalogCache = {
    expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
    value: catalog,
  };
  return catalog;
}