import { simpleRideMatching } from "./simpleRideMatching";
import { directRideMatching } from "./rideMatchingFix";
import { supabase } from "./supabase";

/**
 * This file contains helpers to integrate the new ride matching fix into your application
 */

// Flag to control which matching system to use
// Set to true by default to use the direct JavaScript implementation
let useSimpleMatching = true;

/**
 * Enable the simplified matching system
 */
export const enableSimpleRideMatching = () => {
  useSimpleMatching = true;
  console.log("Simple ride matching system enabled");
};

/**
 * Disable the simplified matching system (go back to SQL-based matching)
 */
export const disableSimpleRideMatching = () => {
  useSimpleMatching = false;
  console.log("Simple ride matching system disabled, using SQL-based matching");
};

/**
 * Integrated ride matching function - this is the main entry point you should use
 * It will use either the simple JS-based matching or the original SQL-based system
 * depending on the configuration
 */
export const integratedRideMatching = {
  /**
   * Match a ride request with a ride
   */
  async matchRequestWithRide(requestId: string, rideId: string) {
    if (useSimpleMatching) {
      console.log("Using direct JS-based matching");
      // Use the direct implementation which is more reliable
      return directRideMatching.matchRequestWithRide(requestId, rideId);
    } else {
      console.log("Using original SQL-based matching");
      // Use the original matching logic from SQL functions
      const { data, error } = await supabase.rpc("manual_match_ride_request", {
        p_request_id: requestId,
        p_ride_id: rideId,
      });

      if (error) {
        console.error("Error in SQL-based matching:", error);
        // Fall back to direct matching if SQL fails
        console.log("Falling back to direct matching after SQL error");
        return directRideMatching.matchRequestWithRide(requestId, rideId);
      }

      return {
        success: !!data,
        details: { manualMatchResult: data },
      };
    }
  },

  /**
   * Find the best match for a request and execute the match
   */
  async findAndExecuteBestMatch(requestId: string) {
    if (useSimpleMatching) {
      console.log("Using direct JS-based best match finding");
      // Use the direct implementation which is more reliable
      return directRideMatching.findBestMatchForRequest(requestId);
    } else {
      console.log("Using original SQL-based auto matching");
      // Use the original auto matching logic
      const { data, error } = await supabase.rpc(
        "auto_match_passenger_with_driver",
        {
          p_request_id: requestId,
        },
      );

      if (error) {
        console.error("Error in SQL-based auto matching:", error);
        // Fall back to direct matching if SQL fails
        console.log("Falling back to direct matching after SQL error");
        return directRideMatching.findBestMatchForRequest(requestId);
      }

      // Check if the match was successful by querying the request status
      const { data: updatedRequest, error: requestError } = await supabase
        .from("ride_requests")
        .select("status, ride_id")
        .eq("id", requestId)
        .single();

      if (requestError) {
        console.error("Error checking request status:", requestError);
        return { success: false, matched: false, details: requestError };
      }

      const wasMatched =
        updatedRequest.status === "accepted" && updatedRequest.ride_id !== null;

      return {
        success: true,
        matched: wasMatched,
        details: {
          autoMatchResult: data,
          requestStatus: updatedRequest.status,
          matchedRideId: updatedRequest.ride_id,
        },
      };
    }
  },

  /**
   * Check if a ride and request can be matched
   */
  async checkMatchCompatibility(rideId: string, requestId: string) {
    try {
      // Get both the ride and request details
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

      // Check basic criteria
      // 1. Seats check
      const hasEnoughSeats = ride.seats_available >= request.seats_needed;
      if (!hasEnoughSeats) {
        return {
          isMatch: false,
          details: {
            reason: "Not enough seats available",
            seatsAvailable: ride.seats_available,
            seatsNeeded: request.seats_needed,
          },
        };
      }

      // 2. Status check
      const rideIsAvailable =
        ride.status === "pending" || ride.status === "accepted";
      const requestIsPending = request.status === "pending";
      if (!rideIsAvailable || !requestIsPending) {
        return {
          isMatch: false,
          details: {
            reason: "Ride or request status doesn't allow matching",
            rideStatus: ride.status,
            requestStatus: request.status,
          },
        };
      }

      // 3. Time compatibility check - use a more relaxed 60 minute window
      const rideTime = new Date(ride.scheduled_time).getTime();
      const requestTime = new Date(request.scheduled_time).getTime();
      const timeDiffMinutes = Math.abs(rideTime - requestTime) / (1000 * 60);
      const timeIsCompatible = timeDiffMinutes <= 60; // 60 minutes window
      if (!timeIsCompatible) {
        return {
          isMatch: false,
          details: {
            reason: "Time difference too large",
            timeDifferenceMinutes: timeDiffMinutes,
            maxAllowedMinutes: 60,
          },
        };
      }

      // 4. Distance check (simplified) - use a more relaxed 15km max detour
      // Calculate direct distances
      const pickupDistance = directRideMatching.calculateDistance(
        ride.pickup_latitude,
        ride.pickup_longitude,
        request.pickup_latitude,
        request.pickup_longitude,
      );

      const dropoffDistance = directRideMatching.calculateDistance(
        ride.destination_latitude,
        ride.destination_longitude,
        request.destination_latitude,
        request.destination_longitude,
      );

      const totalDetour = pickupDistance + dropoffDistance;
      const distanceIsAcceptable = totalDetour <= 15; // 15 km max detour (more relaxed)
      if (!distanceIsAcceptable) {
        return {
          isMatch: false,
          details: {
            reason: "Distance too large",
            pickupDistanceKm: pickupDistance,
            dropoffDistanceKm: dropoffDistance,
            totalDetourKm: totalDetour,
            maxAllowedDetourKm: 15,
          },
        };
      }

      // 5. Direction check - use a more relaxed 60 degree difference
      const rideBearing = directRideMatching.calculateBearing(
        ride.pickup_latitude,
        ride.pickup_longitude,
        ride.destination_latitude,
        ride.destination_longitude,
      );

      const requestBearing = directRideMatching.calculateBearing(
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

      const directionIsCompatible = bearingDiff <= 60; // Within 60 degrees (more relaxed)
      if (!directionIsCompatible) {
        return {
          isMatch: false,
          details: {
            reason: "Direction incompatible",
            rideBearing,
            requestBearing,
            bearingDifferenceDegrees: bearingDiff,
            maxAllowedDifferenceDegrees: 60,
          },
        };
      }

      // If we've passed all checks, it's a match!
      return {
        isMatch: true,
        details: {
          pickupDistanceKm: pickupDistance,
          dropoffDistanceKm: dropoffDistance,
          totalDetourKm: totalDetour,
          timeDifferenceMinutes: timeDiffMinutes,
          bearingDifferenceDegrees: bearingDiff,
          seatsAvailable: ride.seats_available,
          seatsNeeded: request.seats_needed,
        },
      };
    } catch (error) {
      console.error("Error checking match compatibility:", error);
      return { isMatch: false, details: error };
    }
  },
};
