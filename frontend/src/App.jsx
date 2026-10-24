// Маршруты приложения. Заглушки заменяются реальными страницами по этапам.
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireRole from './components/RequireRole.jsx';
import AddProductPage from './pages/AddProductPage.jsx';
import CalculatorPage from './pages/CalculatorPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ManagerOrderPage from './pages/ManagerOrderPage.jsx';
import ManagerPage from './pages/ManagerPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import OrderPage from './pages/OrderPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

const customerOnly = (el) => <RequireRole roles={['customer']}>{el}</RequireRole>;
const staffOnly = (el) => <RequireRole roles={['manager', 'admin']}>{el}</RequireRole>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
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
        <Route path="*" element={<NotFoundPage />} />
        <Route path="profile" element={<RequireRole><ProfilePage /></RequireRole>} />
      </Route>
    </Routes>
  );
}