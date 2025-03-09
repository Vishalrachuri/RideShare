import { supabase } from "./supabase";

import { integratedRideMatching } from "./IntegrateRideMatchingDebug";

/**
 * This function will manually trigger the auto-matching process for a specific ride request
 */
export const triggerAutoMatch = async (requestId: string) => {
  try {
    console.log(`Manually triggering auto-match for request ${requestId}`);

    // Use the integrated approach for finding and executing the best match
    const result =
      await integratedRideMatching.findAndExecuteBestMatch(requestId);

    if (!result.success) {
      console.error("Error in auto-matching:", result.details);
      return { success: false, error: result.details, matched: false };
    }

    if (result.matched) {
      console.log(`Successfully auto-matched request ${requestId}`);
      return { success: true, matched: true, details: result.details };
    }

    // If auto-match didn't work, try the periodic_match_check function
    console.log("Auto-match didn't find a match, trying periodic match check");
    const { data: periodicResult, error: periodicError } = await supabase.rpc(
      "periodic_match_check",
    );

    if (periodicError) {
      console.error("Error in periodic match check:", periodicError);
      return { success: false, error: periodicError, matched: false };
    }

    // Check if the request was matched after periodic check
    const { data: requestData, error: requestError } = await supabase
      .from("ride_requests")
      .select("status, ride_id")
      .eq("id", requestId)
      .single();

    if (requestError) {
      console.error("Error checking request status:", requestError);
      return { success: false, error: requestError, matched: false };
    }

    const wasMatched =
      requestData.status === "accepted" && requestData.ride_id !== null;
    console.log(
      `Request ${requestId} match status after periodic check: ${wasMatched ? "matched" : "not matched"}`,
    );

    return { success: true, matched: wasMatched };
  } catch (error) {
    console.error("Exception in triggerAutoMatch:", error);
    return { success: false, error, matched: false };
  }
};

/**
 * This function will manually trigger the find_passengers_for_ride function for a specific ride
 */
export const triggerFindPassengers = async (rideId: string) => {
  try {
    console.log(
      `Manually triggering find_passengers_for_ride for ride ${rideId}`,
    );

    const { data, error } = await supabase.rpc("find_passengers_for_ride", {
      p_ride_id: rideId,
    });

    if (error) {
      console.error("Error finding passengers for ride:", error);
      return { success: false, error, matchCount: 0 };
    }

    console.log(`Found ${data || 0} passengers for ride ${rideId}`);
    return { success: true, matchCount: data || 0 };
  } catch (error) {
    console.error("Exception in triggerFindPassengers:", error);
    return { success: false, error, matchCount: 0 };
  }
};

/**
 * This function will check if the auto-matching trigger is working properly
 */
export const checkAutoMatchingTrigger = async () => {
  try {
    // Create a test ride
    const { data: rideData, error: rideError } = await supabase
      .from("rides")
      .insert({
        driver_id: "00000000-0000-0000-0000-000000000000", // Test ID
        pickup_latitude: 33.2148,
        pickup_longitude: -97.1331,
        destination_latitude: 32.7767,
        destination_longitude: -96.797,
        scheduled_time: new Date().toISOString(),
        seats_available: 4,
        status: "pending",
      })
      .select()
      .single();

    if (rideError) {
      console.error("Error creating test ride:", rideError);
      return { success: false, error: rideError, triggerWorking: false };
    }

    // Create a test request
    const { data: requestData, error: requestError } = await supabase
      .from("ride_requests")
      .insert({
        rider_id: "00000000-0000-0000-0000-000000000001", // Test ID
        pickup_latitude: 33.2148,
        pickup_longitude: -97.1331,
        destination_latitude: 32.7767,
        destination_longitude: -96.797,
        scheduled_time: new Date().toISOString(),
        seats_needed: 1,
        status: "pending",
        auto_match: true,
      })
      .select()
      .single();

    if (requestError) {
      console.error("Error creating test request:", requestError);
      // Clean up the test ride
      await supabase.from("rides").delete().eq("id", rideData.id);
      return { success: false, error: requestError, triggerWorking: false };
    }

    // Wait a moment for triggers to run
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if the request was matched
    const { data: updatedRequest, error: checkError } = await supabase
      .from("ride_requests")
      .select("status, ride_id")
      .eq("id", requestData.id)
      .single();

    if (checkError) {
      console.error("Error checking request status:", checkError);
      // Clean up
      await supabase.from("rides").delete().eq("id", rideData.id);
      await supabase.from("ride_requests").delete().eq("id", requestData.id);
      return { success: false, error: checkError, triggerWorking: false };
    }

    const wasMatched =
      updatedRequest.status === "accepted" &&
      updatedRequest.ride_id === rideData.id;

    // Clean up the test data
    await supabase.from("ride_requests").delete().eq("id", requestData.id);
    await supabase.from("rides").delete().eq("id", rideData.id);

    return {
      success: true,
      triggerWorking: wasMatched,
      message: wasMatched
        ? "Auto-matching trigger is working correctly"
        : "Auto-matching trigger is not working",
    };
  } catch (error) {
    console.error("Exception in checkAutoMatchingTrigger:", error);
    return { success: false, error, triggerWorking: false };
  }
};
