import { supabase } from "./supabase";

/**
 * A simplified ride matching function that handles matching logic in TypeScript
 * instead of relying entirely on the SQL functions
 */
export const simpleRideMatching = {
  /**
   * Find all potential matches for a ride request
   */
  async findMatchesForRequest(
    requestId: string,
    maxMatches: number = 5,
  ): Promise<{ success: boolean; matches: any[] }> {
    try {
      // Get the request details
      const { data: request, error: requestError } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      // Find potential rides based on basic criteria
      const { data: potentialRides, error: ridesError } = await supabase
        .from("rides")
        .select("*, driver:driver_id(full_name)")
        .in("status", ["pending", "accepted"])
        .gte("seats_available", request.seats_needed)
        .gte("scheduled_time", new Date(Date.now()).toISOString()) // Only future rides
        .order("scheduled_time", { ascending: true })
        .limit(20); // Get a reasonable number to filter further

      if (ridesError) throw ridesError;

      if (!potentialRides || potentialRides.length === 0) {
        return { success: true, matches: [] };
      }

      // Evaluate each potential ride
      const matchResults = await Promise.all(
        potentialRides.map(async (ride) => {
          try {
            const matchCheck = await this.checkSimpleMatch(ride.id, requestId);

            if (matchCheck.isMatch) {
              // Calculate a match score (0-100)
              const pickupDistance = this.calculateDistance(
                ride.pickup_latitude,
                ride.pickup_longitude,
                request.pickup_latitude,
                request.pickup_longitude,
              );

              const dropoffDistance = this.calculateDistance(
                ride.destination_latitude,
                ride.destination_longitude,
                request.destination_latitude,
                request.destination_longitude,
              );

              const rideTime = new Date(ride.scheduled_time).getTime();
              const requestTime = new Date(request.scheduled_time).getTime();
              const timeDiffMinutes =
                Math.abs(rideTime - requestTime) / (1000 * 60);

              // Calculate score components (higher is better)
              const distanceScore =
                100 -
                Math.min(100, ((pickupDistance + dropoffDistance) / 10) * 100);
              const timeScore =
                100 - Math.min(100, (timeDiffMinutes / 60) * 100);

              // Combined score (weighted)
              const matchScore = Math.round(
                distanceScore * 0.7 + timeScore * 0.3,
              );

              return {
                ride,
                isMatch: true,
                score: matchScore,
                details: {
                  ...matchCheck.details,
                  driverName: ride.driver?.full_name || "Unknown Driver",
                },
              };
            }

            return null; // Not a match
          } catch (error) {
            console.error(`Error checking match for ride ${ride.id}:`, error);
            return null;
          }
        }),
      );

      // Filter out non-matches and sort by score descending
      const validMatches = matchResults
        .filter((match) => match !== null && match.isMatch)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxMatches);

      return { success: true, matches: validMatches };
    } catch (error) {
      console.error("Error in findMatchesForRequest:", error);
      return { success: false, matches: [] };
    }
  },

  /**
   * Match a ride request with the best available ride
   */
  async matchRequestWithBestRide(
    requestId: string,
  ): Promise<{ success: boolean; matched: boolean; details: any }> {
    try {
      // Find potential matches
      const { success, matches } = await this.findMatchesForRequest(requestId);

      if (!success || matches.length === 0) {
        return {
          success: false,
          matched: false,
          details: { reason: "No matching rides found" },
        };
      }

      // Get the best match (highest score)
      const bestMatch = matches[0];

      // Attempt to match with the best ride
      const matchResult = await this.matchRideWithRequest(
        bestMatch.ride.id,
        requestId,
      );

      return {
        success: matchResult.success,
        matched: matchResult.success,
        details: {
          ...matchResult.details,
          matchScore: bestMatch.score,
          rideInfo: {
            id: bestMatch.ride.id,
            driverName: bestMatch.ride.driver?.full_name,
            scheduledTime: bestMatch.ride.scheduled_time,
          },
        },
      };
    } catch (error) {
      console.error("Error in matchRequestWithBestRide:", error);
      return {
        success: false,
        matched: false,
        details: { error },
      };
    }
  },
  /**
   * Check if a ride and request can be matched based on simple criteria
   */
  async checkSimpleMatch(
    rideId: string,
    requestId: string,
  ): Promise<{ isMatch: boolean; details: any }> {
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

      // 3. Time compatibility check
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

      // 4. Distance check (simplified)
      // Calculate direct distances
      const pickupDistance = this.calculateDistance(
        ride.pickup_latitude,
        ride.pickup_longitude,
        request.pickup_latitude,
        request.pickup_longitude,
      );

      const dropoffDistance = this.calculateDistance(
        ride.destination_latitude,
        ride.destination_longitude,
        request.destination_latitude,
        request.destination_longitude,
      );

      const totalDetour = pickupDistance + dropoffDistance;
      const distanceIsAcceptable = totalDetour <= 10; // 10 km max detour
      if (!distanceIsAcceptable) {
        return {
          isMatch: false,
          details: {
            reason: "Distance too large",
            pickupDistanceKm: pickupDistance,
            dropoffDistanceKm: dropoffDistance,
            totalDetourKm: totalDetour,
            maxAllowedDetourKm: 10,
          },
        };
      }

      // 5. Direction check
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

      const directionIsCompatible = bearingDiff <= 45; // Within 45 degrees
      if (!directionIsCompatible) {
        return {
          isMatch: false,
          details: {
            reason: "Direction incompatible",
            rideBearing,
            requestBearing,
            bearingDifferenceDegrees: bearingDiff,
            maxAllowedDifferenceDegrees: 45,
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
      console.error("Error in checkSimpleMatch:", error);
      throw error;
    }
  },

  /**
   * Match a ride request with a ride (simplified)
   */
  async matchRideWithRequest(
    rideId: string,
    requestId: string,
  ): Promise<{ success: boolean; details: any }> {
    try {
      // First check if this is a valid match
      const matchCheck = await this.checkSimpleMatch(rideId, requestId);
      if (!matchCheck.isMatch) {
        return {
          success: false,
          details: {
            reason: "Not a valid match",
            matchDetails: matchCheck.details,
          },
        };
      }

      // Get the ride and request details
      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .select("driver_id, seats_available")
        .eq("id", rideId)
        .single();

      if (rideError) throw rideError;

      const { data: request, error: requestError } = await supabase
        .from("ride_requests")
        .select("rider_id, seats_needed")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      // Start a transaction using separate operations (because Supabase doesn't support explicit transactions in JS client)

      // 1. Update the ride's seats
      const { error: updateRideError } = await supabase
        .from("rides")
        .update({
          seats_available: ride.seats_available - request.seats_needed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      if (updateRideError) throw updateRideError;

      // 2. Update the request
      const { error: updateRequestError } = await supabase
        .from("ride_requests")
        .update({
          ride_id: rideId,
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateRequestError) throw updateRequestError;

      // 3. Create notifications
      const { error: notificationsError } = await supabase
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

      if (notificationsError) throw notificationsError;

      return {
        success: true,
        details: {
          rideId,
          requestId,
          updatedSeatsAvailable: ride.seats_available - request.seats_needed,
          newStatus: "accepted",
        },
      };
    } catch (error) {
      console.error("Error in matchRideWithRequest:", error);
      return { success: false, details: error };
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
