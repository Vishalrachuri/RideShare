import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { MapPin, Check, Car, Phone, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

interface Stop {
  type: "pickup" | "dropoff";
  location: { lat: number; lng: number };
  passenger: {
    id: string;
    name: string;
  };
  completed: boolean;
}

interface DriverRideScreenProps {
  className?: string;
  ride: any;
  onComplete?: () => void;
}

const DriverRideScreen = ({
  className = "",
  ride,
  onComplete,
}: DriverRideScreenProps) => {
  const [stops, setStops] = React.useState<Stop[]>([]);
  const [currentStop, setCurrentStop] = React.useState<number>(0);

  React.useEffect(() => {
    if (!ride) return;

    const loadStops = async () => {
      const { data: requests } = await supabase
        .from("ride_requests")
        .select(
          `
          *,
          rider:rider_id(*)
        `,
        )
        .eq("ride_id", ride.id)
        .in("status", [
          "accepted",
          "driver_accepted",
          "in_progress",
          "pickup_pending",
          "picked_up",
        ]);

      if (!requests) return;

      // Create stops array with both pickups and dropoffs
      const allStops: Stop[] = [];
      requests.forEach((request) => {
        allStops.push({
          type: "pickup",
          location: {
            lat: request.pickup_latitude,
            lng: request.pickup_longitude,
          },
          passenger: {
            id: request.rider.id,
            name: request.rider.full_name,
          },
          completed:
            request.status === "in_progress" ||
            request.status === "picked_up" ||
            request.status === "completed",
        });
        allStops.push({
          type: "dropoff",
          location: {
            lat: request.destination_latitude,
            lng: request.destination_longitude,
          },
          passenger: {
            id: request.rider.id,
            name: request.rider.full_name,
          },
          completed: request.status === "completed",
        });
      });

      // Sort stops to optimize route
      const sortedStops = optimizeStops(allStops, {
        lat: ride.pickup_latitude,
        lng: ride.pickup_longitude,
      });
      setStops(sortedStops);

      // Set current stop based on completion status
      const nextIncompleteIndex = sortedStops.findIndex(
        (stop) => !stop.completed,
      );
      setCurrentStop(
        nextIncompleteIndex === -1 ? sortedStops.length : nextIncompleteIndex,
      );
    };

    loadStops();

    // Subscribe to ride request updates
    const channel = supabase
      .channel(`ride_${ride.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ride_requests",
          filter: `ride_id=eq.${ride.id}`,
        },
        loadStops,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride]);

  // Helper function to optimize stop order
  const optimizeStops = (
    stops: Stop[],
    startLocation: { lat: number; lng: number },
  ) => {
    // Keep pickups before dropoffs for same passenger
    const passengerStops = new Map<string, Stop[]>();
    stops.forEach((stop) => {
      if (!passengerStops.has(stop.passenger.id)) {
        passengerStops.set(stop.passenger.id, []);
      }
      passengerStops.get(stop.passenger.id)?.push(stop);
    });

    const sortedStops: Stop[] = [];
    Array.from(passengerStops.values()).forEach((passengerStopPair) => {
      const pickup = passengerStopPair.find((s) => s.type === "pickup");
      const dropoff = passengerStopPair.find((s) => s.type === "dropoff");
      if (pickup) sortedStops.push(pickup);
      if (dropoff) sortedStops.push(dropoff);
    });

    return sortedStops;
  };

  const handleConfirmStop = async () => {
    const stop = stops[currentStop];
    if (!stop) return;

    try {
      const request = ride?.ride_requests?.find(
        (r) => r.rider_id === stop?.passenger?.id,
      );
      if (!request) {
        console.error("Request not found for passenger:", stop?.passenger?.id);
        return;
      }

      if (stop.type === "pickup") {
        // For first pickup, start the ride if it's not already in progress
        if (currentStop === 0 && ride.status !== "in_progress") {
          // Use the backend function to start the ride
          const { data, error } = await supabase.rpc("start_ride", {
            p_ride_id: ride.id,
          });

          if (error) throw error;
        }

        // Update request status to picked_up
        const { error } = await supabase
          .from("ride_requests")
          .update({ status: "picked_up" })
          .eq("id", request.id);

        if (error) throw error;

        alert(`Pickup confirmed for ${stop.passenger.name}`);
      } else {
        // For dropoff, mark the request as completed
        const { error } = await supabase
          .from("ride_requests")
          .update({ status: "completed" })
          .eq("id", request.id);

        if (error) throw error;

        // Check if this is the last stop
        const remainingStops = stops.filter(
          (s, i) => i > currentStop && !s.completed,
        ).length;

        if (remainingStops === 0) {
          // Complete the entire ride
          const { data, error } = await supabase.rpc("complete_ride", {
            p_ride_id: ride.id,
          });

          if (error) throw error;

          if (onComplete) onComplete();
        }
      }

      // Update local state
      setStops(
        stops.map((s, i) =>
          i === currentStop ? { ...s, completed: true } : s,
        ),
      );
      setCurrentStop(currentStop + 1);
    } catch (error) {
      console.error("Error confirming stop:", error);
      alert("Failed to confirm stop: " + (error as Error).message);
    }
  };

  const handleChat = (passengerId: string) => {
    // TODO: Implement chat functionality
    console.log("Chat with passenger:", passengerId);
  };

  const handleCall = (passengerId: string) => {
    // TODO: Implement call functionality
    console.log("Call passenger:", passengerId);
  };

  return (
    <Card className={`${className} p-4 space-y-4 bg-white`}>
      <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
          <Car className="h-6 w-6" />
        </div>
        <div>
          <div className="font-medium">Active Ride</div>
          <div className="text-sm text-muted-foreground">
            {stops.length - currentStop} stops remaining
          </div>
        </div>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {stops.map((stop, index) => (
            <div
              key={`${stop.passenger.id}-${stop.type}`}
              className={`relative pl-8 py-2 ${index < currentStop ? "opacity-50" : ""}`}
            >
              {/* Vertical Line */}
              {index < stops.length - 1 && (
                <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-border" />
              )}

              <div className="relative">
                <div
                  className={`absolute left-[-2rem] top-1 h-4 w-4 rounded-full border-2 
                    ${stop.completed ? "bg-primary border-primary" : "border-primary bg-background"}`}
                >
                  {stop.completed && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {stop.type === "pickup" ? "Pick up" : "Drop off"}{" "}
                    {stop.passenger.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stop.location.lat}, {stop.location.lng}
                  </div>
                  {index === currentStop && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={handleConfirmStop}
                        className="flex-1"
                      >
                        Confirm {stop.type === "pickup" ? "Pickup" : "Dropoff"}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleChat(stop.passenger.id)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleCall(stop.passenger.id)}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default DriverRideScreen;
