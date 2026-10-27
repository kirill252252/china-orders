// Маршруты приложения.
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireRole from './components/RequireRole.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AddProductPage from './pages/AddProductPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import CalculatorPage from './pages/CalculatorPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ManagerOrderPage from './pages/ManagerOrderPage.jsx';
import ManagerPage from './pages/ManagerPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import OrderPage from './pages/OrderPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DocumentPage from './pages/DocumentPage.jsx';

const customerOnly = (el) => <RequireRole roles={['customer']}>{el}</RequireRole>;
const staffOnly = (el) => <RequireRole roles={['manager', 'admin']}>{el}</RequireRole>;

// Покупателю личный каталог заменила корзина: старые ссылки на /catalog ведут туда
function CatalogRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role === 'customer') return <Navigate to="/cart" replace />;
  return <CatalogPage />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="docs" element={<DocumentPage />} />
        <Route path="docs/:slug" element={<DocumentPage />} />
        <Route path="catalog" element={<CatalogRoute />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="products/:id" element={<ProductPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="add" element={<RequireRole><AddProductPage /></RequireRole>} />
        <Route path="cart" element={customerOnly(<CartPage />)} />
        <Route path="checkout" element={customerOnly(<CheckoutPage />)} />
        <Route path="orders" element={customerOnly(<OrdersPage />)} />
        <Route path="orders/:id" element={customerOnly(<OrderPage />)} />
        <Route path="manager" element={staffOnly(<ManagerPage />)} />
        <Route path="manager/orders/:id" element={staffOnly(<ManagerOrderPage />)} />
        <Route path="admin" element={<RequireRole roles={['admin']}><AdminPage /></RequireRole>} />
        <Route path="profile" element={<RequireRole><ProfilePage /></RequireRole>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}