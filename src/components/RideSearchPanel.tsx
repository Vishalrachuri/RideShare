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
import { CalendarIcon, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { useToast } from "@/components/ui/use-toast";

interface RideSearchPanelProps {
  onLocationSelect?: (
    type: "pickup" | "dropoff",
    coords: { lat: number; lng: number },
  ) => void;
  onRequestCreated?: () => void;
}

const RideSearchPanel = ({
  onLocationSelect = () => {},
  onRequestCreated = () => {},
}: RideSearchPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pickup, setPickup] = React.useState("");
  const [dropoff, setDropoff] = React.useState("");
  const [date, setDate] = React.useState<Date>(new Date());
  const [timeType, setTimeType] = React.useState<"now" | "schedule">("now");
  const [searchState, setSearchState] = React.useState<
    "initial" | "searching" | "pending" | "completed"
  >("initial");
  const [pickupCoords, setPickupCoords] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [dropoffCoords, setDropoffCoords] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [seats, setSeats] = React.useState("1");
  const [existingRequest, setExistingRequest] = React.useState<any>(null);

  const pickupRef = React.useRef<HTMLInputElement>(null);
  const dropoffRef = React.useRef<HTMLInputElement>(null);

  // Check for existing ride requests
  React.useEffect(() => {
    if (!user) return;

    const checkExistingRequests = async () => {
      try {
        const { data, error } = await supabase
          .from("ride_requests")
          .select("*")
          .eq("rider_id", user.id)
          .in("status", ["pending", "accepted", "in_progress"])
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setExistingRequest(data);
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
        console.error("Error checking existing requests:", error);
      }
    };

    checkExistingRequests();

    // Subscribe to status changes
    const channel = supabase
      .channel(`ride_requests_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `rider_id=eq.${user.id}`,
        },
        checkExistingRequests,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onLocationSelect]);

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

  const handleSearch = async () => {
    if (!pickupCoords || !dropoffCoords || !user) {
      toast({
        title: "Missing Information",
        description: "Please enter both pickup and dropoff locations",
        variant: "destructive",
      });
      return;
    }

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
          full_name: user.user_metadata?.full_name || "New User",
        });

        if (createError) throw createError;
      }

      // Calculate scheduled time
      const scheduledTime = timeType === "now" ? new Date() : date;

      // Create ride request with auto_match enabled
      const requestData = {
        rider_id: user.id,
        pickup_latitude: pickupCoords.lat,
        pickup_longitude: pickupCoords.lng,
        destination_latitude: dropoffCoords.lat,
        destination_longitude: dropoffCoords.lng,
        scheduled_time: scheduledTime.toISOString(),
        seats_needed: parseInt(seats),
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
      } else if (matchResult) {
        toast({
          title: "Driver Found!",
          description:
            "A driver has been matched with your ride. Check the Rides tab for details.",
        });
      } else {
        toast({
          title: "Ride Request Submitted",
          description:
            "We're looking for drivers in your direction. You'll be notified when we find a match.",
        });
      }

      // Set confirmation and reset state
      setSearchState("completed");
      setExistingRequest(data);

      // Reset form fields
      setPickup("");
      setDropoff("");

      // Notify parent
      if (onRequestCreated) onRequestCreated();
    } catch (error: any) {
      console.error("Error creating ride request:", error);

      // Handle duplicate request error specifically
      if (error?.code === "23505" || error?.message?.includes("duplicate")) {
        toast({
          title: "You already have an active ride request",
          description:
            "Please cancel your existing ride request before creating a new one.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create ride request",
          variant: "destructive",
        });
      }

      setSearchState("initial");
    }
  };

  const handleCancelRequest = async () => {
    if (!existingRequest) return;

    try {
      const { error } = await supabase
        .from("ride_requests")
        .delete()
        .eq("id", existingRequest.id);

      if (error) throw error;

      setExistingRequest(null);
      toast({
        title: "Ride Request Cancelled",
        description: "Your ride request has been cancelled successfully.",
      });

      // Notify parent
      if (onRequestCreated) onRequestCreated();
    } catch (error) {
      console.error("Error cancelling ride request:", error);
      toast({
        title: "Error",
        description: "Failed to cancel your ride request. Please try again.",
        variant: "destructive",
      });
    }
  };

  // If there's an existing request, show different UI
  if (existingRequest) {
    return (
      <Card className="w-[400px] p-4 bg-white">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="font-medium mb-1">Active Ride Request</h3>
            <p className="text-sm text-muted-foreground">
              You already have an active ride request.
            </p>
          </div>

          <div className="space-y-2">
            {existingRequest.status === "pending" ? (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                <p className="text-sm text-yellow-800 font-medium">
                  Searching for drivers
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  We're looking for a driver going in your direction. You'll be
                  notified when we find a match.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 p-3 rounded-md">
                <p className="text-sm text-green-800 font-medium">
                  Driver Found!
                </p>
                <p className="text-xs text-green-700 mt-1">
                  A driver has been matched with your ride. Check your rides for
                  details.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-sm">
              <span className="font-medium">Pickup:</span>{" "}
              <span className="text-muted-foreground">
                {existingRequest.pickup_latitude.toFixed(6)},{" "}
                {existingRequest.pickup_longitude.toFixed(6)}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Dropoff:</span>{" "}
              <span className="text-muted-foreground">
                {existingRequest.destination_latitude.toFixed(6)},{" "}
                {existingRequest.destination_longitude.toFixed(6)}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Scheduled:</span>{" "}
              <span className="text-muted-foreground">
                {new Date(existingRequest.scheduled_time).toLocaleString()}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Seats:</span>{" "}
              <span className="text-muted-foreground">
                {existingRequest.seats_needed || 1}
              </span>
            </div>
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleCancelRequest}
          >
            Cancel Ride Request
          </Button>
        </div>
      </Card>
    );
  }

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
              disabled={searchState === "searching"}
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
              disabled={searchState === "searching"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>When do you want to ride?</Label>
          <RadioGroup
            value={timeType}
            onValueChange={(value: "now" | "schedule") => setTimeType(value)}
            className="flex space-x-4"
            disabled={searchState === "searching"}
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
                  disabled={searchState === "searching"}
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
                disabled={searchState === "searching"}
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
                disabled={searchState === "searching"}
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
          <Label>Seats needed</Label>
          <Select
            value={seats}
            onValueChange={setSeats}
            disabled={searchState === "searching"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select seats needed" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} seat{num > 1 ? "s" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full"
          onClick={handleSearch}
          disabled={
            !pickupCoords || !dropoffCoords || searchState === "searching"
          }
        >
          {searchState === "searching" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Request Ride
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Your ride request will be automatically matched with available drivers
          going in the same direction.
        </p>
      </div>
    </Card>
  );
};

export default RideSearchPanel;
