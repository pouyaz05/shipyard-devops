import { useState } from "react";
import { listAdminOrders, setAdminOrderStatus, type AdminOrder } from "../../api/adminOrders";
import { useApiError } from "../../auth/useApiError";
import { useLogoutOnUnauthorized } from "../../auth/useLogoutOnUnauthorized";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatDate } from "../../lib/date";
import { loadErrorMessage } from "../../lib/errors";
import { formatCents } from "../../lib/money";
import OrderStatusBadge from "../../orders/OrderStatusBadge";

const FILTERS = [
  { value: "", label: "All statuses" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "paid", label: "Paid" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const NEXT: Record<string, { status: string; label: string }> = {
  paid: { status: "shipped", label: "Mark as shipped" },
  shipped: { status: "delivered", label: "Mark as delivered" },
};

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState("");
  const { state, reload } = useAsyncData(
    (signal) => listAdminOrders(statusFilter, signal),
    [statusFilter],
  );
  useLogoutOnUnauthorized(state);
  const handleError = useApiError();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function changeStatus(order: AdminOrder, status: string) {
    setBusyId(order.id);
    setActionError(null);
    try {
      await setAdminOrderStatus(order.id, status);
      reload();
    } catch (err) {
      setActionError(handleError(err, "This order's status has already changed. Reload and try again."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Manage orders</h1>
        <div>
          <label htmlFor="order-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="order-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      {state.kind === "loading" && <LoadingState label="Loading orders..." />}
      {state.kind === "error" && (
        <ErrorState message={loadErrorMessage(state.message, state.httpStatus)} onRetry={reload} />
      )}
      {state.kind === "success" &&
        (state.data.length === 0 ? (
          <EmptyState
            title="No orders found"
            hint={statusFilter ? "No orders have this status." : "Orders will show up here."}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...state.data]
                  .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
                  .map((order) => {
                    const next = NEXT[order.status];
                    return (
                      <tr key={order.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{`Order #${order.id}`}</td>
                        <td className="px-4 py-3">{order.customer || "-"}</td>
                        <td className="px-4 py-3">{formatDate(order.created_at)}</td>
                        <td className="px-4 py-3">{formatCents(order.total_cents)}</td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {next ? (
                            <button
                              type="button"
                              aria-label={`Mark order #${order.id} as ${next.status}`}
                              disabled={busyId === order.id}
                              onClick={() => void changeStatus(order, next.status)}
                              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {next.label}
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
