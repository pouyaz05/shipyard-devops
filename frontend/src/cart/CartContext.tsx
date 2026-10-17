import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_CART,
  addCartItem,
  fetchCart,
  removeCartItem,
  updateCartItem,
  type Cart,
} from "../api/cart";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { cartErrorMessage } from "./messages";

type CartStatus = "idle" | "loading" | "ready" | "error";

interface CartContextValue {
  cart: Cart;
  itemCount: number;
  status: CartStatus;
  error: string | null;
  refresh: () => Promise<void>;
  clear: () => void;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const userId = user?.id ?? null;

  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [status, setStatus] = useState<CartStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // An expired/invalid token means the session is over: log out.
  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) logout();
    },
    [logout],
  );

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await fetchCart(signal);
        if (signal?.aborted) return;
        setCart(next);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (signal?.aborted) return;
        handleAuthError(err);
        setStatus("error");
        setError(cartErrorMessage(err));
      }
    },
    [handleAuthError],
  );

  // Load the cart when a user is logged in; clear it on logout.
  useEffect(() => {
    if (userId === null) {
      setCart(EMPTY_CART);
      setStatus("idle");
      setError(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    void refresh(controller.signal);
    return () => controller.abort();
  }, [userId, refresh]);

  const reload = useCallback(() => refresh(), [refresh]);

  // Used after a successful order: the badge drops to zero immediately.
  const clear = useCallback(() => {
    setCart(EMPTY_CART);
    setStatus("ready");
    setError(null);
  }, []);

  // Run a mutation, then re-read the cart so the UI always matches the server.
  const mutate = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } catch (err) {
        handleAuthError(err);
        throw err;
      }
      await refresh();
    },
    [handleAuthError, refresh],
  );

  const addItem = useCallback(
    (productId: string, quantity = 1) => mutate(() => addCartItem(productId, quantity)),
    [mutate],
  );
  const setQuantity = useCallback(
    (productId: string, quantity: number) => mutate(() => updateCartItem(productId, quantity)),
    [mutate],
  );
  const removeItem = useCallback(
    (productId: string) => mutate(() => removeCartItem(productId)),
    [mutate],
  );

  const itemCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount,
      status,
      error,
      refresh: reload,
      clear,
      addItem,
      setQuantity,
      removeItem,
    }),
    [cart, itemCount, status, error, reload, clear, addItem, setQuantity, removeItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
