import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import AuthBackground from "./AuthBackground";
import { KeyRound } from "lucide-react";

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const redirectUrl =
        "https://epic-hofstadter5-tlhmq.dev-2.tempolabs.ai/auth/callback?type=recovery";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      console.log("Reset password email sent to:", email);
      console.log("Using redirect URL:", redirectUrl);

      // Log the full redirect URL for debugging
      console.log(
        "Redirect URL:",
        `${window.location.origin}/auth/callback?type=recovery`,
      );

      if (error) throw error;
      setMessage("Check your email for the password reset link!");
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
            <KeyRound size={32} />
          </div>
        </div>

        <div className="max-w-md w-full mx-auto space-y-8 p-6 backdrop-blur-sm bg-white/90 shadow-xl rounded-lg border-0">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Reset Password</h2>
            <p className="text-muted-foreground mt-2">
              Enter your email to receive a password reset link
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/50"
              />
            </div>

            {message && (
              <p className="text-sm text-center text-muted-foreground">
                {message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Button
                variant="link"
                className="p-0"
                onClick={() => navigate("/login")}
              >
                Sign in
              </Button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
