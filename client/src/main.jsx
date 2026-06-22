import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Layout from './Components/Layout/Layout';
import Home from './Components/Home/Home';
import Dashboard from './Components/Admin/Dashboard';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './Redux/Store/Store';
import ErrorBoundary, { RouteError } from './Components/ErrorBoundary/ErrorKit';
import NotFoundPremium from './Components/ErrorBoundary/NotFoundPremium';
import EmployeeDashboard from './Components/Employee/Dashboard';
import RegisterForm from './Components/Register/Register';
import MarketingDashboard from './Components/Marketing/Dashboard';
import EcommerceHomePage from './Components/test/Admin';
import CustomerServiceReport from './Components/Admin/ServiceReport';
import { installSessionExpiryInterceptors } from './Components/Auth/sessionEvents';

installSessionExpiryInterceptors();


const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: '*', element: <NotFoundPremium /> },
      { path: '/', element: <Home /> },
      { path: '/login', element: <Home /> },
      { path: 'admin', element: <Dashboard /> },
      { path: 'employee', element: <EmployeeDashboard /> },
      { path: 'marketing', element: <MarketingDashboard /> },
      { path: 'crm', element: <RegisterForm /> },
  
      
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </PersistGate>
    </Provider>
  </StrictMode>
);
