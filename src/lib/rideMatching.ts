import { supabase } from "./supabase";

// Calculate distance between two points using Haversine formula
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
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
};

/**
 * Calculate bearing between two points
 * @returns Bearing in degrees (0-360)
 */
export const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
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
};

/**
 * Check if two routes are going in a similar direction
 * @returns true if routes are within the acceptable angle difference
 */
export const isRouteDirectionSimilar = (
  startLat1: number,
  startLon1: number,
  endLat1: number,
  endLon1: number,
  startLat2: number,
  startLon2: number,
  endLat2: number,
  endLon2: number,
  maxAngleDifference: number = 30,
): boolean => {
  const bearing1 = calculateBearing(startLat1, startLon1, endLat1, endLon1);
  const bearing2 = calculateBearing(startLat2, startLon2, endLat2, endLon2);

  const angleDiff = Math.min(
    Math.abs(bearing1 - bearing2),
    Math.abs(bearing1 - bearing2 + 360),
    Math.abs(bearing1 - bearing2 - 360),
  );

  return angleDiff <= maxAngleDifference;
};

// Check if a ride matches with a request based on route overlap and timing
export const isRideMatch = (
  ride: any,
  request: any,
  maxDetourKm: number = 5, // Maximum total detour in km
  maxTimeDiffMinutes: number = 30, // Maximum time difference in minutes
): boolean => {
  console.log("Checking match between:", {
    ride: {
      id: ride.id,
      pickup: [ride.pickup_latitude, ride.pickup_longitude],
      dropoff: [ride.destination_latitude, ride.destination_longitude],
      time: ride.scheduled_time,
    },
    request: {
      id: request.id,
      pickup: [request.pickup_latitude, request.pickup_longitude],
      dropoff: [request.destination_latitude, request.destination_longitude],
      time: request.scheduled_time,
    },
  });

  // First, check if routes are going in similar directions
  const routesSimilar = isRouteDirectionSimilar(
    ride.pickup_latitude,
    ride.pickup_longitude,
    ride.destination_latitude,
    ride.destination_longitude,
    request.pickup_latitude,
    request.pickup_longitude,
    request.destination_latitude,
    request.destination_longitude,
  );

  if (!routesSimilar) {
    console.log("Routes are not going in a similar direction");
    return false;
  }

  // Calculate distances
  const pickupDetour = calculateDistance(
    ride.pickup_latitude,
    ride.pickup_longitude,
    request.pickup_latitude,
    request.pickup_longitude,
  );

  const dropoffDetour = calculateDistance(
    ride.destination_latitude,
    ride.destination_longitude,
    request.destination_latitude,
    request.destination_longitude,
  );

  // Check timing
  const rideDate = new Date(ride.scheduled_time);
  const requestDate = new Date(request.scheduled_time);

  // Calculate time difference in minutes
  const timeDiff =
    Math.abs(rideDate.getTime() - requestDate.getTime()) / (1000 * 60);

  console.log("Time comparison:", {
    rideTime: rideDate.toLocaleString(),
    requestTime: requestDate.toLocaleString(),
    timeDiff: `${timeDiff} minutes`,
    maxAllowed: `${maxTimeDiffMinutes} minutes`,
  });

  // Check if times are within the allowed window
  if (timeDiff > maxTimeDiffMinutes) {
    console.log("Time difference too large");
    return false;
  }

  // Calculate total route distance
  const totalDistance = pickupDetour + dropoffDetour;
  console.log("Route distances:", {
    pickupDetour: `${pickupDetour.toFixed(2)} km`,
    dropoffDetour: `${dropoffDetour.toFixed(2)} km`,
    totalDistance: `${totalDistance.toFixed(2)} km`,
    maxAllowed: `${maxDetourKm} km`,
  });

  // Check if pickup and dropoff are exactly the same
  const sameLocations = pickupDetour < 0.01 && dropoffDetour < 0.01;

  if (sameLocations) {
    console.log("Pickup and dropoff locations are the same");
    return false;
  }

  // Return true if both time and distance criteria are met
  const isMatch = totalDistance <= maxDetourKm;
  console.log("Match result:", { isMatch, totalDistance, maxDetourKm });
  return isMatch;
};

/**
 * Calculate a match score between a ride and a request
 * Higher score means better match
 * @returns A score between 0 and 1
 */
export const calculateMatchScore = (
  ride: any,
  request: any,
  maxDetourKm: number = 5,
  maxTimeDiffMinutes: number = 30,
): number => {
  // Check if routes are going in similar directions
  if (
    !isRouteDirectionSimilar(
      ride.pickup_latitude,
      ride.pickup_longitude,
      ride.destination_latitude,
      ride.destination_longitude,
      request.pickup_latitude,
      request.pickup_longitude,
      request.destination_latitude,
      request.destination_longitude,
    )
  ) {
    return 0; // Return 0 score if routes are not going in similar directions
  }

  // Calculate pickup and dropoff detour distances
  const pickupDetour = calculateDistance(
    ride.pickup_latitude,
    ride.pickup_longitude,
    request.pickup_latitude,
    request.pickup_longitude,
  );

  const dropoffDetour = calculateDistance(
    ride.destination_latitude,
    ride.destination_longitude,
    request.destination_latitude,
    request.destination_longitude,
  );

  // Check timing
  const rideDate = new Date(ride.scheduled_time);
  const requestDate = new Date(request.scheduled_time);
  const timeDiff =
    Math.abs(rideDate.getTime() - requestDate.getTime()) / (1000 * 60);

  // Calculate normalized scores for each component (1 = perfect match, 0 = worst match)
  const directionalMatchScore = 0.6; // Since we've already verified directions are similar
  const distanceScore =
    1 - Math.min(1, (pickupDetour + dropoffDetour) / maxDetourKm);
  const timeScore = 1 - Math.min(1, timeDiff / maxTimeDiffMinutes);

  // Calculate weighted total score (0-1)
  const totalScore =
    directionalMatchScore * 0.6 + // Direction is 60% of the score
    distanceScore * 0.2 + // Distance is 20% of the score
    timeScore * 0.2; // Time is 20% of the score

  return totalScore;
};

// Find matching rides for a request
export const findMatchingRides = async (requestId: string) => {
  // Get the request details
  const { data: request, error: requestError } = await supabase
    .from("ride_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    throw new Error("Failed to fetch request details");
  }

  // Find available rides
  const { data: rides, error: ridesError } = await supabase
    .from("rides")
    .select("*")
    .eq("status", "pending")
    .gte("seats_available", request.seats_needed);

  if (ridesError) {
    throw new Error("Failed to fetch potential rides");
  }

  // Filter rides based on route matching and calculate scores
  const matchingRides =
    rides
      ?.map((ride) => ({
        ride,
        score: calculateMatchScore(ride, request),
      }))
      .filter((item) => item.score >= 0.65) // Only include rides with a score above threshold
      .sort((a, b) => b.score - a.score) || []; // Sort by score descending

  console.log(
    `Found ${matchingRides.length} matching rides for request ${requestId}`,
  );
  return matchingRides;
};

// Update ride and request status when matched
export const matchRideWithRequest = async (
  rideId: string,
  requestId: string,
) => {
  try {
    // Call the manual_match_ride_request RPC function
    const { data, error } = await supabase.rpc("manual_match_ride_request", {
      p_ride_id: rideId,
      p_request_id: requestId,
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error("Error matching ride with request:", error);
    throw error;
  }
};
