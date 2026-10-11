import { api } from "./client";

export interface Category {
  slug: string;
  name: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  stock: number;
  category: Category | null;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListParams {
  q?: string;
  category?: string;
  page: number;
  pageSize: number;
}

// Relative path only: never a full URL.
const BASE = "/api/product-service";

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value && typeof value === "object" ? (value as Raw) : {};
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const raw = asRecord(data);
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.results)) return raw.results;
  return [];
}

function normalizeCategory(value: unknown): Category | null {
  if (typeof value === "string") return value ? { slug: value, name: value } : null;
  const raw = asRecord(value);
  const name = String(raw.name ?? raw.slug ?? "");
  if (!name) return null;
  return { slug: String(raw.slug ?? name), name };
}

export function normalizeProduct(value: unknown): Product {
  const raw = asRecord(value);
  return {
    id: String(raw.id ?? raw.slug ?? ""),
    slug: String(raw.slug ?? raw.id ?? ""),
    name: String(raw.name ?? ""),
    description: typeof raw.description === "string" ? raw.description : "",
    price_cents: toNumber(raw.price_cents, 0),
    stock: toNumber(raw.stock ?? raw.stock_quantity ?? raw.quantity, 0),
    category: normalizeCategory(raw.category),
  };
}

export async function listProducts(params: ListParams, signal?: AbortSignal): Promise<ProductPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);

  const data = await api.get<unknown>(`${BASE}/products?${query.toString()}`, { signal });
  const items = extractItems(data).map(normalizeProduct);
  const raw = asRecord(data);
  return {
    items,
    total: toNumber(raw.total ?? raw.count, items.length),
    page: toNumber(raw.page, params.page),
    pageSize: toNumber(raw.page_size, params.pageSize),
  };
}

export async function getProduct(slug: string, signal?: AbortSignal): Promise<Product> {
  const data = await api.get<unknown>(`${BASE}/products/${encodeURIComponent(slug)}`, { signal });
  return normalizeProduct(data);
}

export async function listCategories(signal?: AbortSignal): Promise<Category[]> {
  const data = await api.get<unknown>(`${BASE}/categories`, { signal });
  return extractItems(data)
    .map(normalizeCategory)
    .filter((c): c is Category => c !== null);
}
