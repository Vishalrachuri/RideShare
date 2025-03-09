import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { debugRideMatching } from "@/lib/RideMatchingDebugger";
import { supabase } from "@/lib/supabase";

export function RideMatchingTester() {
  const [rideId, setRideId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testType, setTestType] = useState<
    "match" | "autoMatch" | "manualMatch" | "forceMatch"
  >("match");

  const handleTest = async () => {
    setLoading(true);
    try {
      let result;

      switch (testType) {
        case "match":
          result = await debugRideMatching.testCoordinateMatch(
            rideId,
            requestId,
          );
          break;
        case "autoMatch":
          result = await debugRideMatching.testAutoMatch(requestId);
          break;
        case "manualMatch":
          result = await debugRideMatching.testManualMatch(rideId, requestId);
          break;
        case "forceMatch":
          result = await debugRideMatching.forceMatch(rideId, requestId);
          break;
      }

      setResults(result);
    } catch (error) {
      console.error("Error during test:", error);
      setResults({ success: false, details: error });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestData = async () => {
    setLoading(true);
    try {
      // Create a test ride and request with identical coordinates
      const testLocation = {
        pickup_lat: 33.2148,
        pickup_lng: -97.1331,
        destination_lat: 32.7767,
        destination_lng: -96.797,
      };

      // Create a test ride
      const { data: rideData, error: rideError } = await supabase
        .from("rides")
        .insert({
          driver_id: (await supabase.auth.getUser()).data.user?.id,
          pickup_latitude: testLocation.pickup_lat,
          pickup_longitude: testLocation.pickup_lng,
          destination_latitude: testLocation.destination_lat,
          destination_longitude: testLocation.destination_lng,
          scheduled_time: new Date(Date.now() + 30 * 60000).toISOString(), // 30 minutes from now
          seats_available: 4,
          status: "pending",
        })
        .select()
        .single();

      if (rideError) throw rideError;

      // Create a test request
      const { data: requestData, error: requestError } = await supabase
        .from("ride_requests")
        .insert({
          rider_id: (await supabase.auth.getUser()).data.user?.id,
          pickup_latitude: testLocation.pickup_lat,
          pickup_longitude: testLocation.pickup_lng,
          destination_latitude: testLocation.destination_lat,
          destination_longitude: testLocation.destination_lng,
          scheduled_time: new Date(Date.now() + 30 * 60000).toISOString(), // 30 minutes from now
          seats_needed: 1,
          status: "pending",
          auto_match: true,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      setRideId(rideData.id);
      setRequestId(requestData.id);
      setResults({
        success: true,
        details: {
          message: "Test data created successfully",
          ride: rideData,
          request: requestData,
        },
      });
    } catch (error) {
      console.error("Error creating test data:", error);
      setResults({ success: false, details: error });
    } finally {
      setLoading(false);
    }
  };

  const triggerPeriodicMatchCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("periodic_match_check");

      if (error) throw error;

      setResults({
        success: true,
        details: {
          message: "Periodic match check triggered",
          matchesFound: data,
        },
      });
    } catch (error) {
      console.error("Error triggering periodic match check:", error);
      setResults({ success: false, details: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Ride Matching Debug Tool</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Label>Test Type</Label>
            <div className="flex space-x-2">
              <Button
                variant={testType === "match" ? "default" : "outline"}
                onClick={() => setTestType("match")}
              >
                Check Match
              </Button>
              <Button
                variant={testType === "autoMatch" ? "default" : "outline"}
                onClick={() => setTestType("autoMatch")}
              >
                Auto Match
              </Button>
              <Button
                variant={testType === "manualMatch" ? "default" : "outline"}
                onClick={() => setTestType("manualMatch")}
              >
                Manual Match
              </Button>
              <Button
                variant={testType === "forceMatch" ? "default" : "outline"}
                onClick={() => setTestType("forceMatch")}
              >
                Force Match
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {testType !== "autoMatch" && (
              <div className="space-y-2">
                <Label htmlFor="ride-id">Ride ID</Label>
                <Input
                  id="ride-id"
                  placeholder="Enter ride ID"
                  value={rideId}
                  onChange={(e) => setRideId(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="request-id">Request ID</Label>
              <Input
                id="request-id"
                placeholder="Enter request ID"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleTest}
              disabled={
                loading ||
                (testType !== "autoMatch" && (!rideId || !requestId)) ||
                (testType === "autoMatch" && !requestId)
              }
            >
              {loading ? "Testing..." : "Run Test"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateTestData}
              disabled={loading}
            >
              Create Test Data
            </Button>
            <Button
              variant="outline"
              onClick={triggerPeriodicMatchCheck}
              disabled={loading}
            >
              Trigger Periodic Match
            </Button>
          </div>

          {results && (
            <div className="mt-4">
              <h3 className="text-lg font-medium">
                Test Results: {results.success ? "Success" : "Failed"}
              </h3>

              <Accordion type="single" collapsible className="mt-2">
                <AccordionItem value="details">
                  <AccordionTrigger>Details</AccordionTrigger>
                  <AccordionContent>
                    <pre className="bg-muted p-2 rounded-md overflow-auto max-h-96 text-xs">
                      {JSON.stringify(results.details, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {results.success && testType === "match" && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Match Result:</span>
                    <span
                      className={
                        results.details.isMatch
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {results.details.isMatch ? "Match" : "No Match"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Direction Compatible:</span>
                    <span
                      className={
                        results.details.isBearingSimilar
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {results.details.isBearingSimilar ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time Compatible:</span>
                    <span
                      className={
                        results.details.isTimeCompatible
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {results.details.isTimeCompatible ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Enough Seats:</span>
                    <span
                      className={
                        results.details.hasEnoughSeats
                          ? "text-green-500"
                          : "text-red-500"
                      }
                    >
                      {results.details.hasEnoughSeats ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pickup Distance:</span>
                    <span>{results.details.directPickupDistance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dropoff Distance:</span>
                    <span>{results.details.directDropoffDistance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Detour:</span>
                    <span>{results.details.totalDetourDistance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time Difference:</span>
                    <span>{results.details.timeDifference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bearing Difference:</span>
                    <span>{results.details.bearingDifference}</span>
                  </div>
                </div>
              )}

              {results.success &&
                (testType === "manualMatch" ||
                  testType === "autoMatch" ||
                  testType === "forceMatch") && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Match Success:</span>
                      <span
                        className={
                          results.isMatched ? "text-green-500" : "text-red-500"
                        }
                      >
                        {results.isMatched
                          ? "Successfully Matched"
                          : "Failed to Match"}
                      </span>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
