import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-sky-600 hover:underline">
        Back to Home
      </Link>
    </div>
  );
}
