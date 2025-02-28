import React from "react";
import Header from "./Header";
import MapView from "./MapView";
import MainDrawer from "./MainDrawer";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

interface HomeProps {
  userName?: string;
  userAvatar?: string;
}

const Home = ({
  userName = "John Doe",
  userAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=default",
}: HomeProps) => {
  const { user } = useAuth();
  const [userType, setUserType] = React.useState<"driver" | "passenger">(
    "passenger",
  );
  const [loading, setLoading] = React.useState(true);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    const fetchUserType = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        // First try metadata
        if (user.user_metadata?.user_type) {
          setUserType(user.user_metadata.user_type as "driver" | "passenger");
          setLoading(false);
          return;
        }

        // Then try database
        const { data, error } = await supabase
          .from("users")
          .select("user_type, full_name")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (data?.user_type) {
          console.log("User type:", data.user_type);
          setUserType(data.user_type as "driver" | "passenger");
        } else {
          // Default to passenger if no type found
          setUserType("passenger");
        }
      } catch (error) {
        console.error("Error fetching user type:", error);
        // Default to passenger on error
        setUserType("passenger");
      } finally {
        setLoading(false);
      }
    };

    fetchUserType();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MainDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Header
        userName={userName}
        userAvatar={userAvatar}
        role={userType}
        onProfileClick={() => console.log("Profile clicked")}
        onNotificationsClick={() => console.log("Notifications clicked")}
        onMessagesClick={() => console.log("Messages clicked")}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <main className="pt-16">
        <MapView
          userType={userType}
          center={{ lat: 33.2148, lng: -97.1331 }} // Denton, TX
          zoom={12}
          onMapClick={(coords) => {
            console.log("Map clicked at:", coords);
          }}
        />
      </main>
    </div>
  );
};

export default Home;
