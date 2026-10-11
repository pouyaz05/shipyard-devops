import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { listCategories, listProducts, type Category } from "../api/products";
import ProductGrid from "../components/ProductGrid";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { useAsyncData } from "../hooks/useAsyncData";

const PAGE_SIZE = 12;

function parsePage(value: string | null): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const page = parsePage(searchParams.get("page"));

  const [searchText, setSearchText] = useState(q);
  useEffect(() => {
    setSearchText(q);
  }, [q]);

  const catalog = useAsyncData(
    (signal) => listProducts({ q, category, page, pageSize: PAGE_SIZE }, signal),
    [q, category, page],
  );
  const categories = useAsyncData((signal) => listCategories(signal), []);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    update({ q: searchText.trim() || null, page: null });
  }

  function clearFilters() {
    setSearchParams({});
  }

  const loadedCategories: Category[] =
    categories.state.kind === "success" ? categories.state.data : [];
  const categoryOptions =
    category && !loadedCategories.some((c) => c.slug === category)
      ? [...loadedCategories, { slug: category, name: category }]
      : loadedCategories;

  const hasFilters = q !== "" || category !== "" || page > 1;
  const { state } = catalog;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Products</h1>

      <form role="search" onSubmit={handleSearch} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 gap-2">
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <input
            id="product-search"
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search products"
            className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Search
          </button>
        </div>
        <div>
          <label htmlFor="product-category" className="sr-only">
            Category
          </label>
          <select
            id="product-category"
            value={category}
            onChange={(e) => update({ category: e.target.value || null, page: null })}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500 sm:w-48"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      {state.kind === "loading" && <LoadingState label="Loading products..." />}
      {state.kind === "error" && <ErrorState message={state.message} onRetry={catalog.reload} />}
      {state.kind === "success" &&
        (state.data.items.length === 0 ? (
          <EmptyState
            title="No products found"
            hint={hasFilters ? "Try a different search or category." : "Check back soon."}
          >
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Clear filters
              </button>
            )}
          </EmptyState>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              {`${state.data.total} ${state.data.total === 1 ? "product" : "products"}`}
            </p>
            <ProductGrid products={state.data.items} />
            {Math.ceil(state.data.total / PAGE_SIZE) > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-8 flex items-center justify-between gap-4"
              >
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : null })}
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
                  onClick={() => update({ page: String(page + 1) })}
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
