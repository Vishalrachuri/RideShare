import React from "react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { format } from "date-fns";
import { CalendarIcon, Car, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { useToast } from "./ui/use-toast";

interface OfferRidePanelProps {
  onLocationSelect?: (
    type: "pickup" | "dropoff",
    coords: { lat: number; lng: number },
  ) => void;
  onRideCreated?: () => void;
}

const OfferRidePanel = ({
  onLocationSelect = () => {},
  onRideCreated = () => {},
}: OfferRidePanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pickup, setPickup] = React.useState("");
  const [dropoff, setDropoff] = React.useState("");
  const [date, setDate] = React.useState<Date>(new Date());
  const [timeType, setTimeType] = React.useState<"now" | "schedule">("now");
  const [seats, setSeats] = React.useState("4");
  const [pickupCoords, setPickupCoords] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [dropoffCoords, setDropoffCoords] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activeRide, setActiveRide] = React.useState<any>(null);

  const pickupRef = React.useRef<HTMLInputElement>(null);
  const dropoffRef = React.useRef<HTMLInputElement>(null);

  // Check for existing active rides
  React.useEffect(() => {
    if (!user) return;

    const checkActiveRides = async () => {
      try {
        const { data, error } = await supabase
          .from("rides")
          .select("*")
          .eq("driver_id", user.id)
          .in("status", ["pending", "accepted", "in_progress"])
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setActiveRide(data);

          // Set pickup/dropoff for display
          if (data.pickup_latitude && data.pickup_longitude) {
            setPickupCoords({
              lat: data.pickup_latitude,
              lng: data.pickup_longitude,
            });
            onLocationSelect("pickup", {
              lat: data.pickup_latitude,
              lng: data.pickup_longitude,
            });
          }

          if (data.destination_latitude && data.destination_longitude) {
            setDropoffCoords({
              lat: data.destination_latitude,
              lng: data.destination_longitude,
            });
            onLocationSelect("dropoff", {
              lat: data.destination_latitude,
              lng: data.destination_longitude,
            });
          }
        }
      } catch (error) {
        console.error("Error checking active rides:", error);
      }
    };

    checkActiveRides();

    // Subscribe to ride changes
    const channel = supabase
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
          if (
            payload.eventType === "DELETE" &&
            activeRide?.id === payload.old.id
          ) {
            setActiveRide(null);
          } else {
            checkActiveRides();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onLocationSelect, activeRide?.id]);

  React.useEffect(() => {
    if (!window.google?.maps?.places) return;

    const setupAutocomplete = (
      input: HTMLInputElement | null,
      setLocation: (val: string) => void,
      setCoords: (coords: { lat: number; lng: number } | null) => void,
      type: "pickup" | "dropoff",
    ) => {
      if (!input) return;

      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        fields: ["formatted_address", "geometry"],
        types: ["geocode", "establishment"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;

        const coords = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        setLocation(place.formatted_address || "");
        setCoords(coords);
        onLocationSelect(type, coords);
      });
    };

    setupAutocomplete(pickupRef.current, setPickup, setPickupCoords, "pickup");
    setupAutocomplete(
      dropoffRef.current,
      setDropoff,
      setDropoffCoords,
      "dropoff",
    );
  }, [onLocationSelect]);

  const handleOfferRide = async () => {
    if (!pickupCoords || !dropoffCoords || !user) {
      toast({
        title: "Missing Information",
        description: "Please enter both pickup and dropoff locations",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // First ensure user exists in users table
      const { data: existingUser, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        // Create user if they don't exist
        const { error: createError } = await supabase.from("users").insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || "New Driver",
          user_type: "driver",
        });

        if (createError) throw createError;
      }

      // Calculate route geometry for better matching
      let routeGeometry = null;
      let estimatedDuration = null;
      let estimatedDistance = null;

      try {
        if (window.google?.maps) {
          // Calculate distance and duration
          const service = new window.google.maps.DistanceMatrixService();
          const response = await service.getDistanceMatrix({
            origins: [{ lat: pickupCoords.lat, lng: pickupCoords.lng }],
            destinations: [{ lat: dropoffCoords.lat, lng: dropoffCoords.lng }],
            travelMode: window.google.maps.TravelMode.DRIVING,
          });

          if (response.rows[0]?.elements[0]?.status === "OK") {
            estimatedDuration = Math.round(
              response.rows[0].elements[0].duration.value / 60,
            ); // in minutes
            estimatedDistance =
              response.rows[0].elements[0].distance.value / 1000; // in km
          }

          // Calculate route for geometry
          const directionsService = new window.google.maps.DirectionsService();
          const result = await directionsService.route({
            origin: { lat: pickupCoords.lat, lng: pickupCoords.lng },
            destination: { lat: dropoffCoords.lat, lng: dropoffCoords.lng },
            travelMode: window.google.maps.TravelMode.DRIVING,
          });

          if (result.routes[0]?.overview_path) {
            // Convert Google's path to a GeoJSON LineString format
            const points = result.routes[0].overview_path.map((point) => [
              point.lng(),
              point.lat(),
            ]);
            routeGeometry = { type: "LineString", coordinates: points };
          }
        }
      } catch (error) {
        console.error("Error calculating route details:", error);
      }

      const scheduledTime = timeType === "now" ? new Date() : date;

      // Make sure scheduledTime is at least now
      if (scheduledTime < new Date()) {
        scheduledTime.setMinutes(new Date().getMinutes() + 5);
      }

      const rideData = {
        driver_id: user.id,
        pickup_latitude: pickupCoords.lat,
        pickup_longitude: pickupCoords.lng,
        destination_latitude: dropoffCoords.lat,
        destination_longitude: dropoffCoords.lng,
        scheduled_time: scheduledTime.toISOString(),
        seats_available: parseInt(seats),
        status: "pending",
        route_geometry: routeGeometry,
        estimated_duration: estimatedDuration,
        estimated_distance: estimatedDistance,
        current_location_latitude: pickupCoords.lat,
        current_location_longitude: pickupCoords.lng,
        last_location_update: new Date().toISOString(),
      };

      // Create the ride
      const { data, error } = await supabase
        .from("rides")
        .insert(rideData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Set the active ride
      setActiveRide(data);

      // After creating the ride, try to find matching passengers
      if (data) {
        // Trigger the backend function to find matching passengers
        const { data: matchResult, error: matchError } = await supabase.rpc(
          "find_passengers_for_ride",
          { p_ride_id: data.id },
        );

        if (matchError) {
          console.error("Error finding matching passengers:", matchError);
        } else {
          if (matchResult > 0) {
            toast({
              title: "Ride Offered Successfully!",
              description: `Found ${matchResult} matching passenger(s) for your ride!`,
              variant: "default",
            });
          } else {
            // If find_passengers_for_ride didn't find matches, try periodic_match_check
            console.log("No matches found, trying periodic match check");
            const { data: periodicResult, error: periodicError } =
              await supabase.rpc("periodic_match_check");

            if (periodicError) {
              console.error("Error in periodic match check:", periodicError);
            } else {
              console.log("Periodic match check result:", periodicResult);

              // Check if any passengers were matched to this ride
              const { data: matchedRequests, error: requestsError } =
                await supabase
                  .from("ride_requests")
                  .select("id")
                  .eq("ride_id", data.id)
                  .eq("status", "accepted");

              if (
                !requestsError &&
                matchedRequests &&
                matchedRequests.length > 0
              ) {
                toast({
                  title: "Ride Offered Successfully!",
                  description: `Found ${matchedRequests.length} matching passenger(s) for your ride!`,
                  variant: "default",
                });
                return;
              }
            }

            toast({
              title: "Ride Offered Successfully!",
              description:
                "No matching passengers found yet. The system will automatically match you with passengers going in the same direction.",
              variant: "default",
            });
          }
        }
      }

      // Notify parent component
      if (onRideCreated) onRideCreated();
    } catch (error: any) {
      console.error("Error offering ride:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to offer ride",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;

    try {
      setLoading(true);

      // Call backend function to cancel ride
      const { data, error } = await supabase.rpc("cancel_ride", {
        p_ride_id: activeRide.id,
        p_reason: "Cancelled by driver",
      });

      if (error) throw error;

      // Reset state
      setActiveRide(null);
      setPickup("");
      setDropoff("");
      setPickupCoords(null);
      setDropoffCoords(null);

      toast({
        title: "Ride Cancelled",
        description: "Your ride offer has been cancelled successfully.",
      });

      // Notify parent
      if (onRideCreated) onRideCreated();
    } catch (error) {
      console.error("Error cancelling ride:", error);
      toast({
        title: "Error",
        description: "Failed to cancel your ride. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If there's an active ride, show different UI
  if (activeRide) {
    return (
      <Card className="w-[400px] p-4 bg-white">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="font-medium mb-1">Active Ride Offer</h3>
            <p className="text-sm text-muted-foreground">
              You have an active ride offer.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-sm">
              <span className="font-medium">Status:</span>{" "}
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activeRide.status.charAt(0).toUpperCase() +
                  activeRide.status.slice(1)}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Pickup:</span>{" "}
              <span className="text-muted-foreground">
                {activeRide.pickup_latitude.toFixed(6)},{" "}
                {activeRide.pickup_longitude.toFixed(6)}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Dropoff:</span>{" "}
              <span className="text-muted-foreground">
                {activeRide.destination_latitude.toFixed(6)},{" "}
                {activeRide.destination_longitude.toFixed(6)}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Scheduled:</span>{" "}
              <span className="text-muted-foreground">
                {new Date(activeRide.scheduled_time).toLocaleString()}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Seats Available:</span>{" "}
              <span className="text-muted-foreground">
                {activeRide.seats_available}
              </span>
            </div>
          </div>

          {activeRide.status === "pending" && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleCancelRide}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Ride Offer"
              )}
            </Button>
          )}

          {activeRide.status !== "pending" && (
            <div className="bg-green-50 border border-green-200 p-3 rounded-md">
              <p className="text-sm text-green-800 font-medium">
                Your ride is {activeRide.status}
              </p>
              <p className="text-xs text-green-700 mt-1">
                Check the "Passengers" tab to see your matched riders.
              </p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-[400px] p-4 bg-white">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pickup">Pickup location</Label>
          <Input
            id="pickup"
            ref={pickupRef}
            placeholder="Enter pickup location"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            className="w-full"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dropoff">Dropoff location</Label>
          <Input
            id="dropoff"
            ref={dropoffRef}
            placeholder="Enter dropoff location"
            value={dropoff}
            onChange={(e) => setDropoff(e.target.value)}
            className="w-full"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label>When are you driving?</Label>
          <RadioGroup
            value={timeType}
            onValueChange={(value: "now" | "schedule") => setTimeType(value)}
            className="flex space-x-4"
            disabled={loading}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="now" id="now" />
              <Label htmlFor="now">Right Now</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="schedule" id="schedule" />
              <Label htmlFor="schedule">Schedule</Label>
            </div>
          </RadioGroup>
        </div>

        {timeType === "schedule" && (
          <div className="space-y-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(date) => {
                    if (date) {
                      // Preserve the current time when changing date
                      const newDate = new Date(date);
                      newDate.setHours(new Date().getHours());
                      newDate.setMinutes(new Date().getMinutes());
                      setDate(newDate);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="flex space-x-2">
              <Select
                value={date.getHours().toString().padStart(2, "0")}
                onValueChange={(value) => {
                  const newDate = new Date(date);
                  newDate.setHours(parseInt(value));
                  setDate(newDate);
                }}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString().padStart(2, "0")}>
                      {i.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={date.getMinutes().toString().padStart(2, "0")}
                onValueChange={(value) => {
                  const newDate = new Date(date);
                  newDate.setMinutes(parseInt(value));
                  setDate(newDate);
                }}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Minute" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                    <SelectItem
                      key={minute}
                      value={minute.toString().padStart(2, "0")}
                    >
                      {minute.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Available seats</Label>
          <Select value={seats} onValueChange={setSeats} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder="Select available seats" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} seat{num > 1 ? "s" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full"
          onClick={handleOfferRide}
          disabled={!pickupCoords || !dropoffCoords || loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Ride...
            </>
          ) : (
            <>
              <Car className="mr-2 h-4 w-4" />
              Offer Ride
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Your ride will be automatically matched with passengers going in the
          same direction.
        </p>
      </div>
    </Card>
  );
};

export default OfferRidePanel;
