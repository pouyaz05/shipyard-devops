import { NavLink } from "react-router-dom";
import { useCart } from "./CartContext";

export default function CartLink() {
  const { itemCount } = useCart();
  const label =
    itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Cart";

  return (
    <NavLink
      to="/cart"
      aria-label={label}
      className={({ isActive }) =>
        `relative inline-flex items-center hover:text-sky-600 ${
          isActive ? "text-sky-600" : "text-slate-600"
        }`
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -right-3 -top-2 min-w-[1.25rem] rounded-full bg-sky-600 px-1.5 text-center text-xs font-semibold leading-5 text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </NavLink>
  );
}
