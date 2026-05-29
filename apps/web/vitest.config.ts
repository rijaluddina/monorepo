import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Ensure test environment so React loads CJS development bundle (which exports `act`)
// Without this, Bun's vitest doesn't set NODE_ENV, causing React to load the
// production bundle where `React.act` is undefined — breaking @testing-library/react.
process.env.NODE_ENV = "test";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
