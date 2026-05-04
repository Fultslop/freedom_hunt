import { useState, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { Camera } from "lucide-react";
import type { FormField, FormFieldType } from "../types/data";
import "./ChallengeForm.css";

const VALID_TYPES: FormFieldType[] = [
  "string",
  "number",
  "boolean",
  "radio",
  "multiple",
  "photo",
];

function checkDefinition(field: FormField): string | null {
  if (!VALID_TYPES.includes(field.type)) return `unknown type "${field.type}"`;
  if (field.type === "radio" && (!field.options || field.options.length === 0))
    return "radio field missing options";
  if (
    field.type === "multiple" &&
    (!field.options || field.options.length === 0)
  )
    return "multiple field missing options";
  if (field.type === "multiple" && (field.min == null || field.max == null))
    return "multiple field missing min/max";
  if (
    field.type === "multiple" &&
    field.min !== undefined &&
    field.max !== undefined &&
    field.min > field.max
  )
    return "multiple field: min > max";
  return null;
}

type SubmitState = "idle" | "submitting" | "success" | "error";
type UploadState = "idle" | "uploading" | "success" | "error";
type FieldValues = Record<string, string | number | boolean | string[]>;

interface ChallengeFormProps {
  form: FormField[];
  locationId: number;
  routeId?: string;
}

export default function ChallengeForm({
  form,
  locationId,
  routeId,
}: ChallengeFormProps) {
  const { activeAuth } = useAuth();
  const [values, setValues] = useState<FieldValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [maxWarning, setMaxWarning] = useState<string | null>(null);
  const maxWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPhotoField = form.some((f) => f.type === "photo");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState("uploading");
    const body = new FormData();
    body.append("photo", file);
    body.append("locationId", String(locationId));
    try {
      const res = await fetch("/upload", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean };
      setUploadState(data.ok ? "success" : "error");
    } catch {
      setUploadState("error");
    }
  }

  function setValue(id: string, value: FieldValues[string]) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function toggleMultiple(id: string, opt: string, max: number | undefined) {
    setValues((prev) => {
      const current = (prev[id] as string[]) ?? [];
      if (!current.includes(opt) && max !== undefined && current.length >= max) {
        clearTimeout(maxWarningTimer.current ?? undefined);
        setMaxWarning(id);
        maxWarningTimer.current = setTimeout(() => setMaxWarning(null), 1500);
        return prev;
      }
      const next = current.includes(opt)
        ? current.filter((v) => v !== opt)
        : [...current, opt];
      return { ...prev, [id]: next };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function validate(): Record<string, string> {
    const newErrors: Record<string, string> = {};
    for (const field of form) {
      if (checkDefinition(field)) continue;
      if (field.type === "boolean") continue;
      if (field.type === "radio" && !values[field.id])
        newErrors[field.id] = "Please select an option";
      if (field.type === "multiple") {
        const selected = (values[field.id] as string[]) ?? [];
        if (selected.length < (field.min ?? 0))
          newErrors[field.id] =
            `Select at least ${field.min} option${(field.min ?? 0) > 1 ? "s" : ""}`;
        else if (field.max !== undefined && selected.length > field.max)
          newErrors[field.id] =
            `Select at most ${field.max} option${field.max > 1 ? "s" : ""}`;
      }
      if (field.type === "string" && !String(values[field.id] ?? "").trim())
        newErrors[field.id] = "This field is required";
      if (
        field.type === "number" &&
        (values[field.id] === "" || values[field.id] === undefined)
      )
        newErrors[field.id] = "This field is required";
    }
    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSubmitState("submitting");
    try {
      const res = await fetch("/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          routeId: String(routeId),
          locationId: String(locationId),
          teamName: activeAuth?.teamName ?? "",
          email: activeAuth?.contact ?? "",
          fields: values,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      setSubmitState(data.ok ? "success" : "error");
    } catch {
      setSubmitState("error");
    }
  }

  function renderField(field: FormField) {
    const defError = checkDefinition(field);
    if (defError) {
      return (
        <div key={field.id} className="cf-invalid-field">
          {`⚠ Invalid field "${field.id}": ${defError}`}
        </div>
      );
    }

    if (field.type === "photo") return null;

    return (
      <div key={field.id} className="cf-field">
        {field.type === "boolean" ? (
          <label htmlFor={field.id} className="cf-label--checkbox">
            <input
              id={field.id}
              type="checkbox"
              checked={!!values[field.id]}
              onChange={(e) => setValue(field.id, e.target.checked)}
              className="cf-checkbox"
            />
            {field.label}
          </label>
        ) : (
          <>
            <label htmlFor={field.id} className="cf-label">
              {field.label}
            </label>
            {field.type === "string" ? (
              <input
                id={field.id}
                type="text"
                value={(values[field.id] as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                className={`cf-input${errors[field.id] ? " cf-input--error" : ""}`}
              />
            ) : null}
            {field.type === "number" ? (
              <input
                id={field.id}
                type="number"
                value={(values[field.id] as number) ?? ""}
                onChange={(e) =>
                  setValue(
                    field.id,
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className={`cf-input${errors[field.id] ? " cf-input--error" : ""}`}
              />
            ) : null}
            {field.type === "radio" && field.options ? (
              <div className="cf-radio-group">
                {field.options.map((opt) => (
                  <label
                    key={opt}
                    htmlFor={`${field.id}-${opt}`}
                    className="cf-label--radio"
                  >
                    <input
                      id={`${field.id}-${opt}`}
                      type="radio"
                      name={field.id}
                      value={opt}
                      checked={values[field.id] === opt}
                      onChange={() => setValue(field.id, opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : null}
            {field.type === "multiple" && field.options ? (
              <>
                <span className="cf-multi-hint">
                  Select{" "}
                  {field.min === field.max
                    ? field.min
                    : `${field.min}–${field.max}`}
                </span>
                <div className="cf-radio-group">
                  {field.options.map((opt) => (
                    <label
                      key={opt}
                      htmlFor={`${field.id}-${opt}`}
                      className="cf-label--radio"
                    >
                      <input
                        id={`${field.id}-${opt}`}
                        type="checkbox"
                        value={opt}
                        checked={((values[field.id] as string[]) ?? []).includes(opt)}
                        onChange={() => toggleMultiple(field.id, opt, field.max)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                {maxWarning === field.id ? (
                  <div className="cf-max-warning">
                    Maximum of {field.max} option{field.max !== undefined && field.max > 1 ? "s" : ""}{" "}
                    reached
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
        {errors[field.id] ? (
          <div className="cf-error-msg">{errors[field.id]}</div>
        ) : null}
      </div>
    );
  }

  if (submitState === "success") {
    return <div className="cf-success">✓ Answers submitted</div>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
      {form.map(renderField)}

      {hasPhotoField ? (
        <div className="cf-photo-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          {uploadState === "success" ? (
            <div className="cf-photo-success">✓ Photo submitted</div>
          ) : (
            <>
              <button
                data-testid="submit-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState === "uploading"}
                className={`cf-photo-btn cf-photo-btn--${uploadState}`}
              >
                {uploadState === "uploading" ? (
                  "Uploading…"
                ) : uploadState === "error" ? (
                  <>
                    <Camera
                      size={14}
                      aria-hidden
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />{" "}
                    Try again
                  </>
                ) : (
                  <>
                    <Camera
                      size={14}
                      aria-hidden
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />{" "}
                    {form.find((f) => f.type === "photo")?.label ??
                      "Submit photo proof"}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      ) : null}

      {submitState === "error" ? (
        <div className="cf-error-banner">
          Submission failed. Please try again.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitState === "submitting"}
        className="cf-submit"
      >
        {submitState === "submitting"
          ? "Submitting…"
          : submitState === "error"
            ? "Try again"
            : "Submit"}
      </button>
    </form>
  );
}