import React from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { MapPin, Clock, Users, Phone, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

interface AcceptedRidesPanelProps {
  className?: string;
}

const AcceptedRidesPanel = ({ className = "" }: AcceptedRidesPanelProps) => {
  const { user } = useAuth();
  const [acceptedRequests, setAcceptedRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadAcceptedRequests = React.useCallback(
    async (forceRefresh = false) => {
      console.log("Loading accepted requests, force refresh:", forceRefresh);
      if (!user) return;
      try {
        // First get active rides for the driver
        const { data: activeRides, error: ridesError } = await supabase
          .from("rides")
          .select("id")
          .eq("driver_id", user.id)
          .in("status", ["pending", "accepted", "in_progress"]);

        if (ridesError) {
          console.error("Error fetching rides:", ridesError);
          setAcceptedRequests([]);
          setLoading(false);
          return;
        }

        if (!activeRides || activeRides.length === 0) {
          console.log("No active rides found for driver");
          setAcceptedRequests([]);
          setLoading(false);
          return;
        }

        console.log(
          "Active rides found:",
          activeRides.length,
          activeRides.map((r) => r.id),
        );

        // Get all accepted ride requests for these rides
        const rideIds = activeRides.map((ride) => ride.id);
        console.log("Looking for accepted requests for rides:", rideIds);

        if (forceRefresh) {
          console.log("Force refreshing accepted requests");
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Get all ride requests with status=accepted for these rides
        const { data: requests, error: requestsError } = await supabase
          .from("ride_requests")
          .select(
            `
          *,
          rider:rider_id(*),
          ride:ride_id(*)
          `,
          )
          .in("ride_id", rideIds)
          .in("status", [
            "accepted",
            "driver_accepted",
            "pickup_pending",
            "picked_up",
          ]);

        if (requestsError) {
          console.error("Error fetching accepted requests:", requestsError);
          throw requestsError;
        }

        console.log(
          "Accepted ride requests:",
          requests ? requests.length : 0,
          requests,
        );
        setAcceptedRequests(requests || []);
      } catch (error) {
        console.error("Error loading accepted requests:", error);
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  React.useEffect(() => {
    if (!user) return;

    // Listen for ride-accepted events
    const handleRideAccepted = (event: CustomEvent) => {
      console.log(
        "Ride accepted event received, reloading accepted rides",
        event.detail,
      );

      // Add a small delay to ensure database has time to update
      setTimeout(() => {
        loadAcceptedRequests(true);

        // Try again after a longer delay if needed
        setTimeout(() => {
          loadAcceptedRequests(true);
        }, 2000);
      }, 1000);
    };

    window.addEventListener(
      "ride-accepted",
      handleRideAccepted as EventListener,
    );

    loadAcceptedRequests();

    // Subscribe to changes in ride_requests table
    const requestsChannel = supabase
      .channel(`driver_accepted_requests_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
        },
        (payload) => {
          console.log("Ride request change detected:", payload);
          loadAcceptedRequests();
        },
      )
      .subscribe();

    // Also subscribe to changes in rides table
    const ridesChannel = supabase
      .channel(`driver_rides_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Ride change detected:", payload);
          loadAcceptedRequests();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(ridesChannel);
      window.removeEventListener(
        "ride-accepted",
        handleRideAccepted as EventListener,
      );
    };
  }, [user, loadAcceptedRequests]);

  const handleStartRide = async (rideId: string) => {
    try {
      console.log("Starting ride with ID:", rideId);
      const { error } = await supabase.rpc("start_ride", {
        p_ride_id: rideId,
      });

      if (error) {
        console.error("RPC error starting ride:", error);
        throw error;
      }

      // Reload the accepted requests to reflect the status change
      loadAcceptedRequests(true);

      // Show navigation to first pickup location
      alert(
        "Ride started successfully! Navigating to first passenger pickup location.",
      );
    } catch (error) {
      console.error("Error starting ride:", error);
      alert("Failed to start ride");
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">Loading accepted passengers...</div>
    );
  }

  if (acceptedRequests.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No accepted passengers found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => loadAcceptedRequests(true)}
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-4">
        {acceptedRequests.map((request) => (
          <Card key={request.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">
                  {request.rider?.full_name || "Anonymous"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Request #{request.id.slice(0, 8)}
                </p>
              </div>
              <Badge variant="success">
                {request.status.charAt(0).toUpperCase() +
                  request.status.slice(1)}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <div>
                  <span className="text-xs text-muted-foreground">Pickup</span>
                  <p className="text-sm">
                    {request?.pickup_latitude?.toFixed(4) || 0},{" "}
                    {request?.pickup_longitude?.toFixed(4) || 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <div>
                  <span className="text-xs text-muted-foreground">Dropoff</span>
                  <p className="text-sm">
                    {request?.destination_latitude?.toFixed(4) || 0},{" "}
                    {request?.destination_longitude?.toFixed(4) || 0}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  {new Date(request.scheduled_time).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm">
                  {request.seats_needed || 1} seat(s) needed
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {request.ride?.status === "pending" && (
                <Button
                  className="flex-1"
                  onClick={() => handleStartRide(request.ride_id)}
                >
                  Start Ride
                </Button>
              )}
              <Button variant="outline" size="icon">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};

export default AcceptedRidesPanel;
