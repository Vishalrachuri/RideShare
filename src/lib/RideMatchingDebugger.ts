import { supabase } from "./supabase";

export const debugRideMatching = {
  // Test if two specific coordinates are a valid match
  async testCoordinateMatch(
    rideId: string,
    requestId: string,
  ): Promise<{ success: boolean; details: any }> {
    try {
      // First, get both the ride and request details
      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .single();

      if (rideError) throw rideError;

      const { data: request, error: requestError } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      console.log("Testing match between:", {
        ride: {
          id: ride.id,
          pickup: [ride.pickup_latitude, ride.pickup_longitude],
          dropoff: [ride.destination_latitude, ride.destination_longitude],
          time: ride.scheduled_time,
          seats: ride.seats_available,
        },
        request: {
          id: request.id,
          pickup: [request.pickup_latitude, request.pickup_longitude],
          dropoff: [
            request.destination_latitude,
            request.destination_longitude,
          ],
          time: request.scheduled_time,
          seats: request.seats_needed,
        },
      });

      // Call the backend check_ride_match function
      const { data: isMatch, error: matchError } = await supabase.rpc(
        "check_ride_match",
        {
          ride_id: rideId,
          request_id: requestId,
          max_detour_km: 10.0, // Increased from default 5.0 for testing
          max_time_diff_minutes: 60, // Increased from default 30 for testing
        },
      );

      if (matchError) throw matchError;

      // Calculate direct distances to check our assumptions
      const directPickupDistance = this.calculateDistance(
        ride.pickup_latitude,
        ride.pickup_longitude,
        request.pickup_latitude,
        request.pickup_longitude,
      );

      const directDropoffDistance = this.calculateDistance(
        ride.destination_latitude,
        ride.destination_longitude,
        request.destination_latitude,
        request.destination_longitude,
      );

      // Calculate time difference
      const rideDate = new Date(ride.scheduled_time);
      const requestDate = new Date(request.scheduled_time);
      const timeDiffMinutes =
        Math.abs(rideDate.getTime() - requestDate.getTime()) / (1000 * 60);

      // Calculate direction similarity
      const rideBearing = this.calculateBearing(
        ride.pickup_latitude,
        ride.pickup_longitude,
        ride.destination_latitude,
        ride.destination_longitude,
      );

      const requestBearing = this.calculateBearing(
        request.pickup_latitude,
        request.pickup_longitude,
        request.destination_latitude,
        request.destination_longitude,
      );

      const bearingDiff = Math.min(
        Math.abs(rideBearing - requestBearing),
        Math.abs(rideBearing - requestBearing + 360),
        Math.abs(rideBearing - requestBearing - 360),
      );

      // Return detailed match information
      return {
        success: true,
        details: {
          isMatch,
          directPickupDistance: `${directPickupDistance.toFixed(2)} km`,
          directDropoffDistance: `${directDropoffDistance.toFixed(2)} km`,
          totalDetourDistance: `${(directPickupDistance + directDropoffDistance).toFixed(2)} km`,
          timeDifference: `${timeDiffMinutes.toFixed(2)} minutes`,
          rideBearing: `${rideBearing.toFixed(2)}°`,
          requestBearing: `${requestBearing.toFixed(2)}°`,
          bearingDifference: `${bearingDiff.toFixed(2)}°`,
          isBearingSimilar: bearingDiff <= 45,
          isTimeCompatible: timeDiffMinutes <= 60,
          seatsAvailable: ride.seats_available,
          seatsNeeded: request.seats_needed,
          hasEnoughSeats: ride.seats_available >= request.seats_needed,
        },
      };
    } catch (error) {
      console.error("Error testing coordinate match:", error);
      return { success: false, details: error };
    }
  },

  // Test the manual match function
  async testManualMatch(
    rideId: string,
    requestId: string,
  ): Promise<{ success: boolean; isMatched: boolean; details: any }> {
    try {
      // First check if they match according to check_ride_match
      const matchCheck = await this.testCoordinateMatch(rideId, requestId);

      if (!matchCheck.success) {
        return {
          success: false,
          isMatched: false,
          details: matchCheck.details,
        };
      }

      // If they match, try manual matching
      if (matchCheck.details.isMatch) {
        const { data: manualMatchResult, error: manualMatchError } =
          await supabase.rpc("manual_match_ride_request", {
            p_request_id: requestId,
            p_ride_id: rideId,
          });

        if (manualMatchError) throw manualMatchError;

        return {
          success: true,
          isMatched: !!manualMatchResult,
          details: {
            ...matchCheck.details,
            manualMatchResult,
          },
        };
      }

      return {
        success: true,
        isMatched: false,
        details: {
          ...matchCheck.details,
          reason: "Coordinate match check failed",
        },
      };
    } catch (error) {
      console.error("Error testing manual match:", error);
      return { success: false, isMatched: false, details: error };
    }
  },

  // Test the auto match function
  async testAutoMatch(
    requestId: string,
  ): Promise<{ success: boolean; isMatched: boolean; details: any }> {
    try {
      const { data: autoMatchResult, error: autoMatchError } =
        await supabase.rpc("auto_match_passenger_with_driver", {
          p_request_id: requestId,
        });

      if (autoMatchError) throw autoMatchError;

      // Get request details after attempted match
      const { data: request, error: requestError } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      const wasMatched =
        request.status === "accepted" && request.ride_id !== null;

      return {
        success: true,
        isMatched: wasMatched,
        details: {
          autoMatchResult,
          requestAfterMatch: {
            status: request.status,
            ride_id: request.ride_id,
          },
        },
      };
    } catch (error) {
      console.error("Error testing auto match:", error);
      return { success: false, isMatched: false, details: error };
    }
  },

  // Force a match between a ride and request with SQL direct update
  async forceMatch(
    rideId: string,
    requestId: string,
  ): Promise<{ success: boolean; isMatched: boolean; details: any }> {
    try {
      // Get request details
      const { data: request, error: requestError } = await supabase
        .from("ride_requests")
        .select("seats_needed, rider_id")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      // Get ride details
      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .select("seats_available, driver_id")
        .eq("id", rideId)
        .single();

      if (rideError) throw rideError;

      // Check if the ride has enough seats
      if (ride.seats_available < request.seats_needed) {
        return {
          success: false,
          isMatched: false,
          details: {
            error: "Not enough seats available",
            seatsAvailable: ride.seats_available,
            seatsNeeded: request.seats_needed,
          },
        };
      }

      // Update the ride to reduce available seats
      const { error: updateRideError } = await supabase
        .from("rides")
        .update({
          seats_available: ride.seats_available - request.seats_needed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      if (updateRideError) throw updateRideError;

      // Update the request to match with the ride
      const { error: updateRequestError } = await supabase
        .from("ride_requests")
        .update({
          ride_id: rideId,
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateRequestError) throw updateRequestError;

      // Create notifications for both driver and rider
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
            user_id: request.rider_id,
            title: "Ride Matched",
            message:
              "You have been matched with a driver going in your direction.",
            type: "ride_matched",
          },
        ]);

      if (notificationError) throw notificationError;

      return {
        success: true,
        isMatched: true,
        details: {
          rideId,
          requestId,
          seatsAvailable: ride.seats_available - request.seats_needed,
          status: "accepted",
        },
      };
    } catch (error) {
      console.error("Error forcing match:", error);
      return { success: false, isMatched: false, details: error };
    }
  },

  // Helper function to calculate distance between two points (Haversine formula)
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  // Helper function to calculate bearing between two points
  calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const startLat = (lat1 * Math.PI) / 180;
    const startLng = (lon1 * Math.PI) / 180;
    const destLat = (lat2 * Math.PI) / 180;
    const destLng = (lon2 * Math.PI) / 180;

    const y = Math.sin(destLng - startLng) * Math.cos(destLat);
    const x =
      Math.cos(startLat) * Math.sin(destLat) -
      Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    let brng = (Math.atan2(y, x) * 180) / Math.PI;

    // Normalize to 0-360
    return (brng + 360) % 360;
  },
};
