import path from "node:path";
import fs from "node:fs";
import express from "express";
import { createServer } from "./index";

const app = createServer();
const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

// In production, serve the built SPA files
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");
const indexHtmlPath = path.join(distPath, "index.html");

// Verify dist path exists
console.log(`📁 Static files path: ${distPath}`);
console.log(`📄 Index HTML path: ${indexHtmlPath}`);
console.log(`✓ Index HTML exists: ${fs.existsSync(indexHtmlPath)}`);

// Serve static files
app.use(
  express.static(distPath, {
    maxAge: "1d",
    etag: false,
  }),
);

// Handle React Router - serve index.html for all non-API routes
app.use((req, res, next) => {
  if (
    req.path === "/api" ||
    req.path.startsWith("/api/") ||
    req.path.startsWith("/health")
  ) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  if (req.method.toUpperCase() !== "GET") {
    return next();
  }

  try {
    res.sendFile(indexHtmlPath);
  } catch (err) {
    console.error(`Error serving index.html for ${req.path}:`, err);
    return next(err);
  }
});

app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});

// Memory management
if (process.env.NODE_ENV === "production") {
  const memoryThreshold = 100 * 1024 * 1024; // 100MB warning threshold
  setInterval(() => {
    const used = process.memoryUsage();
    const heapUsed = Math.round((used.heapUsed / 1024 / 1024) * 100) / 100;
    const heapTotal = Math.round((used.heapTotal / 1024 / 1024) * 100) / 100;
    if (used.heapUsed > memoryThreshold) {
      console.warn(`⚠️  Heap usage high: ${heapUsed}MB / ${heapTotal}MB`);
    }
  }, 30000); // Check every 30 seconds
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
