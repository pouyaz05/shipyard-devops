import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium hover:text-sky-600 ${
    isActive ? "text-sky-600" : "text-slate-600"
  }`;

export default function Layout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Shipyard
          </Link>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <NavLink to="/products" className={linkClass}>
              Products
            </NavLink>
            {!isLoading &&
              (user ? (
                <>
                  <NavLink to="/account" className={linkClass}>
                    <span className="inline-block max-w-[12rem] truncate align-bottom">
                      {user.email}
                    </span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-sm font-medium text-slate-600 hover:text-sky-600"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={linkClass}>
                    Login
                  </NavLink>
                  <NavLink to="/register" className={linkClass}>
                    Register
                  </NavLink>
                </>
              ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Shipyard. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
