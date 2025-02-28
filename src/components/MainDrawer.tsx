import React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { MapPin, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AutomaticMatchingInfo from "./AutomaticMatchingInfo";
import RideRequestsList from "./RideRequestsList";
import AcceptedRidesPanel from "./AcceptedRidesPanel";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";

import LocationDisplay from "./LocationDisplay";

interface MainDrawerProps {
  open?: boolean;
  onClose?: () => void;
}

const MainDrawer = ({ open = false, onClose = () => {} }: MainDrawerProps) => {
  const { user } = useAuth();
  const [userType, setUserType] = React.useState<"driver" | "passenger">(
    "passenger",
  );
  const [rideRequests, setRideRequests] = React.useState<any[]>([]);
  const [rides, setRides] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!user) return;

    const fetchUserType = async () => {
      // First try metadata
      if (user.user_metadata?.user_type) {
        setUserType(user.user_metadata.user_type);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("user_type")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user type:", error);
        return;
      }

      if (data?.user_type) {
        setUserType(data.user_type);
      }
    };

    fetchUserType();
  }, [user]);

  React.useEffect(() => {
    if (!user || userType !== "driver") return;

    const loadRideRequests = async () => {
      // Get active rides for driver
      const { data: activeRides } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .eq("status", "pending");

      if (!activeRides || activeRides.length === 0) {
        console.log("No active rides found for driver");
        setRideRequests([]);
        return;
      }

      const activeRide = activeRides[0]; // Use the first active ride
      console.log("Active ride found:", activeRide.id);

      // Get all pending ride requests
      const { data: allRequests, error: requestsError } = await supabase
        .from("ride_requests")
        .select(
          `
          *,
          rider:rider_id (id, full_name)
        `,
        )
        .in("status", ["pending"])
        .is("ride_id", null)
        .order("created_at", { ascending: false });

      if (requestsError) {
        console.error("Error loading ride requests:", requestsError);
        return;
      }

      console.log(
        "Found pending requests:",
        allRequests?.length || 0,
        allRequests,
      );
      setRideRequests(allRequests || []);
    };

    loadRideRequests();

    const channel = supabase
      .channel("ride_requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
        },
        loadRideRequests,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userType]);

  React.useEffect(() => {
    if (!user || userType !== "driver") return;

    const loadRides = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading rides:", error);
        return;
      }

      setRides(data || []);
    };

    loadRides();

    const channel = supabase
      .channel(`rides_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rides",
          filter: `driver_id=eq.${user.id}`,
        },
        loadRides,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userType]);

  // View passenger details that were automatically matched
  const handleViewDetails = (request: any) => {
    alert(
      `Passenger: ${request.rider?.full_name || "Anonymous"}\n` +
        `Pickup: ${request.pickup_latitude}, ${request.pickup_longitude}\n` +
        `Dropoff: ${request.destination_latitude}, ${request.destination_longitude}\n` +
        `Scheduled Time: ${new Date(request.scheduled_time).toLocaleString()}\n` +
        `Seats Needed: ${request.seats_needed || 1}\n\n` +
        `This passenger was automatically matched with your ride based on route overlap.`,
    );
  };

  const handleDeleteRide = async (rideId: string) => {
    if (!window.confirm("Are you sure you want to delete this ride?")) return;

    try {
      const { error } = await supabase.from("rides").delete().eq("id", rideId);

      if (error) throw error;
      setRides(rides.filter((r) => r.id !== rideId));
    } catch (error) {
      console.error("Error deleting ride:", error);
      alert("Failed to delete ride");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="w-[400px] sm:w-[540px] p-0 overflow-hidden flex flex-col"
      >
        <Tabs defaultValue="rides" className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b">
            <TabsTrigger value="rides">Rides</TabsTrigger>
            {userType === "driver" && (
              <TabsTrigger value="passengers">Passengers</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="rides" className="mt-0 flex-1 overflow-auto">
            {userType === "passenger" ? (
              <RideRequestsList />
            ) : (
              <div className="p-4 space-y-8">
                {/* Offered Rides Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Your Offered Rides</h3>
                  <div className="space-y-4">
                    {rides.map((ride) => (
                      <Card key={ride.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <Badge
                            variant={
                              ride.status === "pending" ? "default" : "success"
                            }
                          >
                            {ride.status.charAt(0).toUpperCase() +
                              ride.status.slice(1)}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRide(ride.id)}
                          >
                            Delete
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <LocationDisplay
                            lat={ride.pickup_latitude}
                            lng={ride.pickup_longitude}
                            icon={<MapPin className="h-4 w-4" />}
                            label="Pickup"
                          />
                          <LocationDisplay
                            lat={ride.destination_latitude}
                            lng={ride.destination_longitude}
                            icon={<MapPin className="h-4 w-4" />}
                            label="Dropoff"
                          />
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {new Date(ride.scheduled_time).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{ride.seats_available} seats available</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Ride Requests Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Ride Requests</h3>
                  <AutomaticMatchingInfo />
                  <div className="space-y-4">
                    {rideRequests.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <p>No pending ride requests found</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Offer a ride with your start and end locations to be
                          automatically matched with passengers
                        </p>
                      </div>
                    ) : (
                      rideRequests.map((request) => (
                        <Card key={request.id} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold">
                              Request from{" "}
                              {request.rider?.full_name || "Anonymous"}
                            </h3>
                            <Badge variant="default">
                              {request.status.charAt(0).toUpperCase() +
                                request.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <LocationDisplay
                              lat={request.pickup_latitude}
                              lng={request.pickup_longitude}
                              icon={<MapPin className="h-4 w-4" />}
                              label="Pickup"
                            />
                            <LocationDisplay
                              lat={request.destination_latitude}
                              lng={request.destination_longitude}
                              icon={<MapPin className="h-4 w-4" />}
                              label="Dropoff"
                            />
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>
                                {new Date(
                                  request.scheduled_time,
                                ).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>
                                {request.seats_needed || 1} seats needed
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button
                              variant="default"
                              className="flex-1"
                              onClick={() => handleViewDetails(request)}
                            >
                              View Details
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {userType === "driver" && (
            <TabsContent
              value="passengers"
              className="mt-0 flex-1 overflow-auto"
            >
              <div className="p-4 space-y-8">
                <div className="space-y-4">
                  <h3 className="font-semibold">Accepted Passengers</h3>
                  <AcceptedRidesPanel />
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default MainDrawer;
