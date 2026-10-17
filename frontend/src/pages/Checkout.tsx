import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { placeOrder } from "../api/orders";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import TextField from "../components/TextField";
import { formatCents } from "../lib/money";
import { orderErrorMessage } from "../orders/messages";
import { validateRequired } from "../orders/validation";

interface FieldErrors {
  name?: string;
  address?: string;
  city?: string;
}

interface Failure {
  status: number | null;
  message: string;
}

export default function Checkout() {
  const { user, logout } = useAuth();
  const { cart, status, error, refresh, clear } = useCart();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.full_name ?? "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);

    const next: FieldErrors = {
      name: validateRequired(name, "Name"),
      address: validateRequired(address, "Address"),
      city: validateRequired(city, "City"),
    };
    setErrors(next);
    if (next.name || next.address || next.city) return;

    setSubmitting(true);
    try {
      const order = await placeOrder({
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
      });
      // The server consumed the cart: reset the badge now, then confirm with the server.
      clear();
      void refresh();
      navigate(`/orders/${encodeURIComponent(order.id)}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      const httpStatus = err instanceof ApiError ? err.status : null;
      setFailure({ status: httpStatus, message: orderErrorMessage(err) });
      setSubmitting(false);
      // Prices or stock may have changed: show the user the up-to-date cart.
      if (httpStatus === 409 || httpStatus === 400) void refresh();
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Checkout</h1>

      {failure && (
        <div
          role="alert"
          className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p>{failure.message}</p>
          {failure.status === 409 && (
            <Link
              to="/cart"
              className="mt-3 inline-block rounded border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
            >
              Back to cart
            </Link>
          )}
          {failure.status === 400 && (
            <Link
              to="/products"
              className="mt-3 inline-block rounded border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
            >
              Browse products
            </Link>
          )}
        </div>
      )}

      {(status === "idle" || status === "loading") && <LoadingState label="Loading your cart..." />}

      {status === "error" && (
        <ErrorState message={error ?? "Could not load your cart."} onRetry={() => void refresh()} />
      )}

      {status === "ready" && cart.items.length === 0 && (
        <EmptyState title="Your cart is empty" hint="Add some products before checking out.">
          <Link
            to="/products"
            className="inline-block rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Browse products
          </Link>
        </EmptyState>
      )}

      {status === "ready" && cart.items.length > 0 && (
        <div className="grid gap-8 md:grid-cols-5">
          <form onSubmit={handleSubmit} noValidate className="space-y-4 md:col-span-3">
            <h2 className="text-lg font-medium">Shipping address</h2>
            <TextField
              label="Name"
              type="text"
              autoComplete="name"
              value={name}
              error={errors.name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />
            <TextField
              label="Address"
              type="text"
              autoComplete="street-address"
              value={address}
              error={errors.address}
              onChange={(e) => {
                setAddress(e.target.value);
                setErrors((prev) => ({ ...prev, address: undefined }));
              }}
            />
            <TextField
              label="City"
              type="text"
              autoComplete="address-level2"
              value={city}
              error={errors.city}
              onChange={(e) => {
                setCity(e.target.value);
                setErrors((prev) => ({ ...prev, city: undefined }));
              }}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Placing order..." : "Place order"}
            </button>
          </form>

          <section aria-label="Order summary" className="md:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-lg font-medium">Order summary</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {cart.items.map((item) => (
                  <li key={item.product_id} className="flex justify-between gap-3 py-2">
                    <span>{`${item.name} x ${item.quantity}`}</span>
                    <span>{formatCents(item.unit_price_cents * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold">
                <span>Total</span>
                <span>{formatCents(cart.total_cents)}</span>
              </div>
              <Link to="/cart" className="mt-3 inline-block text-sm text-sky-600 hover:underline">
                Edit cart
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
