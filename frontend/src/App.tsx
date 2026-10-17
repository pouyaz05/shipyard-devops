import { Navigate, Route, Routes } from "react-router-dom";
import AdminRoute from "./auth/AdminRoute";
import ProtectedRoute from "./auth/ProtectedRoute";
import Layout from "./components/Layout";
import Account from "./pages/Account";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProductEdit from "./pages/admin/AdminProductEdit";
import AdminProducts from "./pages/admin/AdminProducts";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import Register from "./pages/Register";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:slug" element={<ProductDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="cart"
          element={
            <ProtectedRoute>
              <Cart />
            </ProtectedRoute>
          }
        />
        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route path="admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductEdit />} />
            <Route path="products/:id" element={<AdminProductEdit />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
