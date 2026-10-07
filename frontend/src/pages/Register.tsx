import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { validateEmail, validateFullName, validatePassword } from "../auth/validation";
import TextField from "../components/TextField";

interface FieldErrors {
  full_name?: string;
  email?: string;
  password?: string;
}

export default function Register() {
  const { user, register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/account" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);

    const next: FieldErrors = {
      full_name: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(next);
    if (next.full_name || next.email || next.password) return;

    setSubmitting(true);
    try {
      await register({ full_name: fullName.trim(), email: email.trim(), password });
      // On success the user is logged in and this page redirects via <Navigate> above.
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </div>
        )}
        <TextField
          label="Full name"
          type="text"
          autoComplete="name"
          value={fullName}
          error={errors.full_name}
          onChange={(e) => {
            setFullName(e.target.value);
            setErrors((prev) => ({ ...prev, full_name: undefined }));
          }}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{" "}
        <Link to="/login" className="text-sky-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
