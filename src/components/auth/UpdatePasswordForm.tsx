import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import AuthBackground from "./AuthBackground";
import { Lock } from "lucide-react";

export function UpdatePasswordForm() {
  console.log("Update password form mounted");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Get the token from the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const type = hashParams.get("type");

    console.log("URL hash:", window.location.hash);
    console.log("Access token from hash:", accessToken);

    const setupSession = async () => {
      try {
        if (accessToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          });

          if (error) {
            console.error("Error setting session:", error);
            navigate("/login");
            return;
          }

          if (!data.session) {
            navigate("/login");
          }
        } else {
          // Check if we already have a session
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            navigate("/login");
          }
        }
      } catch (error) {
        console.error("Session setup error:", error);
        navigate("/login");
      }
    };

    setupSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setMessage("Password updated successfully!");

      // Sign out the user and redirect to login
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 2000);
    } catch (error) {
      setMessage(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <AuthBackground />

      <div className="w-full max-w-md z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-primary text-primary-foreground p-3 rounded-full">
            <Lock size={32} />
          </div>
        </div>

        <div className="max-w-md w-full mx-auto space-y-8 p-6 backdrop-blur-sm bg-white/90 shadow-xl rounded-lg border-0">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Update Password</h2>
            <p className="text-muted-foreground mt-2">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/50"
              />
            </div>

            {message && (
              <p className="text-sm text-center text-muted-foreground">
                {message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
