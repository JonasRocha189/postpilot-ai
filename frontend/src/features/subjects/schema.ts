import { z } from "zod";
import type { Subject, SubjectInput } from "./types";

// The messages are translation keys ("app" namespace)
const optionalText = (max: number) =>
  z.string().trim().max(max, { message: "form.errors.tooLong" });

export const subjectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "subjects.form.errors.nameRequired" })
    .max(100, { message: "form.errors.tooLong" }),
  description: optionalText(500),
  target_audience: optionalText(500),
  voice_tone: optionalText(500),
});

export type SubjectFormValues = z.infer<typeof subjectFormSchema>;

export const LIMITS: Record<keyof SubjectFormValues, number> = {
  name: 100,
  description: 500,
  target_audience: 500,
  voice_tone: 500,
};

const emptyToNull = (value: string) => (value === "" ? null : value);

export function toSubjectInput(values: SubjectFormValues): SubjectInput {
  return {
    name: values.name,
    description: emptyToNull(values.description),
    target_audience: emptyToNull(values.target_audience),
    voice_tone: emptyToNull(values.voice_tone),
  };
}

export function toFormValues(subject?: Subject): SubjectFormValues {
  return {
    name: subject?.name ?? "",
    description: subject?.description ?? "",
    target_audience: subject?.target_audience ?? "",
    voice_tone: subject?.voice_tone ?? "",
  };
}
