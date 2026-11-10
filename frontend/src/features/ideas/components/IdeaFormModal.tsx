import { alertErrorClass } from "@/components/common/styles";
import {
  FormInput,
  FormSelect,
  FormTextArea,
} from "@/components/form/FormField";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import type { Subject } from "@/features/subjects/types";
import { NETWORKS } from "@/features/posts/networks";
import { NETWORK_LABEL, type Network } from "@/lib/domain";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { Idea, IdeaInput } from "../types";

// Messages are translation keys (namespace "app")
const ideaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "ideas.form.errors.titleRequired" })
    .max(200, { message: "form.errors.tooLong" }),
  notes: z.string().max(2000, { message: "form.errors.tooLong" }),
  subject_id: z.string(),
  networks: z.array(z.enum(NETWORKS as [Network, ...Network[]])),
});
type IdeaFormValues = z.infer<typeof ideaSchema>;

const toValues = (idea?: Idea | null): IdeaFormValues => ({
  title: idea?.title ?? "",
  notes: idea?.notes ?? "",
  subject_id: idea?.subject_id ?? "",
  networks: idea?.networks ?? [],
});

const toInput = (values: IdeaFormValues): IdeaInput => ({
  title: values.title.trim(),
  notes: values.notes.trim() || null,
  subject_id: values.subject_id || null,
  networks: NETWORKS.filter((n) => values.networks.includes(n)),
});

/** Create or edit an idea (`idea` set = editing). */
export default function IdeaFormModal({
  isOpen,
  idea,
  subjects,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  idea: Idea | null;
  subjects: Subject[];
  onSave: (input: IdeaInput) => Promise<unknown>;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="m-4 max-h-[calc(100dvh-2rem)] max-w-[560px] overflow-y-auto p-6 sm:p-8"
    >
      {/* Remounted on every open: the form starts from the idea being edited */}
      {isOpen && (
        <IdeaForm
          key={idea?.id ?? "new"}
          idea={idea}
          subjects={subjects}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function IdeaForm({
  idea,
  subjects,
  onSave,
  onClose,
}: {
  idea: Idea | null;
  subjects: Subject[];
  onSave: (input: IdeaInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation("app");
  const [saveError, setSaveError] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IdeaFormValues>({
    resolver: zodResolver(ideaSchema),
    defaultValues: toValues(idea),
  });
  const message = (key?: string) => (key ? t(key, { max: 200 }) : undefined);

  const submit = async (values: IdeaFormValues) => {
    setSaveError(false);
    try {
      await onSave(toInput(values));
      onClose();
    } catch {
      setSaveError(true);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <h3 className="pe-8 text-lg font-semibold text-gray-800 dark:text-white/90">
        {idea ? t("ideas.form.editTitle") : t("ideas.form.newTitle")}
      </h3>
      <div className="mt-6 space-y-5">
        <FormInput
          id="idea-title"
          label={t("ideas.form.title")}
          placeholder={t("ideas.form.titlePlaceholder")}
          required
          autoFocus
          maxLength={200}
          error={message(errors.title?.message)}
          {...register("title")}
        />
        <FormTextArea
          id="idea-notes"
          label={t("ideas.form.notes")}
          hint={t("ideas.form.notesHint")}
          rows={4}
          error={message(errors.notes?.message)}
          {...register("notes")}
        />
        <FormSelect
          id="idea-subject"
          label={t("ideas.form.subject")}
          {...register("subject_id")}
        >
          <option value="">{t("ideas.form.noSubject")}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FormSelect>
        <Controller
          control={control}
          name="networks"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
                {t("ideas.form.networks")}
              </legend>
              <div className="flex flex-wrap gap-4">
                {NETWORKS.map((n) => (
                  <label
                    key={n}
                    className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      type="checkbox"
                      checked={field.value.includes(n)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.checked
                            ? [...field.value, n]
                            : field.value.filter((v) => v !== n),
                        )
                      }
                      className="size-4 accent-brand-500"
                    />
                    {NETWORK_LABEL[n]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        />
      </div>

      {saveError && (
        <p role="alert" className={`${alertErrorClass} mt-5`}>
          {t("ideas.form.saveError")}
        </p>
      )}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          {t("form.cancel")}
        </Button>
        <Button disabled={isSubmitting} className="sm:min-w-32">
          {isSubmitting
            ? t("form.saving")
            : idea
              ? t("ideas.form.save")
              : t("ideas.form.create")}
        </Button>
      </div>
    </form>
  );
}
