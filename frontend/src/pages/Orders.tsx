import { Link } from "react-router-dom";
import { listOrders } from "../api/orders";
import { useLogoutOnUnauthorized } from "../auth/useLogoutOnUnauthorized";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatDate } from "../lib/date";
import { formatCents } from "../lib/money";
import OrderStatusBadge from "../orders/OrderStatusBadge";

export default function Orders() {
  const { state, reload } = useAsyncData((signal) => listOrders(signal), []);
  useLogoutOnUnauthorized(state);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Your orders</h1>

      {state.kind === "loading" && <LoadingState label="Loading orders..." />}
      {state.kind === "error" && <ErrorState message={state.message} onRetry={reload} />}
      {state.kind === "success" &&
        (state.data.length === 0 ? (
          <EmptyState title="You have no orders yet" hint="Orders you place will show up here.">
            <Link
              to="/products"
              className="inline-block rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Browse products
            </Link>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {[...state.data]
              .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
              .map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/orders/${encodeURIComponent(order.id)}`}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 p-4 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{`Order #${order.id}`}</span>
                    <span className="text-sm text-slate-500">{formatDate(order.created_at)}</span>
                    <span className="font-medium">{formatCents(order.total_cents)}</span>
                    <OrderStatusBadge status={order.status} />
                  </Link>
                </li>
              ))}
          </ul>
        ))}
    </div>
  );
}
