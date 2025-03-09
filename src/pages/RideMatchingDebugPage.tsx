import React from "react";
import { RideMatchingTester } from "@/components/RideMatchingTester";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function RideMatchingDebugPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ride Matching Debugger</h1>
        <Link to="/debug/ride-matching/advanced">
          <Button variant="outline">Advanced Debugging</Button>
        </Link>
      </div>
      <p className="mb-6 text-muted-foreground">
        Use this tool to test and debug the ride matching logic. You can check
        if rides and requests match, test automatic matching, manually match
        rides, or force a match between a ride and request.
      </p>
      <RideMatchingTester />
    </div>
  );
}
