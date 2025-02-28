import { supabase } from "./supabase";

/**
 * Manually matches a ride request with a ride
 * This function is used as a fallback when the automatic matching fails
 */
export const manuallyMatchRideRequest = async (
  requestId: string,
  rideId: string,
) => {
  console.log(`Manually matching request ${requestId} with ride ${rideId}`);

  try {
    // Call the backend RPC function for manual matching
    const { data, error } = await supabase.rpc("manual_match_ride_request", {
      p_request_id: requestId,
      p_ride_id: rideId,
    });

    if (error) {
      console.error("Error in manual ride matching:", error);
      return { success: false, error };
    }

    console.log("Successfully matched ride request:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Exception in manual ride matching:", error);
    return { success: false, error };
  }
};

/**
 * Gets all accepted ride requests for a driver
 */
export const getAcceptedRideRequests = async (driverId: string) => {
  try {
    // 1. Get all active rides for the driver
    const { data: rides, error: ridesError } = await supabase
      .from("rides")
      .select("id")
      .eq("driver_id", driverId)
      .in("status", ["pending", "accepted", "in_progress"]);

    if (ridesError) {
      console.error("Error fetching rides:", ridesError);
      return { success: false, error: ridesError };
    }

    if (!rides || rides.length === 0) {
      return { success: true, data: [] };
    }

    const rideIds = rides.map((ride) => ride.id);

    // 2. Get all accepted ride requests for these rides
    const { data: requests, error: requestsError } = await supabase
      .from("ride_requests")
      .select(
        `
        *,
        rider:rider_id(*),
        ride:ride_id(*)
      `,
      )
      .in("ride_id", rideIds)
      .in("status", [
        "accepted",
        "driver_accepted",
        "in_progress",
        "picked_up",
      ]);

    if (requestsError) {
      console.error("Error fetching ride requests:", requestsError);
      return { success: false, error: requestsError };
    }

    return { success: true, data: requests || [] };
  } catch (error) {
    console.error("Exception in getAcceptedRideRequests:", error);
    return { success: false, error };
  }
};

/**
 * Fix a ride request that has matching issues
 */
export const fixRideRequest = async (requestId: string, rideId: string) => {
  try {
    console.log(`Fixing ride request ${requestId} for ride ${rideId}`);

    // Direct database update with explicit status
    const { data, error } = await supabase
      .from("ride_requests")
      .update({
        ride_id: rideId,
        status: "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select();

    if (error) {
      console.error("Error fixing ride request:", error);
      return { success: false, error };
    }

    console.log("Successfully fixed ride request:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Exception fixing ride request:", error);
    return { success: false, error };
  }
};

/**
 * Check the status of a ride request
 */
export const checkRideRequest = async (requestId: string) => {
  try {
    const { data, error } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (error) {
      console.error("Error checking ride request:", error);
      return { success: false, error };
    }

    console.log("Ride request status:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Exception checking ride request:", error);
    return { success: false, error };
  }
};
