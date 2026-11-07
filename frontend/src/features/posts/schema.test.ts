import { describe, expect, it } from "vitest";
import {
  newVariation,
  postFormSchema,
  toFormValues,
  toPostInput,
  type PostFormValues,
  type VariationFormValues,
} from "./schema";
import type { Post } from "./types";

const variation = (
  over: Partial<VariationFormValues> = {},
): VariationFormValues => ({ ...newVariation("instagram"), ...over });

const values = (
  over: Partial<PostFormValues> = {},
  variations: VariationFormValues[] = [variation()],
): PostFormValues => ({
  title: "Checklist de segurança",
  subject_id: "subj-1",
  variations,
  ...over,
});

const issues = (v: PostFormValues) => {
  const result = postFormSchema.safeParse(v);
  return result.success
    ? []
    : result.error.issues.map((i) => ({ path: i.path, message: i.message }));
};
const messages = (v: PostFormValues) => issues(v).map((i) => i.message);

describe("postFormSchema", () => {
  it("accepts a minimal valid draft (images can come later)", () => {
    expect(messages(values())).toEqual([]);
  });

  it("requires a title, a subject and at least one network (i18n keys)", () => {
    expect(messages(values({ title: "   ", subject_id: "" }, []))).toEqual(
      expect.arrayContaining([
        "posts.form.errors.titleRequired",
        "posts.form.errors.subjectRequired",
        "posts.form.errors.variationRequired",
      ]),
    );
  });

  it("only accepts the statuses of the API", () => {
    expect(messages(values({}, [variation({ status: "review" })]))).toEqual([]);
    expect(
      postFormSchema.safeParse(
        values({}, [{ ...variation(), status: "rascunho" as "draft" }]),
      ).success,
    ).toBe(false);
  });

  it("applies each network's rules to its own variation (same as the backend)", () => {
    const cases: [Partial<VariationFormValues>, string, string][] = [
      [{ format: "text" }, "format", "posts.form.errors.formatNotAvailable"],
      [
        { network: "x", format: "single", content: "a".repeat(281) },
        "content",
        "posts.form.errors.tooLongForNetwork",
      ],
      [
        {
          network: "x",
          format: "carousel",
          image_ids: ["1", "2", "3", "4", "5"],
        },
        "image_ids",
        "posts.form.errors.tooManyImages",
      ],
      [
        { status: "approved", format: "single" },
        "image_ids",
        "posts.form.errors.needsOneImage",
      ],
      [
        { status: "published", format: "carousel", image_ids: ["1"] },
        "image_ids",
        "posts.form.errors.needsTwoImages",
      ],
    ];
    for (const [over, field, message] of cases) {
      // The broken variation is the second one: the error points to index 1
      const linkedin = variation({ network: "linkedin", format: "text" });
      expect(issues(values({}, [linkedin, variation(over)]))).toEqual([
        { path: ["variations", 1, field], message },
      ]);
    }
  });

  it("the same text can be valid on LinkedIn and too long on X", () => {
    const text = "a".repeat(500);
    const result = issues(
      values({}, [
        variation({ network: "linkedin", format: "text", content: text }),
        variation({ network: "x", format: "text", content: text }),
      ]),
    );
    expect(result).toEqual([
      {
        path: ["variations", 1, "content"],
        message: "posts.form.errors.tooLongForNetwork",
      },
    ]);
  });
});

describe("toPostInput", () => {
  it("turns empty optional fields into null and trims the content", () => {
    expect(toPostInput(values({}, [variation({ content: "  " })]))).toEqual({
      title: "Checklist de segurança",
      subject_id: "subj-1",
      variations: [
        {
          network: "instagram",
          format: "single",
          status: "draft",
          expected_date: null,
          content: null,
          image_ids: [],
        },
      ],
    });
  });

  it("sends the variations in network order, keeping dates, text and images", () => {
    const input = toPostInput(
      values({}, [
        variation({ network: "x", format: "text" }),
        variation({
          format: "carousel",
          expected_date: "2026-11-20",
          content: " Texto ",
          image_ids: ["img-2", "img-1"],
        }),
        variation({ network: "linkedin", format: "text" }),
      ]),
    );
    expect(input.variations.map((v) => v.network)).toEqual([
      "linkedin",
      "instagram",
      "x",
    ]);
    expect(input.variations[1]).toMatchObject({
      expected_date: "2026-11-20",
      content: "Texto",
      image_ids: ["img-2", "img-1"],
    });
  });
});

describe("toFormValues", () => {
  it("starts a new post with an Instagram single-image draft", () => {
    expect(toFormValues(undefined, "subj-9")).toEqual(
      values({ title: "", subject_id: "subj-9" }),
    );
  });

  it("maps a saved post back to the form (null → empty string)", () => {
    const post: Post = {
      id: "post-1",
      subject_id: "subj-1",
      title: "T",
      variations: [
        {
          id: "var-x",
          network: "x",
          format: "text",
          content: "Curto",
          status: "draft",
          expected_date: null,
          image_ids: [],
        },
        {
          id: "var-li",
          network: "linkedin",
          format: "text",
          content: null,
          status: "approved",
          expected_date: "2026-11-20",
          image_ids: [],
        },
      ],
      created_at: "",
      updated_at: "",
    };
    expect(toFormValues(post)).toEqual(
      values({ title: "T" }, [
        variation({
          network: "linkedin",
          format: "text",
          status: "approved",
          expected_date: "2026-11-20",
        }),
        variation({ network: "x", format: "text", content: "Curto" }),
      ]),
    );
  });
});
