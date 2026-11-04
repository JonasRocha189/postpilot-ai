import { z } from "zod";
import type { Projeto, ProjetoInput } from "./types";

// As mensagens são chaves de tradução (namespace "app"), traduzidas no formulário
const textoOpcional = (max: number) =>
  z.string().trim().max(max, { message: "projects.form.errors.tooLong" });

export const projetoFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "projects.form.errors.nameRequired" })
    .max(100, { message: "projects.form.errors.tooLong" }),
  description: textoOpcional(500),
  target_audience: textoOpcional(500),
  voice_tone: textoOpcional(500),
});

export type ProjetoFormValues = z.infer<typeof projetoFormSchema>;

export const LIMITES: Record<keyof ProjetoFormValues, number> = {
  name: 100,
  description: 500,
  target_audience: 500,
  voice_tone: 500,
};

const vazioParaNull = (valor: string) => (valor === "" ? null : valor);

export function toProjetoInput(values: ProjetoFormValues): ProjetoInput {
  return {
    name: values.name,
    description: vazioParaNull(values.description),
    target_audience: vazioParaNull(values.target_audience),
    voice_tone: vazioParaNull(values.voice_tone),
  };
}

export function toFormValues(projeto?: Projeto): ProjetoFormValues {
  return {
    name: projeto?.name ?? "",
    description: projeto?.description ?? "",
    target_audience: projeto?.target_audience ?? "",
    voice_tone: projeto?.voice_tone ?? "",
  };
}
