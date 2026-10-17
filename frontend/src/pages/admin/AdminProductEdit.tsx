import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createProduct,
  getAdminProduct,
  updateProduct,
  type AdminProduct,
  type ProductInput,
} from "../../api/adminProducts";
import { listCategories } from "../../api/products";
import ProductForm from "../../admin/ProductForm";
import { useApiError } from "../../auth/useApiError";
import { useLogoutOnUnauthorized } from "../../auth/useLogoutOnUnauthorized";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { useAsyncData } from "../../hooks/useAsyncData";
import { loadErrorMessage } from "../../lib/errors";

export default function AdminProductEdit() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const handleError = useApiError();

  const { state, reload } = useAsyncData<AdminProduct | null>(
    (signal) => (id ? getAdminProduct(id, signal) : Promise.resolve(null)),
    [id],
  );
  useLogoutOnUnauthorized(state);
  const categories = useAsyncData((signal) => listCategories(signal), []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: ProductInput) {
    setSaving(true);
    setError(null);
    try {
      if (id) await updateProduct(id, input);
      else await createProduct(input);
      navigate("/admin/products");
    } catch (err) {
      setError(handleError(err, "A product with this SKU already exists."));
      setSaving(false);
    }
  }

  const categoryNames =
    categories.state.kind === "success" ? categories.state.data.map((c) => c.name) : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{isEdit ? "Edit product" : "New product"}</h1>

      {state.kind === "loading" && <LoadingState label="Loading product..." />}

      {state.kind === "error" &&
        (state.httpStatus === 404 ? (
          <EmptyState title="Product not found" hint="This product doesn't exist anymore.">
            <Link to="/admin/products" className="text-sm text-sky-600 hover:underline">
              Back to products
            </Link>
          </EmptyState>
        ) : (
          <ErrorState message={loadErrorMessage(state.message, state.httpStatus)} onRetry={reload} />
        ))}

      {state.kind === "success" && (
        <ProductForm
          key={id ?? "new"}
          initial={state.data ?? undefined}
          categories={categoryNames}
          submitting={saving}
          error={error}
          submitLabel={isEdit ? "Save changes" : "Create product"}
          onSubmit={(input) => void handleSubmit(input)}
        />
      )}
    </div>
  );
}
