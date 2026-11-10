import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { useSubject, useSubjects } from "@/features/subjects/api";
import { useIdea, useUpdateIdea } from "@/features/ideas/api";
import { useUpdatePost, useCreatePost, usePost } from "@/features/posts/api";
import PostForm from "@/features/posts/components/PostForm";
import {
  fromIdea,
  toFormValues,
  toPostInput,
  type PostFormValues,
} from "@/features/posts/schema";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { ApiError } from "@/lib/api/http";
import { NETWORKS } from "@/features/posts/networks";
import NotFound from "@/pages/OtherPage/NotFound";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

/** /posts/new (no id) and /posts/:id (editing). */
export default function PostFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { t } = useTranslation("app", { keyPrefix: "posts" });
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated =
    (location.state as { created?: boolean } | null)?.created === true;
  const { currentProject } = useCurrentProject();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEdit = Boolean(id);
  const post = usePost(id);
  // When editing, the subjects offered are those of the post's project
  const postSubject = useSubject(post.data?.subject_id);
  const projectId = isEdit ? postSubject.data?.project_id : currentProject?.id;
  const subjects = useSubjects(projectId);

  // /posts/new?idea=…: the post starts from an idea (Ideas page)
  const ideaId = isEdit ? null : params.get("idea");
  const idea = useIdea(ideaId);
  const updateIdea = useUpdateIdea();

  const create = useCreatePost();
  const update = useUpdatePost();
  const title = isEdit ? t("editTitle") : t("newTitle");

  const onSubmit = async (values: PostFormValues) => {
    setSubmitError(null);
    try {
      if (id) {
        await update.mutateAsync({ id, input: toPostInput(values) });
        navigate("/posts");
      } else {
        const created = await create.mutateAsync(toPostInput(values));
        if (idea.data) {
          // The idea now points to its post. If this fails, the post is
          // already saved: the idea just stays open (it can be retried later).
          const { title, notes, subject_id, networks } = idea.data;
          await updateIdea
            .mutateAsync({
              id: idea.data.id,
              input: {
                title,
                notes,
                subject_id,
                networks,
                post_id: created.id,
              },
            })
            .catch(() => undefined);
        }
        navigate("/posts");
      }
    } catch {
      setSubmitError(t("saveError"));
    }
  };

  if (isEdit && post.error instanceof ApiError && post.error.status === 404) {
    return <NotFound />;
  }

  const loading =
    (isEdit && (post.isLoading || postSubject.isLoading)) ||
    (Boolean(ideaId) && idea.isLoading) ||
    subjects.isLoading ||
    !subjects.data;
  const error = (isEdit && post.isError) || subjects.isError;
  // ?subject=… preselects the subject (e.g. coming from the filtered list)
  const defaultSubject = params.get("subject") ?? "";
  // ?network=… opens that variation's tab (e.g. coming from the calendar)
  const networkParam = params.get("network");
  const initialNetwork = NETWORKS.find((n) => n === networkParam) ?? null;

  return (
    <>
      <PageMeta title={`${title} | PostPilot`} description={t("subtitle")} />
      <PageBreadcrumb pageTitle={title} />

      <div className="mx-auto max-w-4xl">
        {error ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : loading ? (
          <div className="space-y-6" aria-hidden>
            <div className="h-56 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : (
          <>
            {justCreated && (
              <p
                role="status"
                className="mb-6 rounded-lg border border-success-500 bg-success-50 p-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-400"
              >
                {t("form.created")}
              </p>
            )}
            <PostForm
              projectId={projectId!}
              key={post.data?.id ?? idea.data?.id ?? "novo"}
              subjects={subjects.data ?? []}
              defaultValues={
                idea.data && !isEdit
                  ? fromIdea(idea.data)
                  : toFormValues(post.data, defaultSubject)
              }
              initialNetwork={initialNetwork}
              onSubmit={onSubmit}
              submitLabel={isEdit ? t("save") : t("create")}
              submitError={submitError}
            />
          </>
        )}
      </div>
    </>
  );
}
