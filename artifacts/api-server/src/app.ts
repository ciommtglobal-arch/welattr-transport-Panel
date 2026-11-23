import express, { type Express } from "express";
import cors from "cors";
import { isCorsOriginAllowed, parseCorsAllowedOrigins } from "./lib/corsOriginPolicy";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import kasaRouter from "./routes/kasa";
import { logger } from "./lib/logger";
import { createShopifyLogisticsRawParser } from "./lib/nexusLogisticsShopify";
import { createMmtTestRawParser, requireMmtTestEnvironment } from "./lib/mmtTestIntegration";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
const allowedCorsOrigins = parseCorsAllowedOrigins(process.env.MMT_CORS_ALLOWED_ORIGINS);
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    callback(null, isCorsOriginAllowed(origin, allowedCorsOrigins));
  },
}));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use(
  "/api/webhook/whatsapp",
  express.raw({ type: "application/json", limit: "256kb" }),
);
app.use("/api/webhook/shopify/nexus", express.raw({ type: "application/json", limit: "1mb" }));
app.use("/api/webhook/email", express.raw({ type: "application/json", limit: "256kb" }));
app.use("/api/mmt/secure-sync", createShopifyLogisticsRawParser());
app.use("/api/mmt/test-integration", requireMmtTestEnvironment, createMmtTestRawParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
// Standalone Kasa browser calls preserve their artifact prefix.
app.use("/kasa/api", kasaRouter);

export default app;
