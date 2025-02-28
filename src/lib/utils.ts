import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for combining Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date into a nice string
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";

  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a distance to a nice string
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Format a duration to a nice string
 */
export function formatDuration(durationMinutes: number): string {
  if (durationMinutes < 60) {
    return `${Math.round(durationMinutes)} min`;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = Math.round(durationMinutes % 60);

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

/**
 * Format a price to a nice string
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Generate a short ID from a UUID
 */
export function shortenId(id: string): string {
  return id.substring(0, 8);
}

/**
 * Get a color based on status
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "completed":
      return "success";
    case "accepted":
    case "in_progress":
    case "driver_accepted":
    case "picked_up":
      return "primary";
    case "pending":
      return "warning";
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}

/**
 * Format a status string to be more user-friendly
 */
export function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "accepted":
      return "Driver Matched";
    case "driver_accepted":
      return "Driver Accepted";
    case "in_progress":
      return "In Progress";
    case "pickup_pending":
      return "Pickup Pending";
    case "picked_up":
      return "Picked Up";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "pending":
      return "Searching";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
  }
}

/**
 * Check if a coordinate is valid
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Parse coordinates from a string
 * @returns {lat: number, lng: number} | null
 */
export function parseCoordinates(
  coordsString: string,
): { lat: number; lng: number } | null {
  // Try to parse a string like "12.345, 67.890" or "12.345,67.890"
  const parts = coordsString.split(",").map((part) => parseFloat(part.trim()));

  if (parts.length === 2 && isValidCoordinate(parts[0], parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }

  return null;
}

/**
 * Get the time remaining until a scheduled time
 */
export function getTimeRemaining(scheduledTime: string | Date): string {
  const now = new Date();
  const scheduled = new Date(scheduledTime);
  const diffMs = scheduled.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Now";
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) {
    return `${diffMins} min`;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (mins === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${mins} min`;
}
