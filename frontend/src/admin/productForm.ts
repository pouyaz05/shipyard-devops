import type { AdminProduct, ProductInput } from "../api/adminProducts";
import { centsToDollarInput, dollarsToCents } from "../lib/money";

export interface ProductFormValues {
  name: string;
  sku: string;
  price: string; // dollars, e.g. "9.99"
  stock: string;
  category: string;
  image_url: string;
  description: string;
  is_active: boolean;
}

export type ProductFormErrors = Partial<
  Record<"name" | "sku" | "price" | "stock" | "image_url", string>
>;

export function toFormValues(product?: AdminProduct): ProductFormValues {
  if (!product) {
    return {
      name: "",
      sku: "",
      price: "",
      stock: "",
      category: "",
      image_url: "",
      description: "",
      is_active: true,
    };
  }
  return {
    name: product.name,
    sku: product.sku,
    price: centsToDollarInput(product.price_cents),
    stock: String(product.stock),
    category: product.category?.name ?? "",
    image_url: product.image_url,
    description: product.description,
    is_active: product.is_active,
  };
}

export function validateProduct(values: ProductFormValues): {
  errors: ProductFormErrors;
  input: ProductInput | null;
} {
  const errors: ProductFormErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = "Name is required.";

  const sku = values.sku.trim();
  if (!sku) errors.sku = "SKU is required.";

  const priceCents = dollarsToCents(values.price);
  if (priceCents === null) errors.price = "Enter a price like 9.99.";

  const stockText = values.stock.trim();
  const stock = /^\d+$/.test(stockText) ? Number(stockText) : null;
  if (stock === null || !Number.isSafeInteger(stock)) {
    errors.stock = "Stock must be a whole number (0 or more).";
  }

  const imageUrl = values.image_url.trim();
  if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) {
    errors.image_url = "Image URL must start with http:// or https://.";
  }

  if (Object.keys(errors).length > 0 || priceCents === null || stock === null) {
    return { errors, input: null };
  }

  return {
    errors,
    input: {
      name,
      sku,
      price_cents: priceCents,
      stock,
      category: values.category.trim() || null,
      image_url: imageUrl || null,
      description: values.description.trim(),
      is_active: values.is_active,
    },
  };
}
