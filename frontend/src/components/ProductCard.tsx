import { Link } from "react-router-dom";
import type { Product } from "../api/products";
import { formatCents } from "../lib/money";
import StockBadge from "./StockBadge";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link to={`/products/${encodeURIComponent(product.slug)}`} className="flex flex-1 flex-col">
        <div
          aria-hidden="true"
          className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-4xl font-semibold text-slate-300"
        >
          {product.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          {product.category && (
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {product.category.name}
            </span>
          )}
          <h3 className="font-medium text-slate-900">{product.name}</h3>
          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="text-lg font-semibold">{formatCents(product.price_cents)}</span>
            <StockBadge stock={product.stock} />
          </div>
        </div>
      </Link>
    </li>
  );
}
