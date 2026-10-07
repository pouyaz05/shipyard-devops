import { useAuth } from "../auth/AuthContext";

export default function Account() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold">Your account</h1>
      <dl className="grid max-w-md grid-cols-[6rem_1fr] gap-y-2 text-sm">
        <dt className="font-medium text-slate-500">Name</dt>
        <dd>{user.full_name}</dd>
        <dt className="font-medium text-slate-500">Email</dt>
        <dd>{user.email}</dd>
      </dl>
    </section>
  );
}
