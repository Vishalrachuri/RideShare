import { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { startRideMatchingWorker } from "./lib/rideMatchingWorker";
import {
  useRoutes,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import DashboardRouter from "@/components/DashboardRouter";
import LandingPage from "./components/LandingPage";
import { LoginForm } from "./components/auth/LoginForm";
import { SignUpForm } from "./components/auth/SignUpForm";
import { AuthCallback } from "./components/auth/AuthCallback";
import ApiKeyTest from "./components/ApiKeyTest";
import { ResetPasswordForm } from "./components/auth/ResetPasswordForm";
import { UpdatePasswordForm } from "./components/auth/UpdatePasswordForm";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import RideMatchingDebugPage from "./pages/RideMatchingDebugPage";
import RideMatchingDebugScreen from "./components/RideMatchingDebugScreen";
import routes from "tempo-routes";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  useEffect(() => {
    startRideMatchingWorker();
    return () => {};
  }, []);

  return (
    <AuthProvider>
      <Suspense fallback={<p>Loading...</p>}>
        {import.meta.env.VITE_TEMPO && useRoutes(routes)}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignUpForm />} />
          <Route path="/reset-password" element={<ResetPasswordForm />} />
          <Route path="/update-password" element={<UpdatePasswordForm />} />
          <Route
            path="/reset-password/update"
            element={<UpdatePasswordForm />}
          />
          <Route
            path="/app/*"
            element={
              <PrivateRoute>
                <DashboardRouter />
              </PrivateRoute>
            }
          />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/api-test" element={<ApiKeyTest />} />
          <Route
            path="/debug/ride-matching"
            element={<RideMatchingDebugPage />}
          />
          <Route
            path="/debug/ride-matching/advanced"
            element={<RideMatchingDebugScreen />}
          />
          {/* Tempo routes */}
          {import.meta.env.VITE_TEMPO && (
            <Route path="/tempobook/*" element={<></>} />
          )}
        </Routes>
      </Suspense>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
