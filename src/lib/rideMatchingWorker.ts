import { supabase } from "./supabase";

// This function will periodically check for new matches
let matchingInterval: number | null = null;

/**
 * Start the ride matching worker which listens for new ride requests
 * and attempts to match them with available rides
 */
export const startRideMatchingWorker = () => {
  console.log("Starting ride matching worker...");

  // Start the periodic matching timer
  startPeriodicMatchingTimer(2); // Check every 2 minutes

  // Start the expiration timer
  startExpirationTimer(15); // Check every 15 minutes

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

            // Get active rides that could match - with more relaxed time constraints
            const { data: activeRides, error: ridesError } = await supabase
              .from("rides")
              .select("*")
              .eq("status", "pending")
              .gte("seats_available", request.seats_needed || 1)
              .gte(
                "scheduled_time",
                new Date(new Date().getTime() - 60 * 60000).toISOString(), // 60 minutes before
              )
              .lte(
                "scheduled_time",
                new Date(new Date().getTime() + 60 * 60000).toISOString(), // 60 minutes after
              );

            if (ridesError) throw ridesError;

            if (!activeRides?.length) {
              console.log("No active rides found for matching");
              return;
            }

            console.log(
              `Found ${activeRides.length} potential rides for matching`,
            );

            // Check each ride for a match
            for (const ride of activeRides) {
              console.log(
                `Checking ride ${ride.id} for match with request ${request.id}`,
              );
              console.log("Ride details:", {
                pickup: [ride.pickup_latitude, ride.pickup_longitude],
                dropoff: [
                  ride.destination_latitude,
                  ride.destination_longitude,
                ],
                time: ride.scheduled_time,
              });
              console.log("Request details:", {
                pickup: [request.pickup_latitude, request.pickup_longitude],
                dropoff: [
                  request.destination_latitude,
                  request.destination_longitude,
                ],
                time: request.scheduled_time,
              });

              // Check if ride matches request criteria with more relaxed parameters
              const { data: isMatch } = await supabase.rpc("check_ride_match", {
                p_ride_id: ride.id,
                p_request_id: request.id,
                max_detour_km: 10.0, // Increased from 5.0
                max_time_diff_minutes: 60, // Increased from 30
              });

              console.log(`Match result for ride ${ride.id}:`, isMatch);

              if (isMatch) {
                console.log(
                  `Found match between ride ${ride.id} and request ${request.id}`,
                );

                // Create notification for driver
                await supabase.from("notifications").insert({
                  user_id: ride.driver_id,
                  title: "New Ride Match",
                  message: "A passenger is looking for a ride along your route",
                  type: "ride_match",
                });

                // Try to automatically match
                const { data: matchResult, error: matchError } =
                  await supabase.rpc("auto_match_passenger_with_driver", {
                    p_request_id: request.id,
                  });

                if (matchError) {
                  console.error("Error in auto matching:", matchError);
                }

                if (matchResult) {
                  console.log(
                    `Automatically matched request ${request.id} with ride ${ride.id}`,
                  );

                  // Create notification for passenger
                  await supabase.from("notifications").insert({
                    user_id: request.rider_id,
                    title: "Ride Matched",
                    message:
                      "You've been matched with a driver going your way!",
                    type: "ride_matched",
                  });

                  // Dispatch custom event for UI updates
                  const matchEvent = new CustomEvent("ride-matched", {
                    detail: { requestId: request.id, rideId: ride.id },
                  });
                  window.dispatchEvent(matchEvent);

                  break; // Stop after first match
                } else {
                  console.log(
                    `Auto-matching failed for request ${request.id} with ride ${ride.id}`,
                  );
                  // Try manual matching as fallback
                  try {
                    const { data: manualMatchResult, error: manualMatchError } =
                      await supabase.rpc("manual_match_ride_request", {
                        p_request_id: request.id,
                        p_ride_id: ride.id,
                      });

                    if (manualMatchError) throw manualMatchError;

                    if (manualMatchResult) {
                      console.log(
                        `Manually matched request ${request.id} with ride ${ride.id}`,
                      );

                      // Create notifications
                      await supabase.from("notifications").insert([
                        {
                          user_id: request.rider_id,
                          title: "Ride Matched",
                          message:
                            "You've been matched with a driver going your way!",
                          type: "ride_matched",
                        },
                        {
                          user_id: ride.driver_id,
                          title: "New Passenger Matched",
                          message:
                            "A passenger has been matched with your ride.",
                          type: "ride_matched",
                        },
                      ]);

                      // Dispatch custom event for UI updates
                      const matchEvent = new CustomEvent("ride-matched", {
                        detail: { requestId: request.id, rideId: ride.id },
                      });
                      window.dispatchEvent(matchEvent);

                      break; // Stop after successful match
                    }
                  } catch (manualError) {
                    console.error("Error in manual matching:", manualError);
                  }
                }
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
