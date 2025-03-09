import { supabase } from "./supabase";

/**
 * Utility function to get passenger ride details
 * This uses the backend function get_passenger_ride_details
 */
export const getPassengerRideDetails = async (passengerId: string) => {
  try {
    // First try the RPC function
    const { data, error } = await supabase.rpc("get_passenger_ride_details", {
      p_rider_id: passengerId,
    });

    if (!error && data) {
      return { success: true, data };
    }

    // Fallback to direct query if RPC fails
    console.log("RPC failed, falling back to direct query", error);
    const { data: requestData, error: requestError } = await supabase
      .from("ride_requests")
      .select("*, ride:ride_id(*, driver:driver_id(*))")
      .eq("rider_id", passengerId)
      .in("status", [
        "accepted",
        "driver_accepted",
        "in_progress",
        "pickup_pending",
        "picked_up",
      ])
      .order("created_at", { ascending: false })
      .limit(1);

    if (requestError) {
      console.error("Error in fallback query:", requestError);
      return { success: false, error: requestError, data: null };
    }

    if (requestData && requestData.length > 0 && requestData[0].ride) {
      const ride = requestData[0].ride;
      const driver = ride.driver;

      return {
        success: true,
        data: {
          driver_name: driver?.full_name || "Unknown Driver",
          driver_id: driver?.id,
          ride_id: ride.id,
          ride_status: requestData[0].status,
          driver_lat: ride.current_location_latitude,
          driver_long: ride.current_location_longitude,
          scheduled_time: ride.scheduled_time,
          pickup_lat: requestData[0].pickup_latitude,
          pickup_long: requestData[0].pickup_longitude,
          dropoff_lat: requestData[0].destination_latitude,
          dropoff_long: requestData[0].destination_longitude,
          chat_link: `/chat/${driver?.id}`,
          call_number: driver?.phone_number,
        },
      };
    }

    return { success: false, error: new Error("No ride found"), data: null };
  } catch (error) {
    console.error("Exception in getPassengerRideDetails:", error);
    return { success: false, error, data: null };
  }
};

/**
 * Utility function to get upcoming rides for a driver
 * This uses the backend function get_upcoming_rides
 */
