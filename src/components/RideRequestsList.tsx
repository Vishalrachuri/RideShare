import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
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

interface RideRequest {
  id: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  scheduled_time: string;
  status: string;
  created_at: string;
}

import LocationDisplay from "./LocationDisplay";

export default function RideRequestsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [requestToDelete, setRequestToDelete] = React.useState<string | null>(
    null,
  );
  const [requests, setRequests] = React.useState<RideRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadRequests = React.useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("ride_requests")
      .select("*, ride:ride_id(*, driver:driver_id(*))")
      .eq("rider_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading ride requests:", error);
      return;
    }

    console.log("Loaded ride requests:", data);
    setRequests(data || []);
    setLoading(false);
  }, [user]);

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
          if (payload.eventType === "INSERT") {
            await loadRequests();
          } else if (payload.eventType === "UPDATE") {
            await loadRequests();
          } else if (payload.eventType === "DELETE") {
            await loadRequests();
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, loadRequests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "accepted":
        return "success";
      case "in_progress":
        return "success";
      case "completed":
        return "success";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Searching";
      case "driver_accepted":
        return "Driver Accepted";
      case "accepted":
        return "Driver Found";
      case "in_progress":
        return "In Progress";
      case "pickup_pending":
        return "Pickup Pending";
      case "picked_up":
        return "Picked Up";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading requests...</div>;
  }

  return (
    <>
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No ride requests found
            </div>
          ) : (
            requests.map((request) => (
              <Card key={request.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      Request #{request.id.slice(0, 8)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(request.status)}>
                      {request.ride && request.status === "accepted"
                        ? "Driver Found"
                        : getStatusText(request.status)}
                    </Badge>
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
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {request.status === "accepted" && request.ride && (
                    <div className="mb-3 p-2 bg-green-50 rounded-md border border-green-200">
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
                          onClick={() =>
                            window.alert(
                              `Driver: ${request.ride.driver?.full_name || "Anonymous"}\nPhone: ${request.ride.driver?.phone_number || "Not available"}\nPickup time: ${new Date(request.scheduled_time).toLocaleString()}`,
                            )
                          }
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
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ride Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ride request? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!requestToDelete) return;

                const { error } = await supabase
                  .from("ride_requests")
                  .delete()
                  .eq("id", requestToDelete);

                if (error) {
                  console.error("Error deleting ride request:", error);
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to delete ride request",
                  });
                } else {
                  setRequests((prev) =>
                    prev.filter((r) => r.id !== requestToDelete),
                  );
                  toast({
                    description: "Ride request deleted successfully",
                  });
                }
                setRequestToDelete(null);
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
