import React from "react";
import Header from "@/components/Header";
import MapView from "@/components/MapView";
import MainDrawer from "@/components/MainDrawer";
import RideSearchPanel from "@/components/RideSearchPanel";
import ActiveRidePanel from "@/components/ActiveRidePanel";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import {
  getPassengerRideDetails,
  cancelRideRequest,
} from "@/lib/rideMatchingUtils";

const PassengerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeRide, setActiveRide] = React.useState<any>(null);
  const [pendingRideRequest, setPendingRideRequest] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  // Load active ride or pending ride request
  const loadActiveRideData = React.useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // First check for active ride (accepted/in progress)
      const rideDetailsResult = await getPassengerRideDetails(user.id);

      if (rideDetailsResult.success && rideDetailsResult.data) {
        // We have an active ride
        setActiveRide(rideDetailsResult.data);
        setPendingRideRequest(null);
        return;
      }

      // If no active ride, check for pending requests
      const { data: pendingRequest, error: pendingError } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("rider_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (pendingError) throw pendingError;

      setPendingRideRequest(pendingRequest);
      setActiveRide(null);
    } catch (error) {
      console.error("Error loading ride data:", error);
      toast({
        title: "Error",
        description: "Failed to load your ride information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    loadActiveRideData();

    // Subscribe to ride request changes
    const requestsChannel = supabase
      .channel(`passenger_requests_${user?.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `rider_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log("Ride request update:", payload);

          // Handle status changes
          if (payload.eventType === "UPDATE" && payload.old && payload.new) {
            if (payload.old.status !== payload.new.status) {
              // If request was accepted, show notification
              if (payload.new.status === "accepted") {
                toast({
                  title: "Driver Found!",
                  description:
                    "A driver has been matched with your ride request!",
                });
              } else if (payload.new.status === "in_progress") {
                toast({
                  title: "Ride Started",
                  description:
                    "Your ride has started. The driver is on the way.",
                });
              } else if (payload.new.status === "completed") {
                toast({
                  title: "Ride Completed",
                  description: "Your ride has been completed.",
                });
              }
            }
          }

          // Reload ride data
          loadActiveRideData();
        },
      )
      .subscribe();

    // Clean up
    return () => {
      supabase.removeChannel(requestsChannel);
    };
  }, [user, loadActiveRideData, toast]);

  // Handle ride cancellation
  const handleCancelRide = async () => {
    if (!activeRide && !pendingRideRequest) return;

    try {
      setLoading(true);

      // Determine which ride to cancel
      const requestId = pendingRideRequest?.id || activeRide?.request_id;

      if (!requestId) {
        throw new Error("No ride request ID found");
      }

      // Call backend function
      const result = await cancelRideRequest(requestId);

      if (!result.success) {
        throw result.error;
      }

      toast({
        title: "Ride Cancelled",
        description: "Your ride has been cancelled successfully.",
      });

      // Reset state
      setActiveRide(null);
      setPendingRideRequest(null);

      // Reload data
      loadActiveRideData();
    } catch (error) {
      console.error("Error cancelling ride:", error);
      toast({
        title: "Error",
        description: "Failed to cancel your ride. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MainDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userType="passenger"
      />
      <Header
        userName={user?.user_metadata?.full_name}
        userAvatar={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
        role="passenger"
        onProfileClick={() => console.log("Profile clicked")}
        onNotificationsClick={() => console.log("Notifications clicked")}
        onMessagesClick={() => console.log("Messages clicked")}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <main className="pt-16">
        <MapView
          userType="passenger"
          center={{ lat: 33.2148, lng: -97.1331 }}
          zoom={12}
          activeRide={activeRide || pendingRideRequest}
          onMapClick={(coords) => {
            console.log("Map clicked at:", coords);
          }}
        />

        {/* Floating Panel */}
        <div className="absolute top-20 left-4 z-10">
          {activeRide ? (
            <ActiveRidePanel
              className="w-[400px]"
              ride={activeRide}
              onCancel={handleCancelRide}
            />
          ) : (
            <RideSearchPanel
              onLocationSelect={(type, coords) => {
                console.log(`Selected ${type} location:`, coords);
              }}
              onRequestCreated={loadActiveRideData}
              existingRequest={pendingRideRequest}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default PassengerDashboard;
