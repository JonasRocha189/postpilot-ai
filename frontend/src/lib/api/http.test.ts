import { API, server } from "@/test/fakeApi";
import { http, HttpResponse } from "msw/http";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError, apiFetch, apiMode, setTokenGetter } from "./http";

afterEach(() => setTokenGetter(null));

describe("apiFetch", () => {
  it("runs in http mode in the tests (VITE_API_URL is set)", () => {
    expect(apiMode).toBe("http");
  });

  it("returns the JSON body", async () => {
    server.use(http.get(`${API}/ping`, () => HttpResponse.json({ ok: true })));
    await expect(apiFetch("/ping")).resolves.toEqual({ ok: true });
  });

  it("returns undefined for 204 No Content", async () => {
    server.use(
      http.delete(`${API}/ping`, () => new HttpResponse(null, { status: 204 })),
    );
    await expect(
      apiFetch("/ping", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  it("throws ApiError with the status and FastAPI's detail", async () => {
    server.use(
      http.delete(`${API}/ping`, () =>
        HttpResponse.json({ detail: "Project has subjects" }, { status: 409 }),
      ),
    );
    const error = await apiFetch("/ping", { method: "DELETE" }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "Project has subjects",
    });
  });

  it("falls back to the status text when detail is not a string (422 list)", async () => {
    server.use(
      http.post(`${API}/ping`, () =>
        HttpResponse.json(
          { detail: [{ loc: ["body", "name"], msg: "Field required" }] },
          { status: 422, statusText: "Unprocessable Entity" },
        ),
      ),
    );
    await expect(apiFetch("/ping", { method: "POST" })).rejects.toMatchObject({
      status: 422,
      message: "Unprocessable Entity",
    });
  });

  it("sends the Auth0 access token as a Bearer header", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(`${API}/ping`, ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({});
      }),
    );
    setTokenGetter(async () => "token-123");
    await apiFetch("/ping");
    expect(authorization).toBe("Bearer token-123");
  });

  it("sends no Authorization header without a session", async () => {
    let authorization: string | null = "unset";
    server.use(
      http.get(`${API}/ping`, ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({});
      }),
    );
    await apiFetch("/ping");
    expect(authorization).toBeNull();
  });
});
