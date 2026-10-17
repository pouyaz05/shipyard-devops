import { api } from "./client";
import { normalizeProduct, type Product } from "./products";

export interface AdminProduct extends Product {
  sku: string;
  image_url: string;
  is_active: boolean;
}

export interface ProductInput {
  name: string;
  sku: string;
  price_cents: number;
  stock: number;
  category: string | null;
  image_url: string | null;
  description: string;
  is_active: boolean;
}

export interface AdminProductPage {
  items: AdminProduct[];
  total: number;
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

export function normalizeAdminProduct(value: unknown): AdminProduct {
  const raw = asRecord(value);
  return {
    ...normalizeProduct(value),
    sku: String(raw.sku ?? ""),
    image_url: typeof raw.image_url === "string" ? raw.image_url : "",
    is_active: raw.is_active === undefined ? true : Boolean(raw.is_active),
  };
}

export async function listAdminProducts(
  params: { page: number; pageSize: number },
  signal?: AbortSignal,
): Promise<AdminProductPage> {
  const query = new URLSearchParams({
    include_inactive: "true",
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  const data = await api.get<unknown>(`${BASE}/products?${query.toString()}`, {
    auth: true,
    signal,
  });
  const items = extractItems(data).map(normalizeAdminProduct);
  const raw = asRecord(data);
  return { items, total: toNumber(raw.total ?? raw.count, items.length) };
}

export async function getAdminProduct(id: string, signal?: AbortSignal): Promise<AdminProduct> {
  const data = await api.get<unknown>(`${BASE}/products/${encodeURIComponent(id)}`, {
    auth: true,
    signal,
  });
  return normalizeAdminProduct(data);
}

export async function createProduct(input: ProductInput): Promise<void> {
  await api.post<unknown>(`${BASE}/products`, input, { auth: true });
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  await api.patch<unknown>(`${BASE}/products/${encodeURIComponent(id)}`, input, { auth: true });
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete<unknown>(`${BASE}/products/${encodeURIComponent(id)}`, { auth: true });
}
