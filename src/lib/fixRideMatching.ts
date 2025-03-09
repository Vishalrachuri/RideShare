import { supabase } from "./supabase";

/**
 * Fix a ride request by manually updating its ride_id and status
 * This is a utility function for handling edge cases where automatic matching fails
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

    // Also update the ride's available seats if needed
    const { data: requestData } = await supabase
      .from("ride_requests")
      .select("seats_needed")
      .eq("id", requestId)
      .single();

    if (requestData) {
      const seatsNeeded = requestData.seats_needed || 1;

      const { data: rideData } = await supabase
        .from("rides")
        .select("seats_available")
        .eq("id", rideId)
        .single();

      if (rideData) {
        const newSeatsAvailable = Math.max(
          0,
          rideData.seats_available - seatsNeeded,
        );

        await supabase
          .from("rides")
          .update({
            seats_available: newSeatsAvailable,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rideId);
      }
    }

    // Create notifications
    const { data: requestInfo } = await supabase
      .from("ride_requests")
      .select("rider_id")
      .eq("id", requestId)
      .single();

    const { data: rideInfo } = await supabase
      .from("rides")
      .select("driver_id")
      .eq("id", rideId)
      .single();

    if (requestInfo && rideInfo) {
      // Notify both passenger and driver
      await supabase.from("notifications").insert([
        {
          user_id: requestInfo.rider_id,
          title: "Ride Matched",
          message: "You have been matched with a driver for your ride request.",
          type: "ride_matched",
        },
        {
          user_id: rideInfo.driver_id,
          title: "New Passenger Matched",
          message: "A passenger has been matched with your ride.",
          type: "ride_matched",
        },
      ]);
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
 * This is a diagnostic function for troubleshooting matching issues
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

import { integratedRideMatching } from "./IntegrateRideMatchingDebug";

/**
 * Check the match quality between a ride and a request
 * This is a diagnostic function to see why matching may have failed
 */
export const checkMatchQuality = async (requestId: string, rideId: string) => {
  try {
    // Use the integrated approach for checking match compatibility
    const result = await integratedRideMatching.checkMatchCompatibility(
      rideId,
      requestId,
    );

    if (!result.isMatch) {
      console.log("Match quality check failed:", result.details);
      return { success: true, isMatch: false, details: result.details };
    }

    return { success: true, isMatch: true, details: result.details };
  } catch (error) {
    console.error("Exception in checking match quality:", error);
    return { success: false, error, isMatch: false };
  }
};

/**
 * Force a run of the matching algorithm
 * This is useful for manually triggering matching when needed
 */
export const forceMatchingRun = async () => {
  try {
    const { data, error } = await supabase.rpc("periodic_match_check");

    if (error) {
      console.error("Error in force matching run:", error);
      return { success: false, error, matchCount: 0 };
    }

    console.log(`Force matching run found ${data || 0} matches`);
    return { success: true, matchCount: data || 0 };
  } catch (error) {
    console.error("Exception in force matching run:", error);
    return { success: false, error, matchCount: 0 };
  }
};
