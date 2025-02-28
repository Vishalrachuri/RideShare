import React from "react";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { MapPin, Clock, Car, Phone } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "./ui/button";

interface UpcomingRidesPanelProps {
  className?: string;
}

const UpcomingRidesPanel = ({ className = "" }: UpcomingRidesPanelProps) => {
  const { user } = useAuth();
  const [rides, setRides] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadRides = async () => {
      try {
        const { data, error } = await supabase
          .from("ride_requests")
          .select(
            `
            *,
            ride:ride_id(*),
            driver:ride(driver:driver_id(*))
          `,
          )
          .eq("rider_id", user.id)
          .in("status", [
            "accepted",
            "driver_accepted",
            "in_progress",
            "pickup_pending",
            "picked_up",
          ])
          .order("scheduled_time", { ascending: true });

        if (error) throw error;

        console.log("Loaded rides:", data);
        setRides(data || []);
      } catch (error) {
        console.error("Error loading rides:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRides();

    // Subscribe to changes
    const channel = supabase
      .channel(`ride_updates_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `rider_id=eq.${user.id}`,
        },
        loadRides,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge variant="success">Driver Confirmed</Badge>;
      case "in_progress":
        return <Badge variant="success">In Progress</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-center">Loading rides...</div>
      </Card>
    );
  }

  if (rides.length === 0) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-center text-muted-foreground">
          No upcoming rides found
        </div>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <div className="p-4 border-b">
        <h2 className="font-semibold">Upcoming Rides</h2>
      </div>
      <ScrollArea className="h-[300px]">
        <div className="p-4 space-y-4">
          {rides.map((ride) => (
            <Card key={ride.id} className="p-4 space-y-4">
              {/* Driver Info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                  <Car className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-medium">
                    {ride.driver?.full_name || "Your Driver"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Black Chrysler Pacifica • SZV7369
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="ml-auto">
                  <Phone className="h-4 w-4" />
                </Button>
              </div>

              {/* Timeline */}
              <div className="relative pl-8 space-y-6">
                {/* Vertical Line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

                {/* Pickup */}
                <div className="relative">
                  <div className="absolute left-[-2rem] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Pickup</div>
                    <div className="text-sm text-muted-foreground">
                      {ride.pickup_latitude}, {ride.pickup_longitude}
                    </div>
                    {ride.status === "accepted" && (
                      <div className="text-sm text-primary">
                        Driver arriving in 23 min
                      </div>
                    )}
                  </div>
                </div>

                {/* Dropoff */}
                <div className="relative">
                  <div className="absolute left-[-2rem] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Dropoff</div>
                    <div className="text-sm text-muted-foreground">
                      {ride.destination_latitude}, {ride.destination_longitude}
                    </div>
                    {ride.status === "accepted" && (
                      <div className="text-sm text-muted-foreground">
                        Estimated arrival:{" "}
                        {new Date(ride.scheduled_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Stops */}
              {ride.status === "in_progress" && ride.other_stops && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <div className="text-sm font-medium mb-2">
                    Other stops on the way
                  </div>
                  {ride.other_stops.map((stop: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span>{stop.location}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default UpcomingRidesPanel;
