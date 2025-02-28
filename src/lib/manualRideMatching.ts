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
    // 1. Get the ride and request details
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (rideError) {
      console.error("Error fetching ride:", rideError);
      return { success: false, error: rideError };
    }

    const { data: request, error: requestError } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError) {
      console.error("Error fetching request:", requestError);
      return { success: false, error: requestError };
    }

    // 2. Update the ride request
    const { data: updatedRequest, error: updateRequestError } = await supabase
      .from("ride_requests")
      .update({
        ride_id: rideId,
        status: "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select();

    if (updateRequestError) {
      console.error("Error updating ride request:", updateRequestError);
      return { success: false, error: updateRequestError };
    }

    // 3. Update the ride's available seats
    const seatsNeeded = request.seats_needed || 1;
    const newSeatsAvailable = Math.max(0, ride.seats_available - seatsNeeded);

    const { data: updatedRide, error: updateRideError } = await supabase
      .from("rides")
      .update({
        seats_available: newSeatsAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rideId)
      .select();

    if (updateRideError) {
      console.error("Error updating ride:", updateRideError);
      return { success: false, error: updateRideError };
    }

    // 4. Create notifications
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: ride.driver_id,
          title: "New Passenger Matched",
          message: `A new passenger has been matched to your ride (Request #${requestId.substring(0, 8)})`,
          type: "ride_matched",
        },
        {
          user_id: request.rider_id,
          title: "Ride Matched",
          message: `You have been matched with a driver for your ride (Request #${requestId.substring(0, 8)})`,
          type: "ride_matched",
        },
      ]);

    if (notificationError) {
      console.error("Error creating notifications:", notificationError);
      // Continue anyway, notifications are not critical
    }

    return {
      success: true,
      data: {
        request: updatedRequest,
        ride: updatedRide,
      },
    };
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
      .eq("status", "accepted");

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
