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

  // Filter rides based on route matching
  const matchingRides =
    rides?.filter((ride) => isRideMatch(ride, request)) || [];

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
  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .select("*")
    .eq("id", rideId)
    .single();

  if (rideError || !ride) {
    throw new Error("Failed to fetch ride details");
  }

  const { data: request, error: requestError } = await supabase
    .from("ride_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    throw new Error("Failed to fetch request details");
  }

  // Start a transaction to update both ride and request
  const { error: updateError } = await supabase.rpc("match_ride_with_request", {
    p_ride_id: rideId,
    p_request_id: requestId,
    p_seats_needed: request.seats_needed,
  });

  if (updateError) {
    throw new Error("Failed to match ride with request");
  }

  // Create notifications for both driver and rider
  await supabase.from("notifications").insert([
    {
      user_id: ride.driver_id,
      title: "New Passenger Matched",
      message: `A new passenger has been matched to your ride scheduled for ${new Date(ride.scheduled_time).toLocaleString()}`,
      type: "ride_matched",
    },
    {
      user_id: request.rider_id,
      title: "Ride Matched",
      message: `You have been matched with a driver for your ride scheduled for ${new Date(request.scheduled_time).toLocaleString()}`,
      type: "ride_matched",
    },
  ]);
};
