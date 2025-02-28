import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MapPin, Clock, Users, RefreshCw } from "lucide-react";
import RideStatusDisplay from "./RideStatusDisplay";
import LocationDisplay from "./LocationDisplay";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "./ui/scroll-area";

interface DriverPanelProps {
  className?: string;
  onRideStart?: () => void;
}

const DriverPanel = ({ className = "", onRideStart }: DriverPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeRide, setActiveRide] = React.useState<any>(null);
  const [matchedRequests, setMatchedRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [findingMatches, setFindingMatches] = React.useState(false);

  // Load active ride and matched passengers
  const loadActiveRideData = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get the driver's active ride
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .in("status", ["pending", "accepted", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setActiveRide(data[0]);
        await loadMatchedRequests(data[0].id);
      } else {
        setActiveRide(null);
        setMatchedRequests([]);
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

  // Load matched requests for a ride
  const loadMatchedRequests = async (rideId: string) => {
    try {
      // Get all accepted ride requests for this ride
      const { data, error } = await supabase
        .from("ride_requests")
        .select(
          `
          *,
          rider:rider_id (id, full_name, avatar_url)
        `,
        )
        .eq("ride_id", rideId)
        .in("status", ["accepted", "in_progress", "picked_up"])
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setMatchedRequests(data || []);
    } catch (error) {
      console.error("Error loading matched requests:", error);
    }
  };

  React.useEffect(() => {
    loadActiveRideData();

    // Subscribe to changes in ride requests
    const channel = supabase
      .channel(`driver_ride_requests_${user?.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
        },
        (payload) => {
          // Refresh data when ride requests change
          loadActiveRideData();

          // Show notification for new matches
          if (
            payload.eventType === "UPDATE" &&
            payload.new.status === "accepted" &&
            activeRide?.id === payload.new.ride_id
          ) {
            toast({
              title: "New Passenger Matched!",
              description: "A new passenger has been matched with your ride.",
            });
          }
        },
      )
      .subscribe();

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
        loadActiveRideData,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(ridesChannel);
    };
  }, [user, loadActiveRideData, activeRide?.id, toast]);

  // Try to find matches for the current ride
  const findMatches = async () => {
    if (!activeRide) return;

    try {
      setFindingMatches(true);

      // Call the function to find passengers for this ride
      const { data, error } = await supabase.rpc("find_passengers_for_ride", {
        p_ride_id: activeRide.id,
      });

      if (error) throw error;

      // Refresh the matched requests
      await loadMatchedRequests(activeRide.id);

      if (data === 0) {
        toast({
          title: "No New Matches",
          description:
            "No new matches found at this time. We'll keep searching.",
        });
      } else {
        toast({
          title: "Success!",
          description: `Found ${data} new passenger match${data > 1 ? "es" : ""}!`,
        });
      }
    } catch (error) {
      console.error("Error finding matches:", error);
      toast({
        title: "Error",
        description: "Failed to find passenger matches",
        variant: "destructive",
      });
    } finally {
      setFindingMatches(false);
    }
  };

  // View passenger details that were automatically matched
  const handleViewDetails = (request: any) => {
    // Create a more user-friendly dialog
    toast({
      title: `Passenger: ${request.rider?.full_name || "Anonymous"}`,
      description: (
        <div className="space-y-2 mt-2">
          <p>
            <strong>Pickup:</strong> {request.pickup_latitude.toFixed(6)},{" "}
            {request.pickup_longitude.toFixed(6)}
          </p>
          <p>
            <strong>Dropoff:</strong> {request.destination_latitude.toFixed(6)},{" "}
            {request.destination_longitude.toFixed(6)}
          </p>
          <p>
            <strong>Scheduled:</strong>{" "}
            {new Date(request.scheduled_time).toLocaleString()}
          </p>
          <p>
            <strong>Seats needed:</strong> {request.seats_needed || 1}
          </p>
          <p className="mt-2 text-xs">
            This passenger was automatically matched based on route overlap.
          </p>
        </div>
      ),
      duration: 8000,
    });
  };

  // Start the ride
  const startRide = async () => {
    if (!activeRide) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("start_ride", {
        p_ride_id: activeRide.id,
      });

      if (error) throw error;

      // Update the local state
      setActiveRide({
        ...activeRide,
        status: "in_progress",
      });

      toast({
        title: "Ride Started",
        description:
          "Your ride has started! Navigate to pick up your passengers.",
      });

      // Notify parent component
      if (onRideStart) onRideStart();
    } catch (error) {
      console.error("Error starting ride:", error);
      toast({
        title: "Error",
        description: "Failed to start the ride. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !activeRide) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (!activeRide) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No active ride found</p>
          <p className="text-sm mt-2">Offer a ride to see ride requests</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Your Active Ride</h3>
          <RideStatusDisplay status={activeRide.status} />
        </div>

        <div className="space-y-2">
          <LocationDisplay
            lat={activeRide.pickup_latitude}
            lng={activeRide.pickup_longitude}
            icon={<MapPin className="h-4 w-4" />}
            label="Pickup"
          />
          <LocationDisplay
            lat={activeRide.destination_latitude}
            lng={activeRide.destination_longitude}
            icon={<MapPin className="h-4 w-4" />}
            label="Destination"
          />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{new Date(activeRide.scheduled_time).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{activeRide.seats_available} seats available</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={findMatches}
            disabled={findingMatches || activeRide.status !== "pending"}
          >
            {findingMatches ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Finding...
              </>
            ) : (
              "Find Passengers"
            )}
          </Button>

          {activeRide.status === "pending" && matchedRequests.length > 0 && (
            <Button className="flex-1" onClick={startRide} variant="default">
              Start Ride
            </Button>
          )}
        </div>

        <div className="flex justify-between items-center mt-6">
          <h3 className="font-semibold">Matched Passengers</h3>
          <Badge variant="outline">{matchedRequests.length} passengers</Badge>
        </div>

        {matchedRequests.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No passengers matched yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              The system will automatically match passengers with your ride
              based on route overlap. Click "Find Passengers" to search.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-2">
            <div className="space-y-4">
              {matchedRequests.map((request) => (
                <Card key={request.id} className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {request.rider?.avatar_url ? (
                          <img
                            src={request.rider.avatar_url}
                            alt={request.rider?.full_name || "Passenger"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-semibold">
                            {(request.rider?.full_name || "A")[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {request.rider?.full_name || "Anonymous"}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {request.seats_needed || 1} seat
                          {request.seats_needed !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <RideStatusDisplay status={request.status} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <LocationDisplay
                      lat={request.pickup_latitude}
                      lng={request.pickup_longitude}
                      icon={<MapPin className="h-4 w-4" />}
                      label="Pickup"
                    />
                    <LocationDisplay
                      lat={request.destination_latitude}
                      lng={request.destination_longitude}
                      icon={<MapPin className="h-4 w-4" />}
                      label="Dropoff"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewDetails(request)}
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </Card>
  );
};

export default DriverPanel;
