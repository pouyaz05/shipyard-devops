import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../cart/CartContext";
import { cartErrorMessage } from "../cart/messages";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { formatCents } from "../lib/money";

export default function Cart() {
  const { cart, status, error, refresh, setQuantity, removeItem } = useCart();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(productId: string, action: () => Promise<void>) {
    setBusyId(productId);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(cartErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Your cart</h1>

      {(status === "idle" || status === "loading") && <LoadingState label="Loading your cart..." />}

      {status === "error" && (
        <ErrorState message={error ?? "Could not load your cart."} onRetry={() => void refresh()} />
      )}

      {status === "ready" && cart.items.length === 0 && (
        <EmptyState title="Your cart is empty" hint="Add some products to get started.">
          <Link
            to="/products"
            className="inline-block rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Browse products
          </Link>
        </EmptyState>
      )}

      {status === "ready" && cart.items.length > 0 && (
        <>
          {actionError && (
            <div
              role="alert"
              className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {actionError}
            </div>
          )}

          <ul
            aria-label="Cart items"
            className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white"
          >
            {cart.items.map((item) => {
              const busy = busyId === item.product_id;
              return (
                <li
                  key={item.product_id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{`${formatCents(item.unit_price_cents)} each`}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.name}`}
                        disabled={busy || item.quantity <= 1}
                        onClick={() =>
                          run(item.product_id, () => setQuantity(item.product_id, item.quantity - 1))
                        }
                        className="h-8 w-8 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="w-8 text-center tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.name}`}
                        disabled={busy}
                        onClick={() =>
                          run(item.product_id, () => setQuantity(item.product_id, item.quantity + 1))
                        }
                        className="h-8 w-8 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                    <p className="w-24 text-right font-medium">
                      {formatCents(item.unit_price_cents * item.quantity)}
                    </p>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      disabled={busy}
                      onClick={() => run(item.product_id, () => removeItem(item.product_id))}
                      className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <span className="text-lg font-medium">Total</span>
            <span className="text-2xl font-semibold">{formatCents(cart.total_cents)}</span>
          </div>

          <div className="mt-4 flex justify-end">
            <Link
              to="/checkout"
              className="rounded bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
            >
              Proceed to checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
