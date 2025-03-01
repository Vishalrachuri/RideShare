import { supabase } from "./supabase";

/**
 * This function will directly match a ride request with a ride using SQL
 * It bypasses the normal matching logic and forces the match
 */
export const forceMatchRideRequest = async (
  requestId: string,
  rideId: string,
) => {
  try {
    console.log(`Force matching request ${requestId} with ride ${rideId}`);

    // First get the request details to know how many seats are needed
    const { data: request, error: requestError } = await supabase
      .from("ride_requests")
      .select("seats_needed")
      .eq("id", requestId)
      .single();

    if (requestError) {
      console.error("Error getting request details:", requestError);
      return { success: false, error: requestError };
    }

    const seatsNeeded = request.seats_needed || 1;

    // Update the ride to reduce available seats
    const { error: rideError } = await supabase
      .from("rides")
      .update({
        seats_available: supabase.rpc("decrement_seats", {
          seats: seatsNeeded,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rideId)
      .gte("seats_available", seatsNeeded);

    if (rideError) {
      console.error("Error updating ride seats:", rideError);
      return { success: false, error: rideError };
    }

    // Update the request to link it to the ride
    const { error: updateError } = await supabase
      .from("ride_requests")
      .update({
        ride_id: rideId,
        status: "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("Error updating request:", updateError);
      return { success: false, error: updateError };
    }

    // Get driver and rider IDs for notifications
    const { data: ride, error: rideDataError } = await supabase
      .from("rides")
      .select("driver_id")
      .eq("id", rideId)
      .single();

    if (rideDataError) {
      console.error("Error getting ride data:", rideDataError);
      return { success: true, notificationsCreated: false };
    }

    const { data: requestData, error: requestDataError } = await supabase
      .from("ride_requests")
      .select("rider_id")
      .eq("id", requestId)
      .single();

    if (requestDataError) {
      console.error("Error getting request data:", requestDataError);
      return { success: true, notificationsCreated: false };
    }

    // Create notifications for both parties
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: ride.driver_id,
          title: "New Passenger Matched",
          message: "A passenger has been matched with your ride.",
          type: "ride_matched",
        },
        {
          user_id: requestData.rider_id,
          title: "Ride Matched",
          message:
            "You have been matched with a driver going in your direction.",
          type: "ride_matched",
        },
      ]);

    if (notificationError) {
      console.error("Error creating notifications:", notificationError);
      return { success: true, notificationsCreated: false };
    }

    // Dispatch custom event for UI updates
    const matchEvent = new CustomEvent("ride-matched", {
      detail: { requestId, rideId },
    });
    window.dispatchEvent(matchEvent);

    return { success: true, notificationsCreated: true };
  } catch (error) {
    console.error("Exception in forceMatchRideRequest:", error);
    return { success: false, error };
  }
};

/**
 * This function will create a decrement_seats function in the database
 * which is needed for the forceMatchRideRequest function
 */
export const createDecrementSeatsFunction = async () => {
  try {
    const { error } = await supabase.rpc("create_decrement_seats_function");

    if (error) {
      console.error("Error creating decrement_seats function:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in createDecrementSeatsFunction:", error);
    return { success: false, error };
  }
};

/**
 * This function will check if a ride request and ride can be matched
 */
export const checkMatchPossible = async (requestId: string, rideId: string) => {
  try {
    // Get request details
    const { data: request, error: requestError } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError) {
      console.error("Error getting request details:", requestError);
      return { success: false, error: requestError, canMatch: false };
    }

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (rideError) {
      console.error("Error getting ride details:", rideError);
      return { success: false, error: rideError, canMatch: false };
    }

    // Check if ride has enough seats
    if (ride.seats_available < request.seats_needed) {
      return {
        success: true,
        canMatch: false,
        reason: "Not enough seats available",
      };
    }

    // Check if request is already matched
    if (request.ride_id) {
      return {
        success: true,
        canMatch: false,
        reason: "Request already matched to a ride",
      };
    }

    // Check if request is pending
    if (request.status !== "pending") {
      return {
        success: true,
        canMatch: false,
        reason: `Request status is ${request.status}, not pending`,
      };
    }

    // Check if ride is available
    if (ride.status !== "pending" && ride.status !== "accepted") {
      return {
        success: true,
        canMatch: false,
        reason: `Ride status is ${ride.status}, not pending or accepted`,
      };
    }

    return { success: true, canMatch: true };
  } catch (error) {
    console.error("Exception in checkMatchPossible:", error);
    return { success: false, error, canMatch: false };
  }
};
