import { describe, expect, it } from "vitest";
import {
  postFormSchema,
  toFormValues,
  toPostInput,
  type PostFormValues,
} from "./schema";
import type { Post } from "./types";

const valores = (over: Partial<PostFormValues> = {}): PostFormValues => ({
  title: "Checklist de segurança",
  subject_id: "subj-1",
  status: "draft",
  network: "instagram",
  format: "single",
  expected_date: "",
  content: "",
  image_ids: [],
  ...over,
});

const mensagens = (values: PostFormValues) => {
  const result = postFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("postFormSchema", () => {
  it("accepts a minimal valid draft (images can come later)", () => {
    expect(mensagens(valores())).toEqual([]);
  });

  it("requires a title and a subject (messages are i18n keys)", () => {
    expect(mensagens(valores({ title: "   ", subject_id: "" }))).toEqual(
      expect.arrayContaining([
        "posts.form.errors.titleRequired",
        "posts.form.errors.subjectRequired",
      ]),
    );
  });

  it("only accepts the statuses of the API", () => {
    expect(mensagens(valores({ status: "review" }))).toEqual([]);
    expect(
      postFormSchema.safeParse({ ...valores(), status: "rascunho" }).success,
    ).toBe(false);
  });

  it("applies the network rules (same as the backend)", () => {
    expect(
      mensagens(valores({ network: "instagram", format: "text" })),
    ).toEqual(["posts.form.errors.formatNotAvailable"]);
    expect(
      mensagens(
        valores({ network: "x", format: "single", content: "a".repeat(281) }),
      ),
    ).toEqual(["posts.form.errors.tooLongForNetwork"]);
    expect(
      mensagens(
        valores({
          network: "x",
          format: "carousel",
          image_ids: ["1", "2", "3", "4", "5"],
        }),
      ),
    ).toEqual(["posts.form.errors.tooManyImages"]);
    expect(
      mensagens(
        valores({ status: "approved", format: "single", image_ids: [] }),
      ),
    ).toEqual(["posts.form.errors.needsOneImage"]);
    expect(
      mensagens(
        valores({ status: "published", format: "carousel", image_ids: ["1"] }),
      ),
    ).toEqual(["posts.form.errors.needsTwoImages"]);
  });
});

describe("toPostInput", () => {
  it("turns empty optional fields into null and trims the content", () => {
    expect(toPostInput(valores({ content: "  " }))).toEqual({
      title: "Checklist de segurança",
      subject_id: "subj-1",
      status: "draft",
      network: "instagram",
      format: "single",
      expected_date: null,
      content: null,
      image_ids: [],
    });
  });

  it("keeps the date, content and images (in order)", () => {
    const input = toPostInput(
      valores({
        format: "carousel",
        expected_date: "2026-11-20",
        content: " Texto ",
        image_ids: ["img-2", "img-1"],
      }),
    );
    expect(input).toMatchObject({
      expected_date: "2026-11-20",
      content: "Texto",
      image_ids: ["img-2", "img-1"],
    });
  });
});

describe("toFormValues", () => {
  it("starts a new post as an Instagram single-image draft", () => {
    expect(toFormValues(undefined, "subj-9")).toEqual(
      valores({ title: "", subject_id: "subj-9" }),
    );
  });

  it("maps a saved post back to the form (null → empty string)", () => {
    const post: Post = {
      id: "post-1",
      subject_id: "subj-1",
      title: "T",
      content: null,
      status: "approved",
      network: "linkedin",
      format: "text",
      expected_date: "2026-11-20",
      image_ids: [],
      created_at: "",
      updated_at: "",
    };
    expect(toFormValues(post)).toEqual(
      valores({
        title: "T",
        status: "approved",
        network: "linkedin",
        format: "text",
        expected_date: "2026-11-20",
      }),
    );
  });
});
