import { z } from "zod";
import type { Assunto, AssuntoInput } from "./types";

// As mensagens são chaves de tradução (namespace "app")
const textoOpcional = (max: number) =>
  z.string().trim().max(max, { message: "form.errors.tooLong" });

export const assuntoFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "subjects.form.errors.nameRequired" })
    .max(100, { message: "form.errors.tooLong" }),
  description: textoOpcional(500),
  target_audience: textoOpcional(500),
  voice_tone: textoOpcional(500),
});

export type AssuntoFormValues = z.infer<typeof assuntoFormSchema>;

export const LIMITES: Record<keyof AssuntoFormValues, number> = {
  name: 100,
  description: 500,
  target_audience: 500,
  voice_tone: 500,
};

const vazioParaNull = (valor: string) => (valor === "" ? null : valor);

export function toAssuntoInput(values: AssuntoFormValues): AssuntoInput {
  return {
    name: values.name,
    description: vazioParaNull(values.description),
    target_audience: vazioParaNull(values.target_audience),
    voice_tone: vazioParaNull(values.voice_tone),
  };
}

export function toFormValues(assunto?: Assunto): AssuntoFormValues {
  return {
    name: assunto?.name ?? "",
    description: assunto?.description ?? "",
    target_audience: assunto?.target_audience ?? "",
    voice_tone: assunto?.voice_tone ?? "",
  };
}
