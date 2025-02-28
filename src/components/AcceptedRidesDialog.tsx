import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Clock, Users, Car } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

interface AcceptedRidesDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AcceptedRidesDialog({
  open,
  onClose,
}: AcceptedRidesDialogProps) {
  const { user } = useAuth();
  const [rides, setRides] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;

    const loadRides = async () => {
      console.log("Loading accepted rides for driver:", user.id);
      const { data, error } = await supabase
        .from("ride_requests")
        .select(
          `
          *,
          ride:ride_id(*),
          rider:rider_id(*)
        `,
        )
        .in("status", [
          "accepted",
          "driver_accepted",
          "in_progress",
          "pickup_pending",
          "picked_up",
        ])
        .order("scheduled_time", { ascending: true });

      if (error) {
        console.error("Error loading rides:", error);
        return;
      }

      console.log("Loaded rides:", data);
      setRides(data || []);
      setLoading(false);
    };

    loadRides();

    const channel = supabase
      .channel(`ride_requests_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests" },
        loadRides,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleStartRide = async (rideId: string) => {
    try {
      const { error } = await supabase.rpc("start_ride", {
        p_ride_id: rideId,
      });

      if (error) throw error;

      // Show navigation to first pickup location
      alert("Ride started! Navigating to first passenger pickup location.");
      onClose();
    } catch (error) {
      console.error("Error starting ride:", error);
      alert("Failed to start ride");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upcoming Rides</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4">
            {loading ? (
              <div className="text-center">Loading rides...</div>
            ) : rides.length === 0 ? (
              <div className="text-center text-muted-foreground">
                No upcoming rides found
              </div>
            ) : (
              rides.map((request) => (
                <Card key={request.id} className="p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>
                        Pickup: {request.pickup_latitude},{" "}
                        {request.pickup_longitude}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>
                        Dropoff: {request.destination_latitude},{" "}
                        {request.destination_longitude}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {new Date(request.scheduled_time).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>{request.seats_needed} seats needed</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handleStartRide(request.ride_id)}
                  >
                    <Car className="mr-2 h-4 w-4" />
                    Start Ride
                  </Button>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