export const getUpcomingRides = async (driverId: string) => {
  try {
    const { data, error } = await supabase.rpc("get_upcoming_rides", {
      driver_id: driverId,
    });

    if (error) {
      console.error("Error getting upcoming rides:", error);
      return { success: false, error, data: null };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Exception in getUpcomingRides:", error);
    return { success: false, error, data: null };
  }
};

/**
 * Utility function to start a ride
 * This uses the backend function start_ride
 */
export const startRide = async (rideId: string) => {
  try {
    const { data, error } = await supabase.rpc("start_ride", {
      p_ride_id: rideId,
    });

    if (error) {
      console.error("Error starting ride:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in startRide:", error);
    return { success: false, error };
  }
};

/**
 * Utility function to complete a ride
 * This uses the backend function complete_ride
 */
export const completeRide = async (rideId: string) => {
  try {
    const { data, error } = await supabase.rpc("complete_ride", {
      p_ride_id: rideId,
    });

    if (error) {
      console.error("Error completing ride:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in completeRide:", error);
    return { success: false, error };
  }
};

/**
 * Cancel a ride request
 */
export const cancelRideRequest = async (
  requestId: string,
  reason: string = "Cancelled by user",
) => {
  try {
    const { data, error } = await supabase.rpc("cancel_ride_request", {
      p_request_id: requestId,
      p_reason: reason,
    });

    if (error) {
      console.error("Error cancelling ride request:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in cancelRideRequest:", error);
    return { success: false, error };
  }
};

/**
 * Cancel a ride
 */
export const cancelRide = async (
  rideId: string,
  reason: string = "Cancelled by driver",
) => {
  try {
    const { data, error } = await supabase.rpc("cancel_ride", {
      p_ride_id: rideId,
      p_reason: reason,
    });

    if (error) {
      console.error("Error cancelling ride:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in cancelRide:", error);
    return { success: false, error };
  }
};

/**
 * Find matching passengers for a ride
 */
export const findPassengersForRide = async (rideId: string) => {
  try {
    console.log(`Finding passengers for ride ${rideId}`);

    // First get the ride details
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (rideError) {
      console.error("Error fetching ride details:", rideError);
      return { success: false, error: rideError, matchCount: 0 };
    }

    console.log("Ride details:", {
      pickup: [ride.pickup_latitude, ride.pickup_longitude],
      dropoff: [ride.destination_latitude, ride.destination_longitude],
      time: ride.scheduled_time,
      seats: ride.seats_available,
    });

    // Get pending ride requests that could match
    const { data: requests, error: requestsError } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("status", "pending")
      .lte("seats_needed", ride.seats_available);

    if (requestsError) {
      console.error("Error fetching ride requests:", requestsError);
      return { success: false, error: requestsError, matchCount: 0 };
    }

    console.log(`Found ${requests?.length || 0} potential requests to match`);

    // Try to match each request
    let matchCount = 0;

    if (requests && requests.length > 0) {
      for (const request of requests) {
        console.log(
          `Checking request ${request.id} for match with ride ${rideId}`,
        );
        console.log("Request details:", {
          pickup: [request.pickup_latitude, request.pickup_longitude],
          dropoff: [
            request.destination_latitude,
            request.destination_longitude,
          ],
          time: request.scheduled_time,
          seats: request.seats_needed,
        });

        // Use the integrated approach to check compatibility
        const compatibilityResult =
          await integratedRideMatching.checkMatchCompatibility(
            rideId,
            request.id,
          );

        console.log(
          `Match result for request ${request.id}:`,
          compatibilityResult.isMatch,
        );

        if (compatibilityResult.isMatch) {
          // Try to match this request with the ride using the integrated approach
          const matchResult = await integratedRideMatching.matchRequestWithRide(
            request.id,
            rideId,
          );

          if (matchResult.success) {
            console.log(
              `Successfully matched request ${request.id} with ride ${rideId}`,
            );
            matchCount++;

            // Create notifications
            await supabase.from("notifications").insert([
              {
                user_id: request.rider_id,
                title: "Ride Matched",
                message: "You've been matched with a driver going your way!",
                type: "ride_matched",
              },
              {
                user_id: ride.driver_id,
                title: "New Passenger Matched",
                message: "A passenger has been matched with your ride.",
                type: "ride_matched",
              },
            ]);

            // Dispatch custom event for UI updates
            const matchEvent = new CustomEvent("ride-matched", {
              detail: { requestId: request.id, rideId },
            });
            window.dispatchEvent(matchEvent);
          } else {
            console.error(
              `Error matching request ${request.id}:`,
              matchResult.details,
            );
          }
        }
      }
    }

    console.log(
      `Found and matched ${matchCount} passengers for ride ${rideId}`,
    );
    return { success: true, matchCount };
  } catch (error) {
    console.error("Exception in findPassengersForRide:", error);
    return { success: false, error, matchCount: 0 };
  }
};

import { integratedRideMatching } from "./IntegrateRideMatchingDebug";

/**
 * Attempt to automatically match a passenger with a driver
 */
export const autoMatchPassenger = async (requestId: string) => {
  try {
    console.log(
      `Attempting to auto-match passenger for request ID: ${requestId}`,
    );

    // Use the integrated approach for finding and executing the best match
    const result =
      await integratedRideMatching.findAndExecuteBestMatch(requestId);

    console.log(`Auto-match result for request ${requestId}:`, result);

    if (!result.success) {
      console.error("Error auto-matching passenger:", result.details);
      return { success: false, error: result.details, matched: false };
    }

    return {
      success: true,
      matched: result.matched,
      details: result.details,
    };
  } catch (error) {
    console.error("Exception in autoMatchPassenger:", error);
    return { success: false, error, matched: false };
  }
};
