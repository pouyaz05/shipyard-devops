import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteProduct, listAdminProducts, type AdminProduct } from "../../api/adminProducts";
import { useApiError } from "../../auth/useApiError";
import { useLogoutOnUnauthorized } from "../../auth/useLogoutOnUnauthorized";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { useAsyncData } from "../../hooks/useAsyncData";
import { loadErrorMessage } from "../../lib/errors";
import { formatCents } from "../../lib/money";

const PAGE_SIZE = 20;

export default function AdminProducts() {
  const [page, setPage] = useState(1);
  const { state, reload } = useAsyncData(
    (signal) => listAdminProducts({ page, pageSize: PAGE_SIZE }, signal),
    [page],
  );
  useLogoutOnUnauthorized(state);
  const handleError = useApiError();
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(product: AdminProduct) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeletingId(product.id);
    setActionError(null);
    try {
      await deleteProduct(product.id);
      reload();
    } catch (err) {
      setActionError(
        handleError(err, "This product can't be deleted because it is used elsewhere (for example in orders)."),
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Manage products</h1>
        <Link
          to="/admin/products/new"
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          New product
        </Link>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      {state.kind === "loading" && <LoadingState label="Loading products..." />}
      {state.kind === "error" && (
        <ErrorState message={loadErrorMessage(state.message, state.httpStatus)} onRetry={reload} />
      )}
      {state.kind === "success" &&
        (state.data.items.length === 0 ? (
          <EmptyState
            title="No products yet"
            hint={page > 1 ? "There are no more products." : "Create the first one with the New product button."}
          >
            {page > 1 && (
              <button
                type="button"
                onClick={() => setPage(1)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Back to first page
              </button>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.data.items.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3">
                        <span className="block font-medium text-slate-900">{product.name}</span>
                        <span className="block text-xs text-slate-500">{product.sku}</span>
                      </td>
                      <td className="px-4 py-3">{formatCents(product.price_cents)}</td>
                      <td className="px-4 py-3">{product.stock}</td>
                      <td className="px-4 py-3">
                        {product.is_active ? (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-4">
                          <Link
                            to={`/admin/products/${encodeURIComponent(product.id)}`}
                            aria-label={`Edit ${product.name}`}
                            className="text-sky-600 hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            aria-label={`Delete ${product.name}`}
                            disabled={deletingId === product.id}
                            onClick={() => void handleDelete(product)}
                            className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {Math.ceil(state.data.total / PAGE_SIZE) > 1 && (
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  {`Page ${page} of ${Math.ceil(state.data.total / PAGE_SIZE)}`}
                </span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(state.data.total / PAGE_SIZE)}
                  onClick={() => setPage(page + 1)}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        ))}
    </div>
  );
}
