import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MapPin, Clock, Users } from "lucide-react";
import AutomaticMatchingInfo from "./AutomaticMatchingInfo";

interface DriverPanelProps {
  className?: string;
}

const DriverPanel = ({ className = "" }: DriverPanelProps) => {
  const { user } = useAuth();
  const [activeRide, setActiveRide] = React.useState<any>(null);
  const [rideRequests, setRideRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;

    const loadActiveRide = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error loading active ride:", error);
        return;
      }

      if (data && data.length > 0) {
        setActiveRide(data[0]);
        loadAcceptedRequests(data[0].id);
      }
      setLoading(false);
    };

    const loadAcceptedRequests = async (rideId: string) => {
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
        .in("status", ["accepted", "in_progress"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading accepted requests:", error);
        return;
      }

      console.log("Loaded accepted requests for ride:", data?.length || 0);
      setRideRequests(data || []);
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
            loadAcceptedRequests(activeRide.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
          <h3 className="font-semibold">Matched Passengers</h3>
          <Badge variant="outline">{rideRequests.length} passengers</Badge>
        </div>

        {rideRequests.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No passengers matched yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              The system will automatically match passengers with your ride
              based on route overlap
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {rideRequests.map((request) => (
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
                  <Badge variant="success">Matched</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Pickup
                      </span>
                      <p>
                        {request?.pickup_latitude?.toFixed(4) || 0},{" "}
                        {request?.pickup_longitude?.toFixed(4) || 0}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Dropoff
                      </span>
                      <p>
                        {request?.destination_latitude?.toFixed(4) || 0},{" "}
                        {request?.destination_longitude?.toFixed(4) || 0}
                      </p>
                    </div>
                  </div>
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
