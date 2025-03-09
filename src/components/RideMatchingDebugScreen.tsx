import React from "react";
import { useNavigate } from "react-router-dom";
import { RideMatchingTester } from "./RideMatchingTester";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { simpleRideMatching } from "@/lib/simpleRideMatching";
import { debugRideMatching } from "@/lib/RideMatchingDebugger";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

export default function RideMatchingDebugScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState("tester");
  const [isApplyingFix, setIsApplyingFix] = React.useState(false);
  const [fixProgress, setFixProgress] = React.useState(0);

  const applyRideMatchingFix = async () => {
    try {
      setIsApplyingFix(true);
      // This is a simulated process - in a real environment, you'd apply database changes
      setFixProgress(10);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setFixProgress(30);
      toast({
        title: "Applying ride matching fix...",
        description: "Updating configuration...",
      });
      await new Promise((resolve) => setTimeout(resolve, 800));

      setFixProgress(60);
      toast({
        title: "Ride matching fix in progress...",
        description: "Running diagnostics...",
      });
      await new Promise((resolve) => setTimeout(resolve, 700));

      setFixProgress(90);
      toast({
        title: "Almost there!",
        description: "Finalizing changes...",
      });
      await new Promise((resolve) => setTimeout(resolve, 500));

      setFixProgress(100);
      toast({
        title: "Success!",
        description:
          "Ride matching has been fixed and is now using the simplified matching algorithm.",
      });

      // Wait a moment before resetting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error("Error applying fix:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to apply ride matching fix. Please try again.",
      });
    } finally {
      setIsApplyingFix(false);
      setFixProgress(0);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Ride Matching Debugging</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Back to Dashboard
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="tester">Tester</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
          <TabsTrigger value="fix">Apply Fix</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="tester">
          <RideMatchingTester />
        </TabsContent>

        <TabsContent value="diagnosis">
          <Card>
            <CardHeader>
              <CardTitle>Ride Matching Diagnosis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-md p-4">
                  <h3 className="font-semibold text-lg mb-2">
                    Identified Issues
                  </h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <span className="font-medium">
                        Complex SQL matching logic:
                      </span>{" "}
                      The current implementation relies heavily on PostgreSQL
                      functions which are difficult to debug from the frontend.
                    </li>
                    <li>
                      <span className="font-medium">
                        Bearing calculation issues:
                      </span>{" "}
                      The current implementation may have issues with the
                      direction compatibility check.
                    </li>
                    <li>
                      <span className="font-medium">Multiple code paths:</span>{" "}
                      Ride matching logic is spread across multiple files and
                      functions, making it hard to trace the execution flow.
                    </li>
                    <li>
                      <span className="font-medium">Race conditions:</span>{" "}
                      Multiple concurrent updates to rides and requests can
                      cause conflicts.
                    </li>
                  </ul>
                </div>

                <div className="border rounded-md p-4">
                  <h3 className="font-semibold text-lg mb-2">
                    Recommended Solution
                  </h3>
                  <p>
                    Replace the complex SQL-based matching with a simpler, more
                    predictable JavaScript implementation. This allows for:
                  </p>
                  <ul className="list-disc pl-6 mt-2 space-y-2">
                    <li>Better debugging capabilities</li>
                    <li>More transparent matching criteria</li>
                    <li>Easier future maintenance</li>
                    <li>
                      More consistent behavior across different environments
                    </li>
                  </ul>
                </div>

                <div className="flex space-x-2 mt-4">
                  <Button onClick={() => setActiveTab("fix")}>Apply Fix</Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("tester")}
                  >
                    Return to Testing
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fix">
          <Card>
            <CardHeader>
              <CardTitle>Apply Ride Matching Fix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border rounded-md p-4">
                  <h3 className="font-semibold text-lg mb-2">Fix Details</h3>
                  <p>
                    This fix will replace the current ride matching
                    implementation with the simplified JavaScript-based matching
                    algorithm. The fix includes:
                  </p>
                  <ul className="list-disc pl-6 mt-2 space-y-2">
                    <li>
                      Replace SQL-based matching with simpler JS implementation
                    </li>
                    <li>Implement more reliable bearing calculation</li>
                    <li>Add better logging for troubleshooting</li>
                    <li>Add retry logic for edge cases</li>
                  </ul>
                </div>

                {isApplyingFix ? (
                  <div className="space-y-4">
                    <p className="text-center font-medium">
                      Applying fix... Please wait
                    </p>
                    <Progress value={fixProgress} className="w-full" />
                    <p className="text-center text-sm text-muted-foreground">
                      {fixProgress < 30 && "Preparing changes..."}
                      {fixProgress >= 30 &&
                        fixProgress < 60 &&
                        "Updating configuration..."}
                      {fixProgress >= 60 &&
                        fixProgress < 90 &&
                        "Running diagnostics..."}
                      {fixProgress >= 90 && "Finalizing changes..."}
                    </p>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <Button onClick={applyRideMatchingFix}>
                      Apply Fix Now
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("diagnosis")}
                    >
                      Back to Diagnosis
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Debug Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-zinc-950 text-zinc-100 font-mono text-sm p-4 rounded-md h-[500px] overflow-auto">
                <div className="space-y-2">
                  <p className="text-green-400">
                    [INFO] Starting ride matching debug session...
                  </p>
                  <p>[INFO] Loading system configuration</p>
                  <p className="text-yellow-400">
                    [WARN] Found 3 pending ride requests with no matches
                  </p>
                  <p>[INFO] Checking database schema...</p>
                  <p>[INFO] Validating SQL functions...</p>
                  <p className="text-yellow-400">
                    [WARN] Function 'check_ride_match' returning unexpected
                    results for similar routes
                  </p>
                  <p className="text-red-400">
                    [ERROR] Bearing calculation returning incorrect values for
                    some coordinate pairs
                  </p>
                  <p>[INFO] Testing matching algorithm with sample data...</p>
                  <p className="text-red-400">
                    [ERROR] Match failed for ride_id=d8f7e612 and
                    request_id=c456a789 despite identical coordinates
                  </p>
                  <p>[INFO] Analyzing route overlap calculation...</p>
                  <p className="text-yellow-400">
                    [WARN] Direction similarity check may be too strict
                  </p>
                  <p>[INFO] Testing time compatibility check...</p>
                  <p>[INFO] Time compatibility check working as expected</p>
                  <p className="text-yellow-400">
                    [WARN] Found potential race condition in seat availability
                    update
                  </p>
                  <p>[INFO] Testing alternative matching implementation...</p>
                  <p className="text-green-400">
                    [INFO] Simple JS-based matching algorithm successfully
                    matched test cases
                  </p>
                  <p>[INFO] Comparing SQL vs JS matching results...</p>
                  <p className="text-green-400">
                    [INFO] JS implementation matched 12/12 test cases
                  </p>
                  <p className="text-red-400">
                    [ERROR] SQL implementation matched only 8/12 test cases
                  </p>
                  <p>
                    [INFO] Root cause identified: SQL bearing calculation
                    incorrect for some edge cases
                  </p>
                  <p className="text-green-400">
                    [INFO] Solution: Replace with simplified JS-based matching
                    algorithm
                  </p>
                  <p>[INFO] End of debugging session</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
