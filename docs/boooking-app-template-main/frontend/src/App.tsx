import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
  useLocation,
} from "react-router-dom";
import "./styles/style.scss";
import { AuthProvider, useAuth } from "./contexts/authContext";

// pages
import Landing from "./pages/landing/Landing";
import ResetPassword from "./pages/landing/ResetPassword";
import ForgetPassword from "./pages/landing/ForgetPassword";
import Home from "./pages/home/Home";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="appContainer">
          <AppRoutes />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

const AppRoutes = () => {
  const { session, loading, isAuthorized, isUnavailable } = useAuth();

  if (loading) return null;

  if (isUnavailable) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
        <p style={{ color: "#555" }}>Service is currently unavailable. Please try again later.</p>
      </div>
    );
  }

  if (session && !isAuthorized) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "12px", fontFamily: "sans-serif" }}>
        <p style={{ color: "#555" }}>You do not have access to this application.</p>
      </div>
    );
  }

  // LandingProtection — mirrors dblue-office pattern:
  // unauthenticated users see landing pages; authenticated users are redirected to /home
  const LandingProtection = () => {
    const location = useLocation();
    if (!session) return <Outlet />;
    if (location.pathname === "/") return <Navigate to="/home" replace />;
    return <Outlet />;
  };

  // Layout — wrapper for authenticated pages; redirects to / if session lost
  const Layout = () => {
    if (!session) return <Navigate to="/" replace />;
    return <Outlet />;
  };

  return (
    <Routes>
      {/* Public routes — accessible without a session */}
      <Route element={<LandingProtection />}>
        <Route path="/" element={<Landing />} />
        <Route path="/forget/password" element={<ForgetPassword />} />
        <Route path="/reset/password" element={<ResetPassword />} />
      </Route>

      {/* Protected routes — require a valid session */}
      <Route element={<Layout />}>
        <Route path="/home" element={<Home />} />
        {/* Add new application routes here */}
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
