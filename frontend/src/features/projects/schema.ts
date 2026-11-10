import { z } from "zod";
import type { Project, ProjectInput } from "./types";

// The messages are translation keys ("app" namespace), translated in the form
const optionalText = (max: number) =>
  z.string().trim().max(max, { message: "projects.form.errors.tooLong" });

export const projectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "projects.form.errors.nameRequired" })
    .max(100, { message: "projects.form.errors.tooLong" }),
  description: optionalText(500),
  target_audience: optionalText(500),
  voice_tone: optionalText(500),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const LIMITS: Record<keyof ProjectFormValues, number> = {
  name: 100,
  description: 500,
  target_audience: 500,
  voice_tone: 500,
};

const emptyToNull = (value: string) => (value === "" ? null : value);

export function toProjectInput(values: ProjectFormValues): ProjectInput {
  return {
    name: values.name,
    description: emptyToNull(values.description),
    target_audience: emptyToNull(values.target_audience),
    voice_tone: emptyToNull(values.voice_tone),
  };
}

export function toFormValues(project?: Project): ProjectFormValues {
  return {
    name: project?.name ?? "",
    description: project?.description ?? "",
    target_audience: project?.target_audience ?? "",
    voice_tone: project?.voice_tone ?? "",
  };
}
