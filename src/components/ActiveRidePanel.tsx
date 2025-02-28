import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { MapPin, Clock, Car, Phone, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

interface ActiveRidePanelProps {
  className?: string;
  ride: any;
  onCancel?: () => void;
}

const ActiveRidePanel = ({
  className = "",
  ride,
  onCancel,
}: ActiveRidePanelProps) => {
  const handleCancelRide = async () => {
    if (!window.confirm("Are you sure you want to cancel this ride?")) return;

    try {
      const { error } = await supabase
        .from("ride_requests")
        .update({ status: "cancelled" })
        .eq("id", ride.id);

      if (error) throw error;
      onCancel?.();
    } catch (error) {
      console.error("Error cancelling ride:", error);
      alert("Failed to cancel ride");
    }
  };

  const [driverLocation, setDriverLocation] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);

  React.useEffect(() => {
    if (!ride?.driver_id) return;

    const channel = supabase
      .channel(`driver_location_${ride.driver_id}`)
      .on("broadcast", { event: "location_update" }, (payload) => {
        setDriverLocation(payload.payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride?.driver_id]);

  return (
    <Card className={`${className} p-4 space-y-4 bg-white`}>
      {/* Driver Info */}
      <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
          <Car className="h-6 w-6" />
        </div>
        <div>
          <div className="font-medium">
            {ride.ride?.driver?.full_name ||
              ride.driver?.full_name ||
              "Your Driver"}
          </div>
          <div className="text-sm text-muted-foreground">
            Black Chrysler Pacifica • SZV7369
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="icon">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
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
            <div className="text-sm text-primary">
              Driver arriving in 23 min
            </div>
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
            <div className="text-sm text-muted-foreground">
              Estimated arrival:{" "}
              {new Date(ride.scheduled_time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Other Stops */}
      {ride.other_stops && (
        <div className="p-3 bg-secondary/50 rounded-lg">
          <div className="text-sm font-medium mb-2">Other stops on the way</div>
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

      {/* Cancel Button */}
      <Button
        variant="destructive"
        className="w-full"
        onClick={handleCancelRide}
      >
        Cancel Ride
      </Button>
    </Card>
  );
};

export default ActiveRidePanel;
