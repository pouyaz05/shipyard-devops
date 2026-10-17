import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Product } from "../api/products";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "./CartContext";
import { cartErrorMessage } from "./messages";

type AddState =
  | { kind: "idle" }
  | { kind: "adding" }
  | { kind: "added" }
  | { kind: "error"; message: string };

export default function AddToCartButton({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const { user, isLoading } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<AddState>({ kind: "idle" });

  const outOfStock = product.stock <= 0;

  async function handleClick() {
    if (!user) {
      // Send the user to /login and bring them back to this page (including ?search) afterwards.
      navigate("/login", {
        state: { from: { pathname: `${location.pathname}${location.search}` } },
      });
      return;
    }
    setState({ kind: "adding" });
    try {
      await addItem(product.id, 1);
      setState({ kind: "added" });
    } catch (err) {
      setState({ kind: "error", message: cartErrorMessage(err) });
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={outOfStock || isLoading || state.kind === "adding"}
        className="w-full rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {outOfStock ? "Unavailable" : state.kind === "adding" ? "Adding..." : "Add to cart"}
      </button>
      {state.kind === "added" && (
        <p role="status" className="mt-1 text-xs text-green-700">
          Added to cart.{" "}
          <Link to="/cart" className="underline">
            View cart
          </Link>
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {state.message}
        </p>
      )}
    </div>
  );
}
