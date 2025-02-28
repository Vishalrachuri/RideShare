import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MapPin, Clock, Users } from "lucide-react";
import AutomaticMatchingInfo from "./AutomaticMatchingInfo";
import RideStatusDisplay from "./RideStatusDisplay";
import LocationDisplay from "./LocationDisplay";

interface DriverPanelProps {
  className?: string;
}

const DriverPanel = ({ className = "" }: DriverPanelProps) => {
  const { user } = useAuth();
  const [activeRide, setActiveRide] = React.useState<any>(null);
  const [matchedRequests, setMatchedRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;

    const loadActiveRide = async () => {
      // Get the driver's active ride
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .in("status", ["pending", "accepted", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error loading active ride:", error);
        return;
      }

      if (data && data.length > 0) {
        setActiveRide(data[0]);
        loadMatchedRequests(data[0].id);
      }
      setLoading(false);
    };

    const loadMatchedRequests = async (rideId: string) => {
      // Get all accepted ride requests for this ride
      const { data, error } = await supabase
        .from("ride_requests")
        .select(
          `
          *,
          rider:rider_id (id, full_name)
        `,
        )
        .eq("ride_id", rideId)
        .in("status", ["accepted", "in_progress", "picked_up"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading matched requests:", error);
        return;
      }

      console.log("Loaded matched requests for ride:", data?.length || 0);
      setMatchedRequests(data || []);
    };

    loadActiveRide();

    // Subscribe to changes in ride requests
    const channel = supabase
      .channel("ride_requests_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
        },
        (payload) => {
          if (activeRide) {
            loadMatchedRequests(activeRide.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Try to find matches for the current ride
  const findMatches = async () => {
    if (!activeRide) return;

    try {
      setLoading(true);
      // Call the function to find passengers for this ride
      const { data, error } = await supabase.rpc("find_passengers_for_ride", {
        p_ride_id: activeRide.id,
      });

      if (error) throw error;

      // Refresh the matched requests
      if (activeRide) {
        const { data: refreshedData, error: refreshError } = await supabase
          .from("ride_requests")
          .select(
            `
            *,
            rider:rider_id (id, full_name)
          `,
          )
          .eq("ride_id", activeRide.id)
          .in("status", ["accepted", "in_progress", "picked_up"])
          .order("created_at", { ascending: false });

        if (!refreshError && refreshedData) {
          setMatchedRequests(refreshedData);
        }
      }

      if (data === 0) {
        alert("No new matches found at this time. We'll keep searching.");
      } else {
        alert(`Found ${data} new matches!`);
      }
    } catch (error) {
      console.error("Error finding matches:", error);
    } finally {
      setLoading(false);
    }
  };

  // View passenger details that were automatically matched
  const handleViewDetails = (request: any) => {
    alert(
      `Passenger: ${request.rider?.full_name || "Anonymous"}\n` +
        `Pickup: ${request.pickup_latitude}, ${request.pickup_longitude}\n` +
        `Dropoff: ${request.destination_latitude}, ${request.destination_longitude}\n` +
        `Scheduled Time: ${new Date(request.scheduled_time).toLocaleString()}\n` +
        `Seats Needed: ${request.seats_needed || 1}\n\n` +
        `This passenger was automatically matched with your ride based on route overlap.\n\n` +
        `After you press Start Ride, you'll be navigated to the first pickup location.`,
    );
  };

  const startRide = async () => {
    if (!activeRide) return;

    try {
      const { data, error } = await supabase.rpc("start_ride", {
        p_ride_id: activeRide.id,
      });

      if (error) throw error;

      // Update the local state or refresh
      setActiveRide({
        ...activeRide,
        status: "in_progress",
      });

      alert("Ride started successfully! Navigate to pick up your passengers.");
    } catch (error) {
      console.error("Error starting ride:", error);
      alert("Failed to start the ride. Please try again.");
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
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
        <AutomaticMatchingInfo />

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
          <Button className="flex-1" onClick={findMatches} disabled={loading}>
            Find Passengers
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
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {matchedRequests.map((request) => (
              <Card key={request.id} className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">
                      {request.rider?.full_name || "Anonymous"}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Request #{request.id.slice(0, 8)}
                    </p>
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
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(request.scheduled_time).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{request.seats_needed || 1} seat(s) needed</span>
                  </div>
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
        )}
      </div>
    </Card>
  );
};

export default DriverPanel;
