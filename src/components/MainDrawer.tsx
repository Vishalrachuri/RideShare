import React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AutomaticMatchingInfo from "./AutomaticMatchingInfo";
import RideRequestsList from "./RideRequestsList";
import AcceptedRidesPanel from "./AcceptedRidesPanel";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import RideHistoryPanel from "./RideHistoryPanel";

interface MainDrawerProps {
  open?: boolean;
  onClose?: () => void;
  userType?: "driver" | "passenger";
}

const MainDrawer = ({
  open = false,
  onClose = () => {},
  userType = "passenger",
}: MainDrawerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // Function to force a refresh of child components
  const refreshData = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Show different tabs based on user type
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="w-[400px] sm:w-[540px] p-0 overflow-hidden flex flex-col"
      >
        <Tabs defaultValue="current" className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b">
            <TabsTrigger value="current">Current Rides</TabsTrigger>
            {userType === "driver" && (
              <TabsTrigger value="passengers">Passengers</TabsTrigger>
            )}
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-0 flex-1 overflow-auto">
            {userType === "passenger" ? (
              <>
                <div className="p-4 pb-0">
                  <h3 className="font-semibold mb-2">Your Ride Requests</h3>
                </div>
                <RideRequestsList
                  key={`requests-${refreshTrigger}`}
                  onStatusChange={refreshData}
                />
              </>
            ) : (
              <div className="p-4 space-y-6">
                <AutomaticMatchingInfo />

                <div className="space-y-4">
                  <h3 className="font-semibold">Ride Requests</h3>
                  <p className="text-sm text-muted-foreground">
                    When you offer a ride, the system will automatically match
                    passengers going in your direction. You'll be notified when
                    a passenger is matched to your ride.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {userType === "driver" && (
            <TabsContent
              value="passengers"
              className="mt-0 flex-1 overflow-auto"
            >
              <div className="p-4 space-y-4">
                <h3 className="font-semibold">Matched Passengers</h3>
                <AcceptedRidesPanel key={`accepted-${refreshTrigger}`} />
              </div>
            </TabsContent>
          )}

          <TabsContent value="history" className="mt-0 flex-1 overflow-auto">
            <div className="p-4 space-y-4">
              <h3 className="font-semibold">Your Ride History</h3>
              <RideHistoryPanel userType={userType} />
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default MainDrawer;
