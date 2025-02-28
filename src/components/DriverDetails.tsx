import React from "react";
import { Card } from "./ui/card";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import { Phone, MessageSquare, Car } from "lucide-react";

interface DriverDetailsProps {
  driver: any;
  className?: string;
}

const DriverDetails = ({ driver, className = "" }: DriverDetailsProps) => {
  if (!driver) {
    return null;
  }

  return (
    <Card className={`p-3 ${className}`}>
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${driver.id}`}
            alt={driver.full_name || "Driver"}
          />
        </Avatar>
        <div className="flex-1">
          <h3 className="font-medium">{driver.full_name || "Your Driver"}</h3>
          <p className="text-xs text-muted-foreground">
            Black Chrysler Pacifica • SZV7369
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default DriverDetails;
