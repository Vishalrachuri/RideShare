import { supabase } from "./supabase";

// This function will periodically check for new matches
let matchingInterval: number | null = null;

/**
 * Start the ride matching worker which listens for new ride requests
 * and attempts to match them with available rides
 */
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

                // Try to automatically match
                const { data: matchResult } = await supabase.rpc(
                  "auto_match_passenger_with_driver",
                  { p_request_id: request.id },
                );

                if (matchResult) {
                  console.log(
                    `Automatically matched request ${request.id} with a ride`,
                  );

                  // Create notification for passenger
                  await supabase.from("notifications").insert({
                    user_id: request.rider_id,
                    title: "Ride Matched",
                    message:
                      "You've been matched with a driver going your way!",
                    type: "ride_matched",
                  });
                }

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

/**
 * Run a periodic match check to find matches for existing requests
 */
export const runPeriodicMatchCheck = async () => {
  try {
    console.log("Running periodic match check");
    const { data, error } = await supabase.rpc("periodic_match_check");

    if (error) {
      console.error("Error in periodic match check:", error);
      return { success: false, error, matchCount: 0 };
    }

    console.log(`Periodic match check found ${data || 0} new matches`);
    return { success: true, matchCount: data || 0 };
  } catch (error) {
    console.error("Exception in periodic match check:", error);
    return { success: false, error, matchCount: 0 };
  }
};

/**
 * Start a timer that periodically checks for matches
 * @param intervalMinutes How often to check for matches (in minutes)
 */
export const startPeriodicMatchingTimer = (intervalMinutes: number = 5) => {
  if (matchingInterval) {
    clearInterval(matchingInterval);
  }

  // Convert minutes to milliseconds
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(
    `Starting periodic matching timer (every ${intervalMinutes} minutes)`,
  );

  // Initial run
  runPeriodicMatchCheck();

  // Set interval for future runs
  matchingInterval = window.setInterval(() => {
    runPeriodicMatchCheck();
  }, intervalMs);

  return () => {
    if (matchingInterval) {
      clearInterval(matchingInterval);
      matchingInterval = null;
    }
  };
};

/**
 * Stop the periodic matching timer
 */
export const stopPeriodicMatchingTimer = () => {
  if (matchingInterval) {
    clearInterval(matchingInterval);
    matchingInterval = null;
    console.log("Periodic matching timer stopped");
  }
};

/**
 * Handle expired rides and requests
 */
export const handleExpiredRidesAndRequests = async () => {
  try {
    const { data, error } = await supabase.rpc("handle_expired_requests");

    if (error) {
      console.error("Error handling expired requests:", error);
      return { success: false, error, count: 0 };
    }

    console.log(`Handled ${data || 0} expired rides/requests`);
    return { success: true, count: data || 0 };
  } catch (error) {
    console.error("Exception handling expired requests:", error);
    return { success: false, error, count: 0 };
  }
};

/**
 * Start a timer to periodically clean up expired rides and requests
 * @param intervalMinutes How often to check for expired items (in minutes)
 */
export const startExpirationTimer = (intervalMinutes: number = 15) => {
  // Convert minutes to milliseconds
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`Starting expiration timer (every ${intervalMinutes} minutes)`);

  // Initial run
  handleExpiredRidesAndRequests();

  // Set interval for future runs
  const expirationInterval = window.setInterval(() => {
    handleExpiredRidesAndRequests();
  }, intervalMs);

  return () => {
    clearInterval(expirationInterval);
    console.log("Expiration timer stopped");
  };
};
