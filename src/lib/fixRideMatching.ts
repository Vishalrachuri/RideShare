import { supabase } from "./supabase";

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
