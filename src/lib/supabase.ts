import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder-url.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      channels: {
        minimal: true, // Only subscribe to channels explicitly needed
      },
    },
  },
);

/**
 * Initialize backend resources like timers and workers
 */
export function initializeBackend() {
  import("./rideMatchingWorker").then(
    ({
      startRideMatchingWorker,
      startPeriodicMatchingTimer,
      startExpirationTimer,
    }) => {
      // Start the ride matching worker that listens for new ride requests
      const cleanupWorker = startRideMatchingWorker();

      // Start the periodic matching timer
      const cleanupTimer = startPeriodicMatchingTimer(5); // Check every 5 minutes

      // Start the expiration timer
      const cleanupExpiration = startExpirationTimer(15); // Check every 15 minutes

      // Return cleanup function
      return () => {
        cleanupWorker();
        cleanupTimer();
        cleanupExpiration();
      };
    },
  );
}

/**
 * Get user profile data
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }

  return data;
}

/**
 * Update user profile data
 */
export async function updateUserProfile(userId: string, updates: any) {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating user profile:", error);
    return { success: false, error };
  }

  return { success: true, data };
}

/**
 * Listen for notifications for a specific user
 */
export function listenForNotifications(
  userId: string,
  callback: (notification: any) => void,
) {
  return supabase
    .channel(`notifications_${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new);
      },
    )
    .subscribe();
}
