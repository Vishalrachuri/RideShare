import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import DriverDashboard from "@/pages/DriverDashboard";
import PassengerDashboard from "@/pages/PassengerDashboard";
import { useNavigate } from "react-router-dom";

const DashboardRouter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userType, setUserType] = React.useState<"driver" | "passenger" | null>(
    null,
  );
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
          setLoading(false);
          return;
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
            const defaultType = "passenger";
            console.log("Creating new user with type:", defaultType);

            const { error: createError } = await supabase.from("users").insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name,
            });

            if (createError) {
              console.error("Error creating user:", createError);
              throw createError;
            }

            setUserType(defaultType);
            console.log("Successfully created user with type:", defaultType);
          } else {
            console.error("Error fetching user:", userError);
            throw userError;
          }
        } else if (userData) {
          console.log("Found existing user");
          setUserType("passenger"); // Default to passenger
        }
      } catch (error) {
        console.error("Error in fetchUserType:", error);
        await supabase.auth.signOut();
        navigate("/login");
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
  }, [user, navigate]);

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

  // Return the appropriate dashboard based on user type
  return userType === "driver" ? <DriverDashboard /> : <PassengerDashboard />;
};

export default DashboardRouter;
