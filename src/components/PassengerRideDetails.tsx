import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MapPin, Clock, Phone, MessageSquare } from "lucide-react";
import { getPassengerRideDetails } from "@/lib/rideMatchingUtils";
import { useAuth } from "@/lib/AuthContext";

interface PassengerRideDetailsProps {
  className?: string;
  requestId?: string;
}

const PassengerRideDetails = ({
  className = "",
  requestId,
}: PassengerRideDetailsProps) => {
  const { user } = useAuth();
  const [rideDetails, setRideDetails] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;

    const loadRideDetails = async () => {
      try {
        const result = await getPassengerRideDetails(user.id);
        console.log("Passenger ride details:", result);

        if (result.success && result.data) {
          setRideDetails(result.data);
        }
      } catch (error) {
        console.error("Error loading passenger ride details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRideDetails();
  }, [user, requestId]);

  if (loading) {
    return <div className="p-4 text-center">Loading ride details...</div>;
  }

  if (!rideDetails) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-center py-4">
          <p className="text-muted-foreground">No active ride found</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold">Your Ride</h3>
          <Badge variant="success">{rideDetails.ride_status}</Badge>
        </div>

        <div className="p-3 bg-green-50 rounded-md">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-800 font-medium">D</span>
            </div>
            <div>
              <p className="font-medium">{rideDetails.driver_name}</p>
              <p className="text-xs text-muted-foreground">
                Black Chrysler Pacifica • SZV7369
              </p>
            </div>
            <div className="ml-auto flex gap-1">
              {rideDetails.call_number && (
                <Button variant="ghost" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5" />
            <div>
              <span className="text-xs text-muted-foreground">Pickup</span>
              <p className="text-sm">
                {rideDetails.pickup_lat?.toFixed(4) || 0},{" "}
                {rideDetails.pickup_long?.toFixed(4) || 0}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5" />
            <div>
              <span className="text-xs text-muted-foreground">Dropoff</span>
              <p className="text-sm">
                {rideDetails.dropoff_lat?.toFixed(4) || 0},{" "}
                {rideDetails.dropoff_long?.toFixed(4) || 0}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              {new Date(rideDetails.scheduled_time).toLocaleString()}
            </span>
          </div>
        </div>

        <Button variant="outline" className="w-full">
          Contact Driver
        </Button>
      </div>
    </Card>
  );
};

export default PassengerRideDetails;
