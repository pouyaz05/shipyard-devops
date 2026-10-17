import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AdminProduct, ProductInput } from "../api/adminProducts";
import TextField from "../components/TextField";
import {
  toFormValues,
  validateProduct,
  type ProductFormErrors,
  type ProductFormValues,
} from "./productForm";

interface ProductFormProps {
  initial?: AdminProduct;
  categories: string[];
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (input: ProductInput) => void;
}

export default function ProductForm({
  initial,
  categories,
  submitting,
  error,
  submitLabel,
  onSubmit,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>(() => toFormValues(initial));
  const [errors, setErrors] = useState<ProductFormErrors>({});

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as keyof ProductFormErrors];
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateProduct(values);
    setErrors(result.errors);
    if (result.input) onSubmit(result.input);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <TextField
        label="Name"
        type="text"
        value={values.name}
        error={errors.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <TextField
        label="SKU"
        type="text"
        value={values.sku}
        error={errors.sku}
        onChange={(e) => set("sku", e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Price (USD)"
          type="text"
          inputMode="decimal"
          placeholder="9.99"
          value={values.price}
          error={errors.price}
          onChange={(e) => set("price", e.target.value)}
        />
        <TextField
          label="Stock"
          type="text"
          inputMode="numeric"
          value={values.stock}
          error={errors.stock}
          onChange={(e) => set("stock", e.target.value)}
        />
      </div>
      <TextField
        label="Category"
        type="text"
        list="product-categories"
        value={values.category}
        onChange={(e) => set("category", e.target.value)}
      />
      <datalist id="product-categories">
        {categories.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <TextField
        label="Image URL"
        type="text"
        inputMode="url"
        placeholder="https://..."
        value={values.image_url}
        error={errors.image_url}
        onChange={(e) => set("image_url", e.target.value)}
      />
      <div>
        <label htmlFor="product-description" className="mb-1 block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="product-description"
          rows={4}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={(e) => set("is_active", e.target.checked)}
        />
        Active
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        <Link to="/admin/products" className="text-sm text-slate-600 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
