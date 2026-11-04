import {
  STATUS_POST,
  type FormatoPost,
  type Rede,
  type StatusPost,
} from "@/lib/dominio";
import { z } from "zod";
import { erroRegraPost, REDES } from "./redes";
import type { Post, PostInput } from "./types";

// As mensagens são chaves de tradução (namespace "app")

const FORMATOS: readonly FormatoPost[] = ["text", "single", "carousel"];

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
    status: z.enum(STATUS_POST as [StatusPost, ...StatusPost[]]),
    network: z.enum(REDES as [Rede, ...Rede[]]),
    format: z.enum(FORMATOS as [FormatoPost, ...FormatoPost[]]),
    /** "AAAA-MM-DD" ou "" (o campo de data mostra no formato do idioma) */
    expected_date: z.string(),
    content: z.string(),
    /** Imagens da biblioteca, na ordem do carrossel */
    image_ids: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    // Mesmas regras do backend: formato da rede, limite de texto e imagens
    const erro = erroRegraPost({
      network: values.network,
      format: values.format,
      imagens: values.image_ids.length,
      texto: values.content.trim(),
      status: values.status,
    });
    if (erro) {
      ctx.addIssue({
        code: "custom",
        path: [erro.campo],
        message: erro.mensagem,
      });
    }
  });

export type PostFormValues = z.infer<typeof postFormSchema>;

export function toPostInput(values: PostFormValues): PostInput {
  const content = values.content.trim();
  return {
    title: values.title,
    subject_id: values.subject_id,
    status: values.status,
    network: values.network,
    format: values.format,
    expected_date: values.expected_date || null,
    content: content || null,
    image_ids: values.image_ids,
  };
}

export function toFormValues(post?: Post, assuntoPadrao = ""): PostFormValues {
  return {
    title: post?.title ?? "",
    subject_id: post?.subject_id ?? assuntoPadrao,
    status: post?.status ?? "draft",
    network: post?.network ?? "instagram",
    format: post?.format ?? "single",
    expected_date: post?.expected_date ?? "",
    content: post?.content ?? "",
    image_ids: post?.image_ids ?? [],
  };
}
