import { supabase } from "./supabase";
import { integratedRideMatching } from "./IntegrateRideMatchingDebug";

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

            // Use the integrated ride matching to find the best match
            const result = await integratedRideMatching.findAndExecuteBestMatch(
              request.id,
            );

            if (result.success && result.matched) {
              console.log(
                `Successfully matched request ${request.id} with ride ${result.details.matchedRideId}`,
              );

              // Dispatch custom event for UI updates
              const matchEvent = new CustomEvent("ride-matched", {
                detail: {
                  requestId: request.id,
                  rideId: result.details.matchedRideId,
                },
              });
              window.dispatchEvent(matchEvent);
            } else {
              console.log(
                `No match found for request ${request.id}:`,
                result.details?.reason || "Unknown reason",
              );

              // Fallback to checking each ride manually with more relaxed parameters
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

                // Use the integrated approach to check compatibility
                const compatibilityResult =
                  await integratedRideMatching.checkMatchCompatibility(
                    ride.id,
                    request.id,
                  );

                console.log(
                  `Match result for ride ${ride.id}:`,
                  compatibilityResult.isMatch,
                );

                if (compatibilityResult.isMatch) {
                  console.log(
                    `Found match between ride ${ride.id} and request ${request.id}`,
                  );

                  // Create notification for driver
                  await supabase.from("notifications").insert({
                    user_id: ride.driver_id,
                    title: "New Ride Match",
                    message:
                      "A passenger is looking for a ride along your route",
                    type: "ride_match",
                  });

                  // Try to match using the integrated approach
                  const matchResult =
                    await integratedRideMatching.matchRequestWithRide(
                      request.id,
                      ride.id,
                    );

                  if (matchResult.success) {
                    console.log(
                      `Successfully matched request ${request.id} with ride ${ride.id}`,
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
                      `Matching failed for request ${request.id} with ride ${ride.id}:`,
                      matchResult.details,
                    );
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

    // Get all pending ride requests
    const { data: pendingRequests, error: requestsError } = await supabase
      .from("ride_requests")
      .select("id")
      .eq("status", "pending");

    if (requestsError) {
      console.error("Error fetching pending requests:", requestsError);
      return { success: false, error: requestsError, matchCount: 0 };
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      console.log("No pending requests found for matching");
      return { success: true, matchCount: 0 };
    }

    console.log(`Found ${pendingRequests.length} pending requests to match`);

    // Try to match each pending request
    let matchCount = 0;
    for (const request of pendingRequests) {
      console.log(`Attempting to match request ${request.id}`);

      // Use the integrated approach to find and execute the best match
      const result = await integratedRideMatching.findAndExecuteBestMatch(
        request.id,
      );

      if (result.success && result.matched) {
        console.log(`Successfully matched request ${request.id}`);
        matchCount++;
      }
    }

    console.log(`Periodic match check found ${matchCount} new matches`);
    return { success: true, matchCount };
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
