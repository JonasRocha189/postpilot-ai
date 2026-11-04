import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Unit and integration tests (Vitest + Testing Library). The E2E tests
// (Playwright) live in /e2e. See _docs/testes.md.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      // The services call the "real" API (http mode); MSW answers it
      // (src/test/fakeApi.ts). No Auth0: the API client sends no token.
      env: {
        VITE_API_URL: "http://api.test",
        VITE_AUTH0_DOMAIN: "",
        VITE_AUTH0_CLIENT_ID: "",
      },
      restoreMocks: true,
      // Long form flows (typing, dialogs, uploads) can pass the 5 s default
      // when all files run in parallel
      testTimeout: 15_000,
    },
  }),
);
