import { Link, useParams } from "react-router-dom";
import { getProduct } from "../api/products";
import StockBadge from "../components/StockBadge";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatCents } from "../lib/money";

export default function ProductDetail() {
  const { slug = "" } = useParams();
  const { state, reload } = useAsyncData((signal) => getProduct(slug, signal), [slug]);

  if (state.kind === "loading") return <LoadingState label="Loading product..." />;

  if (state.kind === "error") {
    if (state.httpStatus === 404) {
      return (
        <EmptyState
          title="Product not found"
          hint="This product doesn't exist or is no longer available."
        >
          <Link to="/products" className="text-sm text-sky-600 hover:underline">
            Back to products
          </Link>
        </EmptyState>
      );
    }
    return <ErrorState message={state.message} onRetry={reload} />;
  }

  const product = state.data;
  return (
    <article>
      <Link to="/products" className="text-sm text-sky-600 hover:underline">
        &larr; Back to products
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div
          aria-hidden="true"
          className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-7xl font-semibold text-slate-300"
        >
          {product.name.charAt(0).toUpperCase()}
        </div>
        <div>
          {product.category && (
            <p className="text-xs uppercase tracking-wide text-slate-500">{product.category.name}</p>
          )}
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-4 text-2xl font-semibold">{formatCents(product.price_cents)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StockBadge stock={product.stock} />
            {product.stock > 0 && (
              <span className="text-sm text-slate-500">
                {`${product.stock} ${product.stock === 1 ? "unit" : "units"} available`}
              </span>
            )}
          </div>
          <p className="mt-6 whitespace-pre-line text-slate-700">
            {product.description || "No description available."}
          </p>
        </div>
      </div>
    </article>
  );
}
