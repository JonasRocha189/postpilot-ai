import "@testing-library/jest-dom/vitest";
import i18n from "@/i18n";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { fakeApi, server } from "./fakeApi";

// The first render in each file is slower (module transforms, files run in
// parallel): give findBy*/waitFor more than the default 1 s
configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  // Any request without a handler fails the test (no real network)
  server.listen({ onUnhandledFrame: "error" });
  await i18n.changeLanguage("pt-BR");
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  fakeApi.reset();
  localStorage.clear();
});

afterAll(() => server.close());
