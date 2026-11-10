import { cn } from "@/utils";
import type { ComponentProps } from "react";
import Label from "./Label";

// Fields with the TailAdmin look that accept `ref`, for use with
// React Hook Form's `register`.

const base =
  "w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30";
const normal =
  "border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800";
const invalid =
  "border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:border-error-500 dark:focus:border-error-800";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ms-0.5 text-error-500">*</span>}
      </Label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs text-error-500"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p
            id={`${id}-hint`}
            className="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
          >
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function FormInput({
  id,
  label,
  hint,
  error,
  required,
  className,
  ...props
}: FieldProps & ComponentProps<"input"> & { id: string }) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        className={cn(base, "h-11", error ? invalid : normal, className)}
        {...props}
      />
    </FieldShell>
  );
}

export function FormSelect({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: FieldProps & ComponentProps<"select"> & { id: string }) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        className={cn(
          base,
          "h-11 pe-10 dark:bg-gray-900",
          error ? invalid : normal,
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function FormTextArea({
  id,
  label,
  hint,
  error,
  required,
  className,
  rows = 3,
  ...props
}: FieldProps & ComponentProps<"textarea"> & { id: string }) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        className={cn(base, error ? invalid : normal, className)}
        {...props}
      />
    </FieldShell>
  );
}
