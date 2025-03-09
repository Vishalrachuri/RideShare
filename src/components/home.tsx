import React from "react";
import Header from "./Header";
import MapView from "./MapView";
import MainDrawer from "./MainDrawer";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import MatchingDebugLink from "./MatchingDebugLink";

interface HomeProps {
  userName?: string;
  userAvatar?: string;
  userType?: "driver" | "passenger";
}

const Home = ({
  userName = "John Doe",
  userAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=default",
  userType = "passenger",
}: HomeProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeRide, setActiveRide] = React.useState<any>(null);

  React.useEffect(() => {
    // Check for active rides
    const checkActiveRides = async () => {
      if (!user) return;

      try {
        setLoading(true);

        if (userType === "passenger") {
          // Check for passenger active rides
          const { data, error } = await supabase
            .from("ride_requests")
            .select("*, ride:ride_id(*)")
            .eq("rider_id", user.id)
            .in("status", [
              "accepted",
              "driver_accepted",
              "in_progress",
              "pickup_pending",
              "picked_up",
            ])
            .order("scheduled_time", { ascending: true })
            .maybeSingle();

          if (error) throw error;
          if (data) setActiveRide(data);
        } else if (userType === "driver") {
          // Check for driver active rides
          const { data, error } = await supabase
            .from("rides")
            .select("*")
            .eq("driver_id", user.id)
            .in("status", ["pending", "accepted", "in_progress"])
            .order("scheduled_time", { ascending: true })
            .maybeSingle();

          if (error) throw error;
          if (data) setActiveRide(data);
        }
      } catch (error) {
        console.error("Error checking active rides:", error);
      } finally {
        setLoading(false);
      }
    };

    checkActiveRides();

    // Subscribe to changes in ride status
    const rideChannel =
      userType === "passenger"
        ? supabase
            .channel(`passenger_rides_${user?.id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "ride_requests",
                filter: `rider_id=eq.${user?.id}`,
              },
              (payload) => {
                if (["UPDATE", "INSERT"].includes(payload.eventType)) {
                  checkActiveRides();

                  // Show toast notification for status changes
                  if (
                    payload.eventType === "UPDATE" &&
                    payload.new.status !== payload.old.status &&
                    ["accepted", "in_progress", "picked_up"].includes(
                      payload.new.status,
                    )
                  ) {
                    toast({
                      title: `Ride ${payload.new.status.replace("_", " ")}`,
                      description: getStatusDescription(payload.new.status),
                    });
                  }
                }
              },
            )
            .subscribe()
        : supabase
            .channel(`driver_rides_${user?.id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "rides",
                filter: `driver_id=eq.${user?.id}`,
              },
              checkActiveRides,
            )
            .subscribe();

    return () => {
      supabase.removeChannel(rideChannel);
    };
  }, [user, userType, toast]);

  // Helper to get description for ride status
  const getStatusDescription = (status: string) => {
    switch (status) {
      case "accepted":
        return "A driver has been matched with your ride request!";
      case "in_progress":
        return "Your ride has started. The driver is on the way.";
      case "picked_up":
        return "The driver has picked you up. Enjoy your ride!";
      default:
        return `Your ride status has been updated to ${status.replace("_", " ")}.`;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MainDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userType={userType}
      />
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
        <div className="absolute top-20 right-4 z-10">
          <MatchingDebugLink />
        </div>
        <MapView
          userType={userType}
          center={{ lat: 33.2148, lng: -97.1331 }} // Denton, TX
          zoom={12}
          activeRide={activeRide}
          onMapClick={(coords) => {
            console.log("Map clicked at:", coords);
          }}
        />
      </main>
    </div>
  );
};

export default Home;
