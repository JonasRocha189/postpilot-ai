import { STATUS_POST, type StatusPost } from "@/lib/dominio";
import { z } from "zod";
import type { Post, PostInput } from "./types";

// As mensagens são chaves de tradução (namespace "app")

export const postFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "posts.form.errors.titleRequired" })
    .max(200, { message: "form.errors.tooLong" }),
  subject_id: z
    .string()
    .min(1, { message: "posts.form.errors.subjectRequired" }),
  status: z.enum(STATUS_POST as [StatusPost, ...StatusPost[]]),
  /** valor de <input type="date"> ("AAAA-MM-DD") ou "" */
  expected_date: z.string(),
  content: z.string(),
  /** id da imagem da biblioteca ou "" */
  image_id: z.string(),
});

export type PostFormValues = z.infer<typeof postFormSchema>;

export function toPostInput(values: PostFormValues): PostInput {
  const content = values.content.trim();
  return {
    title: values.title,
    subject_id: values.subject_id,
    status: values.status,
    expected_date: values.expected_date || null,
    content: content || null,
    image_id: values.image_id || null,
  };
}

export function toFormValues(post?: Post, assuntoPadrao = ""): PostFormValues {
  return {
    title: post?.title ?? "",
    subject_id: post?.subject_id ?? assuntoPadrao,
    status: post?.status ?? "draft",
    expected_date: post?.expected_date ?? "",
    content: post?.content ?? "",
    image_id: post?.image_id ?? "",
  };
}
