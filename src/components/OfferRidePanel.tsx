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
import { CalendarIcon, Car } from "lucide-react";
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
}

const OfferRidePanel = ({
  onLocationSelect = () => {},
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

  const pickupRef = React.useRef<HTMLInputElement>(null);
  const dropoffRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!window.google?.maps?.places) return;

    const setupAutocomplete = (
      input: HTMLInputElement,
      setLocation: (val: string) => void,
      setCoords: (coords: { lat: number; lng: number } | null) => void,
      type: "pickup" | "dropoff",
    ) => {
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

    if (pickupRef.current) {
      setupAutocomplete(
        pickupRef.current,
        setPickup,
        setPickupCoords,
        "pickup",
      );
    }

    if (dropoffRef.current) {
      setupAutocomplete(
        dropoffRef.current,
        setDropoff,
        setDropoffCoords,
        "dropoff",
      );
    }
  }, [onLocationSelect]);

  const handleOfferRide = async () => {
    if (!pickupCoords || !dropoffCoords || !user) return;

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
          full_name: user.user_metadata?.full_name,
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

      console.log("Creating ride:", rideData);
      const { data, error } = await supabase
        .from("rides")
        .insert(rideData)
        .select()
        .single();

      if (error) {
        console.error("Error creating ride:", error);
        throw error;
      }
      console.log("Created ride:", data);

      // After creating the ride, check for matching passengers
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
            toast({
              title: "Ride Offered Successfully!",
              description:
                "No matching passengers found yet. The system will automatically match you with passengers going in the same direction.",
              variant: "default",
            });
          }
        }
      }

      // Reset form
      setPickup("");
      setDropoff("");
      setPickupCoords(null);
      setDropoffCoords(null);
      setSeats("4");
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
          />
        </div>

        <div className="space-y-2">
          <Label>When are you driving?</Label>
          <RadioGroup
            value={timeType}
            onValueChange={(value: "now" | "schedule") => setTimeType(value)}
            className="flex space-x-4"
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
          <Select value={seats} onValueChange={setSeats}>
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
          <Car className="mr-2 h-4 w-4" />
          {loading ? "Creating Ride..." : "Offer Ride"}
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
