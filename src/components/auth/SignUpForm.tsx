import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import AuthBackground from "./AuthBackground";
import { UserPlus } from "lucide-react";

export function SignUpForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    userType: "passenger" as "driver" | "passenger",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.fullName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all fields",
      });
      return;
    }
    setLoading(true);

    try {
      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            user_type: formData.userType,
          },
        },
      });

      if (error) throw error;

      if (data?.user) {
        // Create user record
        const { error: userError } = await supabase.from("users").insert({
          id: data.user.id,
          email: formData.email.trim(),
          full_name: formData.fullName,
        });

        if (userError) {
          console.error("Error creating user record:", userError);
          throw userError;
        }

        // Auto sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email.trim(),
          password: formData.password,
        });

        if (signInError) throw signInError;

        toast({
          title: "Account created",
          description: "Welcome to RideShare!",
        });

        navigate("/app");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
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
            <UserPlus size={32} />
          </div>
        </div>

        <div className="w-full max-w-md mx-auto space-y-8 p-6 backdrop-blur-sm bg-white/90 shadow-xl rounded-lg border-0">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="text-muted-foreground mt-2">
              Enter your details to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                required
                className="bg-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                className="bg-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                minLength={6}
                className="bg-white/50"
              />
            </div>

            <div className="space-y-2">
              <Label>I am a</Label>
              <RadioGroup
                value={formData.userType}
                onValueChange={(value: "driver" | "passenger") =>
                  setFormData({ ...formData, userType: value })
                }
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="passenger" id="passenger" />
                  <Label htmlFor="passenger">Passenger</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="driver" id="driver" />
                  <Label htmlFor="driver">Driver</Label>
                </div>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
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
