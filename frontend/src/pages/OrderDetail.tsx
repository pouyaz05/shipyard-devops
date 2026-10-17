import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cancelOrder, getOrder, payOrder, type Order } from "../api/orders";
import { useApiError } from "../auth/useApiError";
import { useLogoutOnUnauthorized } from "../auth/useLogoutOnUnauthorized";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDate } from "../lib/date";
import { formatCents } from "../lib/money";
import OrderStatusBadge from "../orders/OrderStatusBadge";
import { isPendingPayment } from "../orders/status";

export default function OrderDetail() {
  const { id = "" } = useParams();
  const { state, reload } = useAsyncData((signal) => getOrder(id, signal), [id]);
  useLogoutOnUnauthorized(state);
  const handleError = useApiError();

  // After paying/cancelling we re-read the order and keep it here, so the page doesn't flash a loader.
  const [updated, setUpdated] = useState<Order | null>(null);
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setUpdated(null);
    setActionError(null);
  }, [id]);

  if (state.kind === "loading") return <LoadingState label="Loading order..." />;

  if (state.kind === "error") {
    if (state.httpStatus === 404) {
      return (
        <EmptyState title="Order not found" hint="This order doesn't exist or isn't yours.">
          <Link to="/orders" className="text-sm text-sky-600 hover:underline">
            Back to orders
          </Link>
        </EmptyState>
      );
    }
    return <ErrorState message={state.message} onRetry={reload} />;
  }

  const order = updated ?? state.data;

  async function run(kind: "pay" | "cancel", action: () => Promise<void>, conflictMessage: string) {
    setBusy(kind);
    setActionError(null);
    try {
      await action();
      setUpdated(await getOrder(order.id));
    } catch (err) {
      setActionError(handleError(err, conflictMessage));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article>
      <Link to="/orders" className="text-sm text-sky-600 hover:underline">
        &larr; Back to orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{`Order #${order.id}`}</h1>
          <p className="text-sm text-slate-500">{`Placed on ${formatDate(order.created_at)}`}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <ul
        aria-label="Order items"
        className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white"
      >
        {order.items.map((item) => (
          <li key={item.product_id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="text-sm text-slate-500">{`${item.quantity} x ${formatCents(item.unit_price_cents)}`}</p>
            </div>
            <p className="font-medium">{formatCents(item.unit_price_cents * item.quantity)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
        <span className="text-lg font-medium">Total</span>
        <span className="text-2xl font-semibold">{formatCents(order.total_cents)}</span>
      </div>

      <section aria-labelledby="shipping-heading" className="mt-6">
        <h2 id="shipping-heading" className="mb-2 text-lg font-medium">
          Shipping address
        </h2>
        <dl className="grid max-w-md grid-cols-[6rem_1fr] gap-y-1 text-sm">
          <dt className="font-medium text-slate-500">Name</dt>
          <dd>{order.shipping.name}</dd>
          <dt className="font-medium text-slate-500">Address</dt>
          <dd>{order.shipping.address}</dd>
          <dt className="font-medium text-slate-500">City</dt>
          <dd>{order.shipping.city}</dd>
        </dl>
      </section>

      {isPendingPayment(order.status) && (
        <div className="mt-6 max-w-xs">
          {actionError && (
            <div
              role="alert"
              className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {actionError}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void run("pay", () => payOrder(order.id), "This order can't be paid right now.")}
              disabled={busy !== null}
              className="flex-1 rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "pay" ? "Paying..." : "Pay now"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Cancel this order? This cannot be undone.")) {
                  void run(
                    "cancel",
                    () => cancelOrder(order.id),
                    "This order can no longer be cancelled.",
                  );
                }
              }}
              disabled={busy !== null}
              className="flex-1 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "cancel" ? "Cancelling..." : "Cancel order"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Payment is simulated. No real charge is made.</p>
        </div>
      )}

      {order.status === "paid" && (
        <p className="mt-6 text-sm text-green-700">Payment received. Thank you!</p>
      )}
    </article>
  );
}
