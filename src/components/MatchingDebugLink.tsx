import React from "react";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { Bug } from "lucide-react";

export default function MatchingDebugLink() {
  return (
    <Link to="/debug/ride-matching">
      <Button variant="outline" size="sm" className="flex items-center gap-2">
        <Bug className="h-4 w-4" />
        <span>Debug Ride Matching</span>
      </Button>
    </Link>
  );
}
