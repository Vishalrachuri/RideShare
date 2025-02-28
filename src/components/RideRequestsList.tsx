import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import LocationDisplay from "./LocationDisplay";
import RideStatusDisplay from "./RideStatusDisplay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RideRequestsListProps {
  onStatusChange?: () => void;
}

export default function RideRequestsList({
  onStatusChange,
}: RideRequestsListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [requestToDelete, setRequestToDelete] = React.useState<string | null>(
    null,
  );
  const [requests, setRequests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadRequests = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("ride_requests")
        .select("*, ride:ride_id(*, driver:driver_id(*))")
        .eq("rider_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setRequests(data || []);
    } catch (error) {
      console.error("Error loading ride requests:", error);
      toast({
        title: "Error",
        description: "Could not load your ride requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    loadRequests();

    // Subscribe to changes
    const channel = supabase
      .channel(`ride_requests_${user?.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_requests",
          filter: `rider_id=eq.${user?.id}`,
        },
        async (payload) => {
          if (payload.eventType === "UPDATE") {
            // If status changed to accepted, show a notification
            if (
              payload.old?.status !== "accepted" &&
              payload.new?.status === "accepted"
            ) {
              toast({
                title: "Driver Found!",
                description:
                  "A driver has been matched with your ride request!",
              });

              if (onStatusChange) onStatusChange();
            }
          }

          await loadRequests();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadRequests, toast, onStatusChange]);

  const handleRefreshMatching = async (requestId: string) => {
    try {
      setRefreshing(true);

      // Call the automatic matching function
      const { data, error } = await supabase.rpc(
        "auto_match_passenger_with_driver",
        {
          p_request_id: requestId,
        },
      );

      if (error) throw error;

      if (data) {
        toast({
          title: "Success!",
          description: "A driver has been matched with your ride request!",
        });
        await loadRequests();
      } else {
        toast({
          title: "No Match Found",
          description:
            "We couldn't find a driver for your ride at this time. We'll keep searching.",
        });
      }
    } catch (error) {
      console.error("Error refreshing matching:", error);
      toast({
        title: "Error",
        description: "Failed to search for matching drivers",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!requestToDelete) return;

    try {
      const { error } = await supabase
        .from("ride_requests")
        .delete()
        .eq("id", requestToDelete);

      if (error) {
        throw error;
      }

      setRequests((prev) => prev.filter((r) => r.id !== requestToDelete));
      toast({
        title: "Success",
        description: "Ride request deleted successfully",
      });

      if (onStatusChange) onStatusChange();
    } catch (error) {
      console.error("Error deleting ride request:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete ride request",
      });
    } finally {
      setRequestToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const viewDriverDetails = (ride: any) => {
    if (!ride?.driver) {
      toast({
        title: "No Driver Info",
        description: "Driver information is not available.",
      });
      return;
    }

    toast({
      title: `Driver: ${ride.driver.full_name || "Anonymous"}`,
      description: (
        <div className="space-y-2 mt-2">
          <p>
            <strong>Pickup time:</strong>{" "}
            {new Date(ride.scheduled_time).toLocaleString()}
          </p>
          {ride.driver.phone_number && (
            <p>
              <strong>Phone:</strong> {ride.driver.phone_number}
            </p>
          )}
          <p className="mt-2 text-xs">
            You will be notified when the driver starts the ride.
          </p>
        </div>
      ),
      duration: 6000,
    });
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="p-4 space-y-4">
          {requests.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No ride requests found</p>
              <p className="text-sm mt-2">Request a ride to see it here.</p>
            </div>
          ) : (
            requests.map((request) => (
              <Card key={request.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      Ride #{request.id.slice(0, 5)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <RideStatusDisplay status={request.status} />
                    {request.status === "pending" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRequestToDelete(request.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {request.status === "accepted" && request.ride && (
                    <div className="mb-3 p-3 bg-green-50 rounded-md border border-green-200">
                      <p className="text-sm font-medium text-green-800">
                        Driver found for your ride!
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Driver: {request.ride.driver?.full_name || "Anonymous"}
                      </p>
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-700 border-green-200 hover:bg-green-100"
                          onClick={() => viewDriverDetails(request.ride)}
                        >
                          View Driver Details
                        </Button>
                      </div>
                    </div>
                  )}
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
                      {new Date(request.scheduled_time).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Show refresh button for pending requests */}
                {request.status === "pending" && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleRefreshMatching(request.id)}
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Finding Drivers...
                        </>
                      ) : (
                        "Search for Drivers Now"
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      The system is automatically searching for drivers.
                    </p>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Ride Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this ride request? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep It</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRequest}>
              Yes, Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
