import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import Layout from './Components/Layout/Layout';
import Home from './Components/Home/Home';
import Dashboard from './Components/Admin/Dashboard';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './Redux/Store/Store';
import ErrorBoundary, { RouteError } from './Components/ErrorBoundary/ErrorKit';
import NotFoundPremium from './Components/ErrorBoundary/NotFoundPremium';
import EmployeeDashboard from './Components/Employee/Dashboard';
import { installSessionExpiryInterceptors } from './Components/Auth/sessionEvents';
import OdooStyleModulesPage from './Components/MainPage/MianPage';
import AccountingCurvedTopBar from './Components/CurvedTopBar/CurvedTopBar';


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
      { path: 'admin/*', element: <Dashboard /> },
      { path: 'employee/*', element: <EmployeeDashboard /> },
      { path: 'crm', element: <Navigate to="/login" replace /> },
      { path: 'module', element: <OdooStyleModulesPage /> },
      { path: 't', element: <AccountingCurvedTopBar /> },
  
      
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
