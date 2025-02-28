import { supabase } from "./supabase";

// This function will periodically check for new matches
let matchingInterval: number | null = null;

export const startRideMatchingWorker = () => {
  console.log("Starting ride matching worker...");

  const channel = supabase
    .channel("ride_matching")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "ride_requests",
      },
      async (payload) => {
        try {
          if (
            payload.eventType === "INSERT" &&
            payload.new.status === "pending"
          ) {
            console.log("New ride request received:", payload.new);
            const request = payload.new;

            // Get active rides that could match
            const { data: activeRides, error: ridesError } = await supabase
              .from("rides")
              .select("*")
              .eq("status", "pending")
              .gt("seats_available", request.seats_needed || 1)
              .gte(
                "scheduled_time",
                new Date(new Date().getTime() - 30 * 60000).toISOString(),
              )
              .lte(
                "scheduled_time",
                new Date(new Date().getTime() + 30 * 60000).toISOString(),
              );

            if (ridesError) throw ridesError;
            if (!activeRides?.length) return;

            // Check each ride for a match
            for (const ride of activeRides) {
              // Check if ride matches request criteria
              const { data: isMatch } = await supabase.rpc("check_ride_match", {
                p_ride_id: ride.id,
                p_request_id: request.id,
                max_detour_km: 5.0,
                max_time_diff_minutes: 30,
              });

              if (isMatch) {
                // Create notification for driver
                await supabase.from("notifications").insert({
                  user_id: ride.driver_id,
                  title: "New Ride Match",
                  message: "A passenger is looking for a ride along your route",
                  type: "ride_match",
                });
                break; // Stop after first match
              }
            }
          }
        } catch (error) {
          console.error("Error in ride matching worker:", error);
        }
      },
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};
