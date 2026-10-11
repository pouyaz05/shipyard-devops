import { Link } from "react-router-dom";
import { listProducts } from "../api/products";
import ProductGrid from "../components/ProductGrid";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews";
import { useAsyncData } from "../hooks/useAsyncData";

const FEATURED_COUNT = 4;

export default function Home() {
  const { state, reload } = useAsyncData(
    (signal) => listProducts({ page: 1, pageSize: FEATURED_COUNT }, signal),
    [],
  );

  return (
    <>
      <section className="py-12 text-center sm:py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Electronic parts for makers
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          ESP32 boards, sensors and modules for your next build.
        </p>
        <Link
          to="/products"
          className="mt-8 inline-block rounded bg-sky-600 px-6 py-3 text-sm font-medium text-white hover:bg-sky-700"
        >
          Browse products
        </Link>
      </section>

      <section aria-labelledby="featured-heading">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="featured-heading" className="text-xl font-semibold">
            Featured products
          </h2>
          <Link to="/products" className="text-sm text-sky-600 hover:underline">
            View all
          </Link>
        </div>
        {state.kind === "loading" && <LoadingState label="Loading products..." />}
        {state.kind === "error" && <ErrorState message={state.message} onRetry={reload} />}
        {state.kind === "success" &&
          (state.data.items.length === 0 ? (
            <EmptyState title="No products yet" hint="Check back soon." />
          ) : (
            <ProductGrid products={state.data.items} />
          ))}
      </section>
    </>
  );
}
