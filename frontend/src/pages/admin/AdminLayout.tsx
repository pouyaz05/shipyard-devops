import { NavLink, Outlet } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 pb-2 text-sm font-medium ${
    isActive
      ? "border-sky-600 text-sky-600"
      : "border-transparent text-slate-600 hover:text-sky-600"
  }`;

export default function AdminLayout() {
  return (
    <div>
      <nav aria-label="Admin" className="mb-6 flex gap-6 border-b border-slate-200">
        <NavLink to="/admin/products" className={tabClass}>
          Products
        </NavLink>
        <NavLink to="/admin/orders" className={tabClass}>
          Orders
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
