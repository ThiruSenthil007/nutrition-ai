import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";

const app = express();

// CORS & Preflight
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-trpc-source");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// JSON Body Parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health Check
app.get(["/api", "/api/health", "/health"], (_req: Request, res: Response) => {
  res.json({ status: "ok", name: "NutriAI API", timestamp: new Date().toISOString() });
});

// Storage and OAuth proxies
registerStorageProxy(app);
registerOAuthRoutes(app);

// tRPC Middleware for both /api/trpc and /trpc
app.use(
  ["/api/trpc", "/trpc"],
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Fallback 404 for unhandled API routes (always return JSON, never HTML)
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found", path: req.url });
});

// Global Error Handler (always return JSON, never HTML)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[API Error]", err);
  const status = typeof err?.status === "number" ? err.status : 500;
  res.status(status).json({
    error: err?.message || "Internal Server Error",
    code: err?.code || "INTERNAL_ERROR",
  });
});

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
