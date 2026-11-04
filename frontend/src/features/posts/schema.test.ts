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
  expected_date: "",
  content: "",
  image_id: "",
  ...over,
});

describe("postFormSchema", () => {
  it("accepts a minimal valid post", () => {
    expect(postFormSchema.safeParse(valores()).success).toBe(true);
  });

  it("requires a title and a subject (messages are i18n keys)", () => {
    const result = postFormSchema.safeParse(
      valores({ title: "   ", subject_id: "" }),
    );
    expect(result.success).toBe(false);
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages).toContain("posts.form.errors.titleRequired");
    expect(messages).toContain("posts.form.errors.subjectRequired");
  });

  it("limits the title to 200 characters", () => {
    expect(
      postFormSchema.safeParse(valores({ title: "a".repeat(201) })).success,
    ).toBe(false);
  });

  it("only accepts the statuses of the API", () => {
    expect(
      postFormSchema.safeParse(valores({ status: "review" })).success,
    ).toBe(true);
    expect(
      postFormSchema.safeParse({ ...valores(), status: "rascunho" }).success,
    ).toBe(false);
  });
});

describe("toPostInput", () => {
  it("turns empty optional fields into null and trims the content", () => {
    expect(toPostInput(valores({ content: "  " }))).toEqual({
      title: "Checklist de segurança",
      subject_id: "subj-1",
      status: "draft",
      expected_date: null,
      content: null,
      image_id: null,
    });
  });

  it("keeps the date, content and image when filled in", () => {
    const input = toPostInput(
      valores({
        expected_date: "2026-11-20",
        content: " Texto ",
        image_id: "img-1",
      }),
    );
    expect(input).toMatchObject({
      expected_date: "2026-11-20",
      content: "Texto",
      image_id: "img-1",
    });
  });
});

describe("toFormValues", () => {
  it("starts a new post as a draft, with the default subject", () => {
    expect(toFormValues(undefined, "subj-9")).toEqual({
      title: "",
      subject_id: "subj-9",
      status: "draft",
      expected_date: "",
      content: "",
      image_id: "",
    });
  });

  it("maps a saved post back to the form (null → empty string)", () => {
    const post: Post = {
      id: "post-1",
      subject_id: "subj-1",
      title: "T",
      content: null,
      status: "approved",
      expected_date: "2026-11-20",
      image_id: null,
      created_at: "",
      updated_at: "",
    };
    expect(toFormValues(post)).toEqual({
      title: "T",
      subject_id: "subj-1",
      status: "approved",
      expected_date: "2026-11-20",
      content: "",
      image_id: "",
    });
  });
});
