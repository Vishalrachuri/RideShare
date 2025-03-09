import {
  integratedRideMatching as integrationModule,
  enableSimpleRideMatching as enableMatching,
  disableSimpleRideMatching as disableMatching,
} from "./rideMatchingIntegration";

// Export the integrated ride matching module for use throughout the app
export const integratedRideMatching = integrationModule;

/**
 * Enable the simplified matching system
 */
export const enableSimpleRideMatching = () => {
  // Call the imported function directly
  enableMatching();
  console.log("Simple ride matching system enabled via integration module");
};

/**
 * Disable the simplified matching system (go back to SQL-based matching)
 */
export const disableSimpleRideMatching = () => {
  // Call the imported function directly
  disableMatching();
  console.log("Simple ride matching system disabled via integration module");
};
