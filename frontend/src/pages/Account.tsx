import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApiError } from "../auth/useApiError";
import TextField from "../components/TextField";

export default function Account() {
  const { user, updateName } = useAuth();
  const handleError = useApiError();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const startEditing = () => {
    setName(user.full_name);
    setFieldError(undefined);
    setServerError(null);
    setSaved(false);
    setEditing(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError("Name is required.");
      return;
    }
    if (trimmed.length > 255) {
      setFieldError("Name must be 255 characters or fewer.");
      return;
    }
    setFieldError(undefined);

    setSaving(true);
    try {
      await updateName(trimmed);
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setServerError(handleError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">Your account</h1>

      {editing ? (
        <form onSubmit={handleSubmit} noValidate className="mb-4 max-w-md space-y-4">
          {serverError && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {serverError}
            </div>
          )}
          <TextField
            label="Name"
            type="text"
            autoComplete="name"
            value={name}
            error={fieldError}
            onChange={(e) => {
              setName(e.target.value);
              setFieldError(undefined);
            }}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="text-sm text-slate-600 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid max-w-md grid-cols-[6rem_1fr] items-center gap-y-3 text-sm">
          <dt className="font-medium text-slate-500">Name</dt>
          <dd className="flex items-center gap-3">
            <span>{user.full_name}</span>
            <button
              type="button"
              onClick={startEditing}
              className="text-sky-600 hover:underline"
            >
              Edit name
            </button>
          </dd>
        </dl>
      )}

      <dl className="grid max-w-md grid-cols-[6rem_1fr] gap-y-3 text-sm">
        <dt className="font-medium text-slate-500">Email</dt>
        <dd>{user.email}</dd>
      </dl>

      {saved && !editing && (
        <p role="status" className="mt-4 text-sm text-green-700">
          Name updated.
        </p>
      )}

      <Link to="/orders" className="mt-6 inline-block text-sm text-sky-600 hover:underline">
        View your orders
      </Link>
    </section>
  );
}
