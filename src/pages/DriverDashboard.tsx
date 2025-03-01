import React from "react";
import Header from "@/components/Header";
import MapView from "@/components/MapView";
import MainDrawer from "@/components/MainDrawer";
import DriverPanel from "@/components/DriverPanel";
import OfferRidePanel from "@/components/OfferRidePanel";
import DriverRideScreen from "@/components/DriverRideScreen";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { findPassengersForRide } from "@/lib/rideMatchingUtils";

const DriverDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeRide, setActiveRide] = React.useState<any>(null);
  const [activeRideScreen, setActiveRideScreen] =
    React.useState<boolean>(false);
  const [loading, setLoading] = React.useState(true);
  const [matchingForRide, setMatchingForRide] = React.useState<boolean>(false);

  // Load the driver's active ride
  const loadActiveRide = React.useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .in("status", ["pending", "accepted", "in_progress"])
        .order("scheduled_time", { ascending: true })
        .maybeSingle();

      if (error) throw error;

      if (data) {
        console.log("Active ride loaded:", data);
        setActiveRide(data);

        // If ride is in progress, show the ride screen
        if (data.status === "in_progress") {
          setActiveRideScreen(true);
        }
      } else {
        setActiveRide(null);
        setActiveRideScreen(false);
      }
    } catch (error) {
      console.error("Error loading active ride:", error);
      toast({
        title: "Error",
        description: "Failed to load your active ride",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    loadActiveRide();

    // Subscribe to changes in rides
    const ridesChannel = supabase
      .channel(`driver_rides_${user?.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
          filter: `driver_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log("Ride update received:", payload);
          loadActiveRide();

          // Show notifications for specific status changes
          if (payload.eventType === "UPDATE" && payload.old && payload.new) {
            if (payload.old.status !== payload.new.status) {
              if (payload.new.status === "in_progress") {
                toast({
                  title: "Ride Started",
                  description:
                    "Your ride has started. Navigate to pick up your passengers.",
                });
                setActiveRideScreen(true);
              } else if (payload.new.status === "completed") {
                toast({
                  title: "Ride Completed",
                  description: "Your ride has been completed successfully.",
                });
                setActiveRideScreen(false);
              }
            }
          }
        },
      )
      .subscribe();

    // Subscribe to ride request changes
    const requestsChannel = supabase
      .channel(`driver_ride_requests_${user?.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
        },
        (payload) => {
          // When a new ride request is matched with the driver's ride
          if (
            payload.eventType === "UPDATE" &&
            payload.new.status === "accepted"
          ) {
            // Check if this request is for the current active ride
            if (activeRide && activeRide.id === payload.new.ride_id) {
              toast({
                title: "New Passenger Matched!",
                description: "A new passenger has been matched with your ride.",
              });
              loadActiveRide();
            }
          }
        },
      )
      .subscribe();

    // Clean up
    return () => {
      supabase.removeChannel(ridesChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [user, loadActiveRide, activeRide, toast]);

  // Find matching passengers for the active ride
  const findMatches = async () => {
    if (!activeRide) return;

    try {
      setMatchingForRide(true);

      const result = await findPassengersForRide(activeRide.id);

      if (result.success) {
        if (result.matchCount > 0) {
          toast({
            title: "Success!",
            description: `Found ${result.matchCount} new passenger match${result.matchCount > 1 ? "es" : ""}!`,
          });
          loadActiveRide();
        } else {
          toast({
            title: "No New Matches",
            description:
              "No new matches found at this time. We'll keep searching.",
          });
        }
      } else {
        throw result.error;
      }
    } catch (error) {
      console.error("Error finding matches:", error);
      toast({
        title: "Error",
        description: "Failed to find matching passengers",
        variant: "destructive",
      });
    } finally {
      setMatchingForRide(false);
    }
  };

  // Handle ride start
  const handleRideStart = () => {
    setActiveRideScreen(true);
  };

  // Handle ride completion
  const handleRideComplete = () => {
    setActiveRideScreen(false);
    loadActiveRide();
  };

  return (
    <div className="min-h-screen bg-background">
      <MainDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userType="driver"
      />
      <Header
        userName={user?.user_metadata?.full_name}
        userAvatar={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
        role="driver"
        onProfileClick={() => console.log("Profile clicked")}
        onNotificationsClick={() => console.log("Notifications clicked")}
        onMessagesClick={() => console.log("Messages clicked")}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <main className="pt-16">
        <MapView
          userType="driver"
          center={{ lat: 33.2148, lng: -97.1331 }}
          zoom={12}
          activeRide={activeRide}
          onMapClick={(coords) => {
            console.log("Map clicked at:", coords);
          }}
        />

        {/* Floating Panel */}
        <div className="absolute top-20 left-4 z-10">
          {activeRideScreen && activeRide ? (
            <DriverRideScreen
              className="w-[400px]"
              ride={activeRide}
              onComplete={handleRideComplete}
            />
          ) : activeRide ? (
            <DriverPanel
              className="w-[400px]"
              onRideStart={handleRideStart}
              findMatches={findMatches}
              isMatching={matchingForRide}
            />
          ) : (
            <OfferRidePanel
              onLocationSelect={(type, coords) => {
                console.log(`Selected ${type} location:`, coords);
              }}
              onRideCreated={loadActiveRide}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default DriverDashboard;
