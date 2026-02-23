import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    fs: {
      allow: ["./client", "./shared", "."],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
    chunkSizeWarningLimit: 600,
    sourcemap: false, // Disable sourcemaps to reduce build memory usage
    minify: true, // Use default esbuild minifier (more memory efficient)
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split heavy vendor libraries into separate chunks for better caching and reduced initial load
          if (id.includes("node_modules")) {
            if (id.includes("recharts")) {
              return "recharts";
            }
            if (id.includes("@radix-ui")) {
              return "radix-ui";
            }
            if (id.includes("react-router-dom")) {
              return "router";
            }
            if (id.includes("react") && !id.includes("@")) {
              return "react";
            }
            if (
              id.includes("@tanstack/react-query") ||
              id.includes("zustand")
            ) {
              return "state";
            }
          }
        },
      },
    },
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      // Lazy import to avoid loading server code during build
      const { createServer } = await import("./server");
      const app = createServer();

      server.middlewares.use(app);
    },
  };
}
