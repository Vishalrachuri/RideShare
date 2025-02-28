import React from "react";
import { Badge } from "./ui/badge";

interface RideStatusDisplayProps {
  status: string;
  className?: string;
}

const RideStatusDisplay = ({
  status,
  className = "",
}: RideStatusDisplayProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "accepted":
        return "success";
      case "in_progress":
        return "success";
      case "completed":
        return "success";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Searching";
      case "driver_accepted":
        return "Driver Accepted";
      case "accepted":
        return "Driver Found";
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
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <Badge className={className} variant={getStatusColor(status)}>
      {getStatusText(status)}
    </Badge>
  );
};

export default RideStatusDisplay;
