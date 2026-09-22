import { Router } from "express";
import { getConstructionCatalog } from "../lib/shopifyStorefrontClient";

const router = Router();

router.get("/storefront/construction/catalog", async (_req, res) => {
  try {
    res.json(await getConstructionCatalog());
  } catch (error) {
    console.error("Shopify construction catalog unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      error:
        "Shopify kataloğu şu anda okunamıyor. Mağaza bağlantısını ve Shopify erişimini kontrol edin.",
    });
  }
});

export default router;