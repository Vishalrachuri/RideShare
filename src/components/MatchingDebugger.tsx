import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { supabase } from "@/lib/supabase";
import {
  calculateDistance,
  calculateBearing,
  isRouteDirectionSimilar,
  calculateMatchScore,
} from "@/lib/rideMatching";

export default function MatchingDebugger() {
  const [requestId, setRequestId] = React.useState("");
  const [rideId, setRideId] = React.useState("");
  const [results, setResults] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const checkMatch = async () => {
    if (!requestId || !rideId) {
      setError("Please enter both a request ID and ride ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get request details
      const { data: request, error: requestError } = await supabase
        .from("ride_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError)
        throw new Error(`Error fetching request: ${requestError.message}`);

      // Get ride details
      const { data: ride, error: rideError } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .single();

      if (rideError)
        throw new Error(`Error fetching ride: ${rideError.message}`);

      // Calculate match details
      const directionSimilar = isRouteDirectionSimilar(
        ride.pickup_latitude,
        ride.pickup_longitude,
        ride.destination_latitude,
        ride.destination_longitude,
        request.pickup_latitude,
        request.pickup_longitude,
        request.destination_latitude,
        request.destination_longitude,
      );

      const rideBearing = calculateBearing(
        ride.pickup_latitude,
        ride.pickup_longitude,
        ride.destination_latitude,
        ride.destination_longitude,
      );

      const requestBearing = calculateBearing(
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

      const pickupDistance = calculateDistance(
        ride.pickup_latitude,
        ride.pickup_longitude,
        request.pickup_latitude,
        request.pickup_longitude,
      );

      const dropoffDistance = calculateDistance(
        ride.destination_latitude,
        ride.destination_longitude,
        request.destination_latitude,
        request.destination_longitude,
      );

      const rideDate = new Date(ride.scheduled_time);
      const requestDate = new Date(request.scheduled_time);
      const timeDiff =
        Math.abs(rideDate.getTime() - requestDate.getTime()) / (1000 * 60);

      const matchScore = calculateMatchScore(ride, request);

      // Call the backend function to check match
      const { data: backendMatch, error: backendError } = await supabase.rpc(
        "check_ride_match",
        {
          ride_id: rideId,
          request_id: requestId,
          max_detour_km: 5.0,
          max_time_diff_minutes: 30,
        },
      );

      if (backendError)
        throw new Error(`Backend match error: ${backendError.message}`);

      // Set results
      setResults({
        request,
        ride,
        directionSimilar,
        rideBearing,
        requestBearing,
        bearingDiff,
        pickupDistance,
        dropoffDistance,
        timeDiff,
        matchScore,
        backendMatch,
      });
    } catch (err) {
      setError(err.message);
      console.error("Error checking match:", err);
    } finally {
      setLoading(false);
    }
  };

  const tryAutoMatch = async () => {
    if (!requestId) {
      setError("Please enter a request ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try auto-matching
      const { data: matchResult, error: matchError } = await supabase.rpc(
        "auto_match_passenger_with_driver",
        { p_request_id: requestId },
      );

      if (matchError)
        throw new Error(`Auto-match error: ${matchError.message}`);

      // Check the result
      const { data: updatedRequest, error: requestError } = await supabase
        .from("ride_requests")
        .select("*, ride:ride_id(*)")
        .eq("id", requestId)
        .single();

      if (requestError)
        throw new Error(
          `Error fetching updated request: ${requestError.message}`,
        );

      setResults({
        ...results,
        autoMatchResult: matchResult,
        updatedRequest,
      });
    } catch (err) {
      setError(err.message);
      console.error("Error in auto-match:", err);
    } finally {
      setLoading(false);
    }
  };

  const tryPeriodicMatch = async () => {
    try {
      setLoading(true);
      setError(null);

      // Run periodic match check
      const { data: matchResult, error: matchError } = await supabase.rpc(
        "periodic_match_check",
      );

      if (matchError)
        throw new Error(`Periodic match error: ${matchError.message}`);

      // If we have a request ID, check its status after matching
      if (requestId) {
        const { data: updatedRequest, error: requestError } = await supabase
          .from("ride_requests")
          .select("*, ride:ride_id(*)")
          .eq("id", requestId)
          .single();

        if (requestError)
          throw new Error(
            `Error fetching updated request: ${requestError.message}`,
          );

        setResults({
          ...results,
          periodicMatchResult: matchResult,
          updatedRequest,
        });
      } else {
        setResults({
          ...results,
          periodicMatchResult: matchResult,
        });
      }
    } catch (err) {
      setError(err.message);
      console.error("Error in periodic match:", err);
    } finally {
      setLoading(false);
    }
  };

  const manuallyMatchRides = async () => {
    if (!requestId || !rideId) {
      setError("Please enter both a request ID and ride ID");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call manual match function
      const { data: matchResult, error: matchError } = await supabase.rpc(
        "manual_match_ride_request",
        {
          p_request_id: requestId,
          p_ride_id: rideId,
        },
      );

      if (matchError)
        throw new Error(`Manual match error: ${matchError.message}`);

      // Get updated request
      const { data: updatedRequest, error: requestError } = await supabase
        .from("ride_requests")
        .select("*, ride:ride_id(*)")
        .eq("id", requestId)
        .single();

      if (requestError)
        throw new Error(
          `Error fetching updated request: ${requestError.message}`,
        );

      setResults({
        ...results,
        manualMatchResult: matchResult,
        updatedRequest,
      });
    } catch (err) {
      setError(err.message);
      console.error("Error in manual match:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 w-full max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Ride Matching Debugger</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label htmlFor="requestId">Ride Request ID</Label>
          <Input
            id="requestId"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            placeholder="Enter request ID"
          />
        </div>
        <div>
          <Label htmlFor="rideId">Ride ID</Label>
          <Input
            id="rideId"
            value={rideId}
            onChange={(e) => setRideId(e.target.value)}
            placeholder="Enter ride ID"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button onClick={checkMatch} disabled={loading}>
          Check Match
        </Button>
        <Button onClick={tryAutoMatch} disabled={loading} variant="outline">
          Try Auto Match
        </Button>
        <Button onClick={tryPeriodicMatch} disabled={loading} variant="outline">
          Run Periodic Match
        </Button>
        <Button
          onClick={manuallyMatchRides}
          disabled={loading}
          variant="outline"
        >
          Manually Match
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {results && (
        <ScrollArea className="h-[500px] border rounded-md p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Match Results</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Direction Similar:</span>{" "}
                    <Badge
                      variant={
                        results.directionSimilar ? "success" : "destructive"
                      }
                    >
                      {results.directionSimilar ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">Ride Bearing:</span>{" "}
                    <span>
                      {results.rideBearing !== undefined
                        ? results.rideBearing.toFixed(2)
                        : "N/A"}
                      °
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Request Bearing:</span>{" "}
                    <span>
                      {results.requestBearing !== undefined
                        ? results.requestBearing.toFixed(2)
                        : "N/A"}
                      °
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Bearing Difference:</span>{" "}
                    <span>
                      {results.bearingDiff !== undefined
                        ? results.bearingDiff.toFixed(2)
                        : "N/A"}
                      °
                    </span>
                    {results.bearingDiff !== undefined &&
                      (results.bearingDiff <= 30 ? (
                        <Badge variant="success" className="ml-2">
                          Within limit (30°)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-2">
                          Exceeds limit (30°)
                        </Badge>
                      ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Pickup Distance:</span>{" "}
                    <span>
                      {results.pickupDistance !== undefined
                        ? results.pickupDistance.toFixed(2)
                        : "N/A"}{" "}
                      km
                    </span>
                    {results.pickupDistance !== undefined &&
                      (results.pickupDistance <= 5 ? (
                        <Badge variant="success" className="ml-2">
                          Within limit (5km)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-2">
                          Exceeds limit (5km)
                        </Badge>
                      ))}
                  </div>
                  <div>
                    <span className="font-medium">Dropoff Distance:</span>{" "}
                    <span>
                      {results.dropoffDistance !== undefined
                        ? results.dropoffDistance.toFixed(2)
                        : "N/A"}{" "}
                      km
                    </span>
                    {results.dropoffDistance !== undefined &&
                      (results.dropoffDistance <= 5 ? (
                        <Badge variant="success" className="ml-2">
                          Within limit (5km)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-2">
                          Exceeds limit (5km)
                        </Badge>
                      ))}
                  </div>
                  <div>
                    <span className="font-medium">Time Difference:</span>{" "}
                    <span>
                      {results.timeDiff !== undefined
                        ? results.timeDiff.toFixed(2)
                        : "N/A"}{" "}
                      minutes
                    </span>
                    {results.timeDiff !== undefined &&
                      (results.timeDiff <= 30 ? (
                        <Badge variant="success" className="ml-2">
                          Within limit (30min)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-2">
                          Exceeds limit (30min)
                        </Badge>
                      ))}
                  </div>
                  <div>
                    <span className="font-medium">Match Score:</span>{" "}
                    <span>
                      {results.matchScore !== undefined
                        ? (results.matchScore * 100).toFixed(2) + "%"
                        : "N/A"}
                    </span>
                    {results.matchScore !== undefined &&
                      (results.matchScore >= 0.65 ? (
                        <Badge variant="success" className="ml-2">
                          Above threshold (65%)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-2">
                          Below threshold (65%)
                        </Badge>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Backend Match Result</h3>
              <Badge variant={results.backendMatch ? "success" : "destructive"}>
                {results.backendMatch ? "Match" : "No Match"}
              </Badge>
            </div>

            {results.autoMatchResult !== undefined && (
              <div>
                <h3 className="font-semibold mb-2">Auto Match Result</h3>
                <Badge
                  variant={results.autoMatchResult ? "success" : "destructive"}
                >
                  {results.autoMatchResult ? "Matched" : "Not Matched"}
                </Badge>
              </div>
            )}

            {results.periodicMatchResult !== undefined && (
              <div>
                <h3 className="font-semibold mb-2">Periodic Match Result</h3>
                <Badge>{results.periodicMatchResult} matches found</Badge>
              </div>
            )}

            {results.manualMatchResult !== undefined && (
              <div>
                <h3 className="font-semibold mb-2">Manual Match Result</h3>
                <Badge
                  variant={
                    results.manualMatchResult ? "success" : "destructive"
                  }
                >
                  {results.manualMatchResult
                    ? "Successfully Matched"
                    : "Failed to Match"}
                </Badge>
              </div>
            )}

            {results.updatedRequest && (
              <div>
                <h3 className="font-semibold mb-2">Updated Request Status</h3>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    <Badge>{results.updatedRequest.status}</Badge>
                  </div>
                  <div>
                    <span className="font-medium">Ride ID:</span>{" "}
                    <span>{results.updatedRequest.ride_id || "None"}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Request Details</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                {JSON.stringify(results.request, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Ride Details</h3>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                {JSON.stringify(results.ride, null, 2)}
              </pre>
            </div>
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
