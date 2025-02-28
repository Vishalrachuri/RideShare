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
import { CalendarIcon, Search } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";

interface RideSearchPanelProps {
  onLocationSelect?: (
    type: "pickup" | "dropoff",
    coords: { lat: number; lng: number },
  ) => void;
}

const RideSearchPanel = ({
  onLocationSelect = () => {},
}: RideSearchPanelProps) => {
  const { user } = useAuth();
  const [pickup, setPickup] = React.useState("");
  const [dropoff, setDropoff] = React.useState("");
  const [date, setDate] = React.useState<Date>(new Date());
  const [timeType, setTimeType] = React.useState<"now" | "schedule">("now");
  const [searchState, setSearchState] = React.useState<
    | "initial"
    | "searching"
    | "pending"
    | "accepted"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show"
  >("initial");
  const [pickupCoords, setPickupCoords] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [dropoffCoords, setDropoffCoords] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = React.useState(false);

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

  const handleSearch = async () => {
    if (!pickupCoords || !dropoffCoords || !user) return;

    try {
      setSearchState("searching");

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

      // Create ride request with auto_match enabled
      const requestData = {
        rider_id: user.id,
        pickup_latitude: pickupCoords.lat,
        pickup_longitude: pickupCoords.lng,
        destination_latitude: dropoffCoords.lat,
        destination_longitude: dropoffCoords.lng,
        scheduled_time:
          timeType === "now" ? new Date().toISOString() : date.toISOString(),
        seats_needed: 1,
        status: "pending",
        auto_match: true, // Enable automatic matching
        max_walking_distance: 1.0, // Default walking distance in km
        max_wait_time: 30, // Default wait time in minutes
      };

      // Submit the ride request to the backend for automatic matching
      const { data, error } = await supabase
        .from("ride_requests")
        .insert(requestData)
        .select()
        .single();

      if (error) throw error;

      // Immediately try to find a match using the backend function
      const { data: matchResult, error: matchError } = await supabase.rpc(
        "auto_match_passenger_with_driver",
        { p_request_id: data.id },
      );

      if (matchError) {
        console.error("Error in automatic matching:", matchError);
      } else {
        console.log("Automatic matching result:", matchResult);
      }

      setSearchState("pending");
      setBookingConfirmed(true);

      // Show notification that the system is searching for a match
      alert(
        "Your ride request has been submitted! Our system is automatically matching you with available drivers. You'll be notified when a match is found.",
      );

      // Subscribe to status changes on the ride request
      const channel = supabase
        .channel(`request_${data.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "ride_requests",
            filter: `id=eq.${data.id}`,
          },
          (payload) => {
            console.log("Ride request status updated:", payload.new.status);
            setSearchState(payload.new.status);

            // Notify user when a driver is found
            if (payload.new.status === "accepted") {
              alert(
                "Good news! A driver has been found for your ride. Check the Rides tab for details.",
              );
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("Error creating ride request:", error);
      alert("Failed to create ride request");
      setSearchState("initial");
    }
  };

  return (
    <Card className="w-[400px] p-4 bg-white">
      <div className="space-y-4">
        <div className="space-y-2">
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
        </div>

        <div className="space-y-2">
          <Label>When do you want to ride?</Label>
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
                      newDate.setHours(date.getHours());
                      newDate.setMinutes(date.getMinutes());
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

        <Button
          className="w-full"
          onClick={handleSearch}
          disabled={
            !pickupCoords || !dropoffCoords || searchState === "searching"
          }
        >
          <Search className="mr-2 h-4 w-4" />
          {searchState === "searching" ? "Searching..." : "Request Ride"}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Your ride request will be automatically matched with available drivers
          going in the same direction.
        </p>

        {bookingConfirmed && (
          <div className="mt-4 p-3 bg-green-50 rounded-md border border-green-200">
            <p className="text-sm font-medium text-green-800">
              Ride request submitted!
            </p>
            <p className="text-xs text-green-700 mt-1">
              Waiting for automatic matching. You'll be notified when a driver
              is found.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default RideSearchPanel;
