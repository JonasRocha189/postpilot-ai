import type { AgentRun } from "@/features/agente/types";
import type { Post, PostVariation } from "@/features/posts/types";
import { describe, expect, it } from "vitest";
import {
  countByStatus,
  groupPerformance,
  latestRuns,
  localToday,
  timeBand,
  upcomingPosts,
} from "./aggregate";
import type { PostPerformance } from "./types";

const row = (data: Partial<PostPerformance> = {}): PostPerformance => ({
  variation_id: "v",
  post_id: "p",
  title: "Post",
  subject: "Cloud",
  network: "linkedin",
  published_at: "2026-11-03T12:00:00Z",
  weekday: 2,
  hour: 9,
  has_image: false,
  impressions: 1000,
  likes: 40,
  comments: 5,
  shares: 3,
  clicks: 2,
  ...data,
});

const variation = (data: Partial<PostVariation>): PostVariation => ({
  id: "v",
  network: "linkedin",
  format: "text",
  content: "Texto",
  status: "draft",
  expected_date: null,
  image_ids: [],
  ...data,
});

const post = (id: string, variations: Partial<PostVariation>[]): Post => ({
  id,
  subject_id: "s1",
  title: `Post ${id}`,
  variations: variations.map(variation),
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
});

describe("timeBand", () => {
  it("uses the same bands as the agent", () => {
    expect([0, 5, 6, 11, 12, 17, 18, 23].map(timeBand)).toEqual([
      "madrugada",
      "madrugada",
      "manha",
      "manha",
      "tarde",
      "tarde",
      "noite",
      "noite",
    ]);
  });
});

describe("groupPerformance", () => {
  it("sums each network in the app's order", () => {
    const { porRede } = groupPerformance([
      row({ network: "x", impressions: 500 }),
      row(),
      row({ likes: 60 }),
    ]);

    expect(porRede.map((r) => r.grupo)).toEqual(["linkedin", "x"]);
    expect(porRede[0]).toMatchObject({
      posts: 2,
      impressoes: 2000,
      curtidas: 100,
      comentarios: 10,
    });
  });

  it("groups by subject", () => {
    const { porAssunto } = groupPerformance([
      row({ subject: "Cloud" }),
      row({ subject: "Segurança" }),
      row({ subject: "Cloud" }),
    ]);

    expect(porAssunto).toEqual([
      expect.objectContaining({ grupo: "Cloud", posts: 2 }),
      expect.objectContaining({ grupo: "Segurança", posts: 1 }),
    ]);
  });

  it("maps ISO weekdays to the chart's (0 = Sunday) and hours to bands", () => {
    const { porDiaHorario } = groupPerformance([
      row({ weekday: 7, hour: 20 }), // Sunday evening
      row({ weekday: 1, hour: 3 }), // Monday, late night
      row({ weekday: 7, hour: 21 }),
    ]);

    expect(porDiaHorario).toEqual([
      expect.objectContaining({ dia: 0, faixa: "noite", posts: 2 }),
      expect.objectContaining({ dia: 1, faixa: "madrugada", posts: 1 }),
    ]);
  });
});

describe("countByStatus", () => {
  it("counts each network's variation", () => {
    expect(
      countByStatus([
        post("1", [{ status: "draft" }, { network: "x", status: "approved" }]),
        post("2", [{ status: "published" }]),
      ]),
    ).toEqual({ draft: 1, review: 0, approved: 1, published: 1 });
  });
});

describe("upcomingPosts", () => {
  const names = new Map([["s1", "Cloud"]]);

  it("lists pending posts from today on, nearest first", () => {
    const result = upcomingPosts(
      [
        post("late", [{ expected_date: "2026-11-20" }]),
        post("past", [{ expected_date: "2026-11-01" }]),
        post("done", [{ expected_date: "2026-11-12", status: "published" }]),
        post("soon", [
          { expected_date: "2026-11-15", status: "approved" },
          { network: "x", expected_date: "2026-11-10" },
        ]),
        post("undated", [{}]),
      ],
      names,
      "2026-11-10",
    );

    expect(result.map((p) => p.id)).toEqual(["soon", "late"]);
    expect(result[0]).toEqual({
      id: "soon",
      title: "Post soon",
      assunto: "Cloud",
      redes: ["linkedin", "x"],
      status: "draft",
      dataPrevista: "2026-11-10T00:00:00",
    });
  });

  it("shows at most five", () => {
    const posts = Array.from({ length: 8 }, (_, i) =>
      post(String(i), [{ expected_date: `2026-11-1${i}` }]),
    );
    expect(upcomingPosts(posts, names, "2026-11-01")).toHaveLength(5);
  });
});

describe("latestRuns", () => {
  it("keeps the five most recent with their step count", () => {
    const runs = Array.from({ length: 7 }, (_, i): AgentRun => ({
      id: `r${i}`,
      project_id: "p",
      mode: "ideation",
      request: "Temas",
      status: "completed",
      response: null,
      post_id: null,
      iterations: 1,
      steps: Array.from({ length: i }, (_, n) => ({
        id: `s${n}`,
        step_number: n + 1,
        tool: "search_web",
        arguments: {},
        result_summary: null,
        duration_ms: 10,
        error: null,
      })),
      started_at: "2026-11-03T12:00:00Z",
      finished_at: null,
    }));

    const result = latestRuns(runs);

    expect(result.map((r) => r.id)).toEqual(["r0", "r1", "r2", "r3", "r4"]);
    expect(result[2]).toMatchObject({
      steps: 2,
      iniciadaEm: runs[2].started_at,
    });
  });
});

describe("localToday", () => {
  it("formats the local date", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
