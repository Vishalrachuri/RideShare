import React from "react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Info } from "lucide-react";

const AutomaticMatchingInfo = () => {
  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertTitle>Automatic Matching Active</AlertTitle>
      <AlertDescription>
        <p className="text-sm">
          After you offer a ride with your start and end locations, our system
          automatically matches passengers with your ride based on route
          overlap, timing, and your available seats. You'll be notified when
          passengers are matched.
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default AutomaticMatchingInfo;
