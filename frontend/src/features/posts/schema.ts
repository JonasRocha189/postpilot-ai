import {
  STATUS_POST,
  type FormatoPost,
  type Rede,
  type StatusPost,
} from "@/lib/dominio";
import { z } from "zod";
import { erroRegraPost, REDES } from "./redes";
import type { Idea } from "@/features/ideas/types";
import type { Post, PostInput, PostVariation } from "./types";

// Messages are translation keys (namespace "app")

const FORMATS: readonly FormatoPost[] = ["text", "single", "carousel"];

/** Order of the variations (tabs, list chips and API body). */
export const NETWORK_ORDER: readonly Rede[] = REDES;

const variationSchema = z.object({
  network: z.enum(REDES as [Rede, ...Rede[]]),
  format: z.enum(FORMATS as [FormatoPost, ...FormatoPost[]]),
  status: z.enum(STATUS_POST as [StatusPost, ...StatusPost[]]),
  /** "YYYY-MM-DD" or "" (the date field shows it in the user's locale) */
  expected_date: z.string(),
  content: z.string(),
  /** Library images, in carousel order */
  image_ids: z.array(z.string()),
});

export const postFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { message: "posts.form.errors.titleRequired" })
      .max(200, { message: "form.errors.tooLong" }),
    subject_id: z
      .string()
      .min(1, { message: "posts.form.errors.subjectRequired" }),
    variations: z.array(variationSchema),
  })
  .superRefine((values, ctx) => {
    if (values.variations.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["variations"],
        message: "posts.form.errors.variationRequired",
      });
    }
    // Same rules as the backend, for each network: format, text and images
    values.variations.forEach((variation, index) => {
      const error = erroRegraPost({
        network: variation.network,
        format: variation.format,
        imagens: variation.image_ids.length,
        texto: variation.content.trim(),
        status: variation.status,
      });
      if (error) {
        ctx.addIssue({
          code: "custom",
          path: ["variations", index, error.campo],
          message: error.mensagem,
        });
      }
    });
  });

export type PostFormValues = z.infer<typeof postFormSchema>;
export type VariationFormValues = PostFormValues["variations"][number];

/** A new variation for the network: its first format, draft, no date. */
export function newVariation(
  network: Rede,
  format: FormatoPost = network === "instagram" ? "single" : "text",
): VariationFormValues {
  return {
    network,
    format,
    status: "draft",
    expected_date: "",
    content: "",
    image_ids: [],
  };
}

const byNetwork = <T extends { network: Rede }>(a: T, b: T) =>
  NETWORK_ORDER.indexOf(a.network) - NETWORK_ORDER.indexOf(b.network);

export function toPostInput(values: PostFormValues): PostInput {
  return {
    title: values.title,
    subject_id: values.subject_id,
    variations: [...values.variations].sort(byNetwork).map((v) => {
      const content = v.content.trim();
      return {
        network: v.network,
        format: v.format,
        status: v.status,
        expected_date: v.expected_date || null,
        content: content || null,
        image_ids: v.image_ids,
      };
    }),
  };
}

function toVariationValues(variation: PostVariation): VariationFormValues {
  return {
    network: variation.network,
    format: variation.format,
    status: variation.status,
    expected_date: variation.expected_date ?? "",
    content: variation.content ?? "",
    image_ids: variation.image_ids,
  };
}

/** A new post written from an idea: its title, subject and suggested networks. */
export function fromIdea(idea: Idea): PostFormValues {
  const networks = NETWORK_ORDER.filter((n) => idea.networks.includes(n));
  return {
    title: idea.title,
    subject_id: idea.subject_id ?? "",
    variations: (networks.length ? networks : (["instagram"] as const)).map(
      (n) => newVariation(n),
    ),
  };
}

/** Form values of a post; a new post starts with an Instagram variation. */
export function toFormValues(post?: Post, defaultSubject = ""): PostFormValues {
  return {
    title: post?.title ?? "",
    subject_id: post?.subject_id ?? defaultSubject,
    variations: post
      ? [...post.variations].sort(byNetwork).map(toVariationValues)
      : [newVariation("instagram")],
  };
}
