import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { MapPin, Clock, User, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import LocationDisplay from "./LocationDisplay";

interface RideHistoryPanelProps {
  className?: string;
  userType?: "driver" | "passenger";
}

const RideHistoryPanel = ({
  className = "",
  userType = "passenger",
}: RideHistoryPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rides, setRides] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;

    const fetchRideHistory = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase.rpc("get_ride_history", {
          p_user_id: user.id,
          p_limit: 20,
          p_offset: 0,
        });

        if (error) throw error;

        setRides(data || []);
      } catch (error) {
        console.error("Error fetching ride history:", error);
        toast({
          title: "Error",
          description: "Failed to load ride history",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRideHistory();
  }, [user, toast]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "in_progress":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No ride history found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Your {userType === "driver" ? "offered" : "requested"} rides will
          appear here once completed
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={`h-[calc(100vh-200px)] ${className}`}>
      <div className="space-y-4 p-4">
        {rides.map((ride) => (
          <Card key={ride.ride_id} className="p-4">
            <div className="flex justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeColor(ride.ride_status)}>
                    {ride.ride_status.charAt(0).toUpperCase() +
                      ride.ride_status.slice(1)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(ride.ride_date).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-medium">
                  {ride.is_driver ? "Ride Offered" : "Ride Taken"}
                </h3>
              </div>

              {/* Rating stars if available */}
              {ride.rating > 0 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: ride.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {ride.other_user_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {ride.is_driver ? "Passenger" : "Driver"}:{" "}
                    {ride.other_user_name}
                  </span>
                </div>
              )}

              <LocationDisplay
                lat={ride.pickup_lat}
                lng={ride.pickup_long}
                icon={<MapPin className="h-4 w-4" />}
                label="Pickup"
              />

              <LocationDisplay
                lat={ride.dropoff_lat}
                lng={ride.dropoff_long}
                icon={<MapPin className="h-4 w-4" />}
                label="Dropoff"
              />

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(ride.ride_date).toLocaleString()}
                </span>
              </div>

              {ride.seats > 0 && (
                <div className="text-sm text-muted-foreground">
                  {ride.seats} seat{ride.seats !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};

export default RideHistoryPanel;
