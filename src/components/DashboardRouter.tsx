import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import Home from "@/components/home";
import { useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";

const DashboardRouter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userType, setUserType] = React.useState<"driver" | "passenger" | null>(
    null,
  );
  const [userData, setUserData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchUserType = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // First try to get user type from metadata
        if (user.user_metadata?.user_type) {
          setUserType(user.user_metadata.user_type);
          console.log("User type from metadata:", user.user_metadata.user_type);
        }

        // Then check if user exists in users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (userError) {
          if (userError.code === "PGRST116") {
            // User doesn't exist in users table, create them
            // Use the user_type from metadata if available, otherwise default to passenger
            const userType = user.user_metadata?.user_type || "passenger";
            console.log("Creating new user with type:", userType);

            const { error: createError } = await supabase.from("users").insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || "New User",
              user_type: userType,
            });

            if (createError) {
              console.error("Error creating user:", createError);
              throw createError;
            }

            setUserType(userType);
            toast({
              title: "Welcome to Carpooling!",
              description: "Your account has been created successfully.",
              duration: 5000,
            });
          } else {
            console.error("Error fetching user:", userError);
            throw userError;
          }
        } else if (userData) {
          console.log("User data from database:", userData);
          setUserData(userData);
          setUserType(userData.user_type);
        }
      } catch (error) {
        console.error("Error in fetchUserType:", error);
        toast({
          title: "Error",
          description: "There was a problem loading your account information",
          variant: "destructive",
        });

        // Don't log out on error, just set default to passenger
        setUserType("passenger");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchUserType();
    } else {
      const checkSession = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          navigate("/login");
        }
      };
      checkSession();
    }
  }, [user, navigate, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userType) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <p className="text-destructive">Error: User type not found</p>
          <button
            onClick={() => navigate("/login")}
            className="text-primary hover:underline"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  const userName =
    userData?.full_name || user?.user_metadata?.full_name || "User";
  const userAvatar =
    userData?.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`;

  // Return the Home component with user data
  return (
    <>
      <Home userName={userName} userAvatar={userAvatar} userType={userType} />
      <Toaster />
    </>
  );
};

export default DashboardRouter;
