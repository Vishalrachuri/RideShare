import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function AuthCallback() {
  console.log("Auth callback mounted");
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Try to exchange the code first if we have a search query
        if (window.location.search) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            window.location.search,
          );
          if (error) throw error;
          if (data.session) {
            navigate("/app");
            return;
          }
        }

        // If no code exchange needed, check for existing session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session) {
          navigate("/app");
          return;
        }

        // No session found
        throw new Error("No session created");
      } catch (error) {
        console.error("Auth callback error:", error);
        navigate("/login");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Verifying your email...</h2>
        <p className="text-muted-foreground">
          Please wait while we confirm your email address.
        </p>
      </div>
    </div>
  );
}
