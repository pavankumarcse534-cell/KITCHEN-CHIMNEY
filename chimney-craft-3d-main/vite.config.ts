import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true, // Allow access from network (0.0.0.0)
    port: 5173,
    strictPort: false, // Allow Vite to find another port if 5173 is busy
    open: false, // Don't auto-open browser
    hmr: {
      host: 'localhost', // HMR host for better compatibility
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      three: "three",
    },
    dedupe: ["three"],
  },
}));
