import { supabase } from "./supabase";

/**
 * A direct implementation of ride matching that bypasses the complex SQL functions
 * and implements the logic directly in JavaScript
 */
export const directRideMatching = {
  /**
   * Match a ride request with a specific ride
   */
  async matchRequestWithRide(
    requestId: string,
    rideId: string,
  ): Promise<{ success: boolean; details: any }> {
    try {
      console.log(`Directly matching request ${requestId} with ride ${rideId}`);

      // 1. Get the request details
      const { data: request, error: requestError } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      // 2. Get the ride details
      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .single();

      if (rideError) throw rideError;

      // 3. Check if the ride has enough seats
      if (ride.seats_available < request.seats_needed) {
        return {
          success: false,
          details: {
            reason: "Not enough seats available",
            seatsAvailable: ride.seats_available,
            seatsNeeded: request.seats_needed,
          },
        };
      }

      // 4. Check if the request is already matched
      if (request.ride_id) {
        return {
          success: false,
          details: {
            reason: "Request already matched to a ride",
            currentRideId: request.ride_id,
          },
        };
      }

      // 5. Check if the request and ride statuses allow matching
      if (request.status !== "pending") {
        return {
          success: false,
          details: {
            reason: `Request status is ${request.status}, not pending`,
          },
        };
      }

      if (ride.status !== "pending" && ride.status !== "accepted") {
        return {
          success: false,
          details: {
            reason: `Ride status is ${ride.status}, not pending or accepted`,
          },
        };
      }

      // 6. Update the ride's available seats
      const { error: updateRideError } = await supabase
        .from("rides")
        .update({
          seats_available: ride.seats_available - request.seats_needed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      if (updateRideError) throw updateRideError;

      // 7. Update the request to match with the ride
      const { error: updateRequestError } = await supabase
        .from("ride_requests")
        .update({
          ride_id: rideId,
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateRequestError) throw updateRequestError;

      // 8. Create notifications for both driver and rider
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

      if (notificationError) {
        console.error("Error creating notifications:", notificationError);
        // Continue even if notifications fail
      }

      // 9. Dispatch custom event for UI updates
      if (typeof window !== "undefined") {
        const matchEvent = new CustomEvent("ride-matched", {
          detail: { requestId, rideId },
        });
        window.dispatchEvent(matchEvent);
      }

      return {
        success: true,
        details: {
          requestId,
          rideId,
          status: "accepted",
          updatedSeats: ride.seats_available - request.seats_needed,
        },
      };
    } catch (error) {
      console.error("Error in direct ride matching:", error);
      return { success: false, details: error };
    }
  },

  /**
   * Find the best matching ride for a request
   */
  async findBestMatchForRequest(
    requestId: string,
  ): Promise<{ success: boolean; matched: boolean; details: any }> {
    try {
      console.log(`Finding best match for request ${requestId}`);

      // 1. Get the request details
      const { data: request, error: requestError } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;

      // 2. Find potential rides
      const { data: potentialRides, error: ridesError } = await supabase
        .from("rides")
        .select("*")
        .eq("status", "pending")
        .gte("seats_available", request.seats_needed);

      if (ridesError) throw ridesError;

      if (!potentialRides || potentialRides.length === 0) {
        return {
          success: true,
          matched: false,
          details: { reason: "No potential rides found" },
        };
      }

      console.log(
        `Found ${potentialRides.length} potential rides for request ${requestId}`,
      );

      // 3. Calculate match scores for each potential ride
      const matchScores = potentialRides.map((ride) => {
        // Calculate pickup and dropoff distances
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

        // Calculate time difference in minutes
        const rideTime = new Date(ride.scheduled_time).getTime();
        const requestTime = new Date(request.scheduled_time).getTime();
        const timeDiffMinutes = Math.abs(rideTime - requestTime) / (1000 * 60);

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

        // Check if this is a valid match
        const isValidMatch =
          pickupDistance + dropoffDistance <= 15 && // More relaxed distance constraint
          timeDiffMinutes <= 60 && // More relaxed time constraint
          bearingDiff <= 60; // More relaxed direction constraint

        // Calculate score (lower is better)
        const score = isValidMatch
          ? (pickupDistance + dropoffDistance) * 0.6 + // Distance component
            timeDiffMinutes * 0.3 + // Time component
            bearingDiff * 0.1 // Direction component
          : Infinity;

        return {
          ride,
          score,
          isValidMatch,
          details: {
            pickupDistance,
            dropoffDistance,
            totalDetour: pickupDistance + dropoffDistance,
            timeDiffMinutes,
            bearingDiff,
          },
        };
      });

      // 4. Filter valid matches and sort by score
      const validMatches = matchScores
        .filter((match) => match.isValidMatch)
        .sort((a, b) => a.score - b.score);

      if (validMatches.length === 0) {
        return {
          success: true,
          matched: false,
          details: { reason: "No valid matches found" },
        };
      }

      // 5. Get the best match
      const bestMatch = validMatches[0];
      console.log(
        `Best match for request ${requestId} is ride ${bestMatch.ride.id} with score ${bestMatch.score}`,
      );

      // 6. Attempt to match with the best ride
      const matchResult = await this.matchRequestWithRide(
        requestId,
        bestMatch.ride.id,
      );

      if (!matchResult.success) {
        return {
          success: false,
          matched: false,
          details: {
            reason: "Failed to match with best ride",
            matchError: matchResult.details,
          },
        };
      }

      return {
        success: true,
        matched: true,
        details: {
          matchedRideId: bestMatch.ride.id,
          score: bestMatch.score,
          matchDetails: bestMatch.details,
        },
      };
    } catch (error) {
      console.error("Error finding best match for request:", error);
      return { success: false, matched: false, details: error };
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
