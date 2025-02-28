import React from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Info } from "lucide-react";

interface RideMatchingInfoProps {
  className?: string;
}

const RideMatchingInfo = ({ className = "" }: RideMatchingInfoProps) => {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <h3 className="font-semibold">Automatic Ride Matching</h3>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How ride matching works</AlertTitle>
          <AlertDescription>
            <p className="text-sm mt-2">
              Our system automatically matches passengers with drivers based on
              route overlap, timing, and available seats. When a match is found:
            </p>
            <ul className="list-disc list-inside text-sm mt-2 space-y-1">
              <li>
                Passengers will see{" "}
                <Badge variant="success">Driver Found</Badge> status
              </li>
              <li>
                Drivers will see matched passengers in their Passengers tab
              </li>
              <li>Both parties receive notifications about the match</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="text-sm text-muted-foreground">
          <p>The system continuously looks for the best matches based on:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Route overlap (60% weight)</li>
            <li>Pickup distance (20% weight)</li>
            <li>Time difference (20% weight)</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default RideMatchingInfo;
