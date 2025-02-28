import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Clock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import RideSearchPanel from "./RideSearchPanel";
import OfferRidePanel from "./OfferRidePanel";
import ActiveRidePanel from "./ActiveRidePanel";
import DriverRideScreen from "./DriverRideScreen";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";

interface Stop {
  type: "pickup" | "dropoff";
  location: google.maps.LatLngLiteral;
  passenger: {
    id: string;
    name: string;
  };
  completed: boolean;
}

const mapStyles = [
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
];

interface MapViewProps {
  userType?: "driver" | "passenger";
  center?: { lat: number; lng: number };
  zoom?: number;
  onMapClick?: (event: { lat: number; lng: number }) => void;
}

const MapView = ({
  userType = "passenger",
  center = { lat: 33.2148, lng: -97.1331 },
  zoom = 15,
  onMapClick = () => {},
}: MapViewProps) => {
  const [map, setMap] = React.useState<google.maps.Map | null>(null);
  const [pickupDirections, setPickupDirections] =
    React.useState<google.maps.DirectionsResult | null>(null);
  const [dropoffDirections, setDropoffDirections] =
    React.useState<google.maps.DirectionsResult | null>(null);
  const [activeRide, setActiveRide] = React.useState<any>(null);
  const [stops, setStops] = React.useState<Stop[]>([]);
  const { user } = useAuth();

  React.useEffect(() => {
    if (!user) return;

    const loadActiveRide = async () => {
      const { data: rideData, error } = await supabase
        .from(userType === "driver" ? "rides" : "ride_requests")
        .select(
          `
          *,
          ${userType === "driver" ? "ride_requests(*)" : "ride:ride_id(*, driver:driver_id(*))"}
        `,
        )
        .eq(userType === "driver" ? "driver_id" : "rider_id", user.id)
        .in("status", [
          "accepted",
          "driver_accepted",
          "in_progress",
          "pickup_pending",
          "picked_up",
        ])
        .single();

      if (error || !rideData) return;

      console.log("Active ride data:", rideData);
      setActiveRide(rideData);

      // Create stops array for drivers
      if (userType === "driver" && rideData.ride_requests) {
        const allStops: Stop[] = [];
        rideData.ride_requests?.forEach((request: any) => {
          allStops.push({
            type: "pickup",
            location: {
              lat: request.pickup_latitude,
              lng: request.pickup_longitude,
            },
            passenger: {
              id: request.rider_id,
              name: request.rider?.full_name || "Passenger",
            },
            completed:
              request.status === "in_progress" ||
              request.status === "completed",
          });
          allStops.push({
            type: "dropoff",
            location: {
              lat: request.destination_latitude,
              lng: request.destination_longitude,
            },
            passenger: {
              id: request.rider_id,
              name: request.rider?.full_name || "Passenger",
            },
            completed: request.status === "completed",
          });
        });

        setStops(allStops);
        calculateRoutes(allStops);
      }
    };

    loadActiveRide();

    const channel = supabase
      .channel(`ride_updates_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: userType === "driver" ? "rides" : "ride_requests",
          filter: `${userType === "driver" ? "driver_id" : "rider_id"}=eq.${user.id}`,
        },
        loadActiveRide,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userType]);

  const calculateRoutes = async (stops: Stop[]) => {
    if (!stops.length) return;

    const directionsService = new google.maps.DirectionsService();

    // Calculate pickup routes (incomplete pickups)
    const pickupStops = stops.filter(
      (stop) => stop.type === "pickup" && !stop.completed,
    );

    if (pickupStops.length > 0) {
      try {
        const result = await directionsService.route({
          origin: center,
          destination: pickupStops[pickupStops.length - 1].location,
          waypoints: pickupStops.slice(0, -1).map((stop) => ({
            location: stop.location,
            stopover: true,
          })),
          optimizeWaypoints: true,
          travelMode: google.maps.TravelMode.DRIVING,
        });
        setPickupDirections(result);
      } catch (error) {
        console.error("Error calculating pickup routes:", error);
      }
    }

    // Calculate dropoff routes (completed pickups but incomplete dropoffs)
    const dropoffStops = stops.filter(
      (stop) =>
        stop.type === "dropoff" &&
        !stop.completed &&
        stops.find(
          (s) =>
            s.type === "pickup" &&
            s.passenger.id === stop.passenger.id &&
            s.completed,
        ),
    );

    if (dropoffStops.length > 0) {
      try {
        const result = await directionsService.route({
          origin: dropoffStops[0].location,
          destination: dropoffStops[dropoffStops.length - 1].location,
          waypoints: dropoffStops.slice(1, -1).map((stop) => ({
            location: stop.location,
            stopover: true,
          })),
          optimizeWaypoints: true,
          travelMode: google.maps.TravelMode.DRIVING,
        });
        setDropoffDirections(result);
      } catch (error) {
        console.error("Error calculating dropoff routes:", error);
      }
    }
  };

  const [userLocation, setUserLocation] = React.useState(center);
  const [searchedLocations, setSearchedLocations] = React.useState<{
    pickup?: google.maps.LatLngLiteral;
    dropoff?: google.maps.LatLngLiteral;
  }>({});

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLocation);
          if (map) {
            map.panTo(newLocation);
          }
        },
        () => {
          console.log("Error getting location");
        },
      );
    }
  }, [map]);

  const onLoad = React.useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = React.useCallback(() => {
    setMap(null);
  }, []);

  return (
    <div className="relative w-full h-[918px]">
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={userLocation}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={(e) =>
          onMapClick({ lat: e.latLng?.lat() || 0, lng: e.latLng?.lng() || 0 })
        }
        options={{
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: mapStyles,
        }}
      >
        {/* Show pickup routes in green */}
        {pickupDirections && (
          <DirectionsRenderer
            directions={pickupDirections}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#34A853",
                strokeWeight: 4,
              },
            }}
          />
        )}

        {/* Show dropoff routes in red */}
        {dropoffDirections && (
          <DirectionsRenderer
            directions={dropoffDirections}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#EA4335",
                strokeWeight: 4,
              },
            }}
          />
        )}

        {/* Show stops */}
        {stops.map((stop, index) => (
          <Marker
            key={`${stop.passenger.id}-${stop.type}`}
            position={stop.location}
            icon={{
              url: `data:image/svg+xml,${encodeURIComponent(
                `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" fill="${stop.type === "pickup" ? "#34A853" : "#EA4335"}" fill-opacity="${stop.completed ? 0.5 : 1}" stroke="white" stroke-width="2"/>
                </svg>`,
              )}`,
              size: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12),
            }}
            label={{
              text: `${stop.type === "pickup" ? "P" : "D"}-${index + 1}`,
              className: "marker-label",
            }}
          />
        ))}

        {/* User Location Marker */}
        <Marker
          position={userLocation}
          icon={{
            url: `data:image/svg+xml,${encodeURIComponent(
              `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="white" stroke-width="2"/>
              </svg>`,
            )}`,
            size: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12),
          }}
        />

        {/* Search Location Markers */}
        {searchedLocations.pickup && (
          <Marker
            position={searchedLocations.pickup}
            icon={{
              url: `data:image/svg+xml,${encodeURIComponent(
                `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" fill="#34A853" stroke="white" stroke-width="2"/>
                </svg>`,
              )}`,
              size: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12),
            }}
          />
        )}

        {searchedLocations.dropoff && (
          <Marker
            position={searchedLocations.dropoff}
            icon={{
              url: `data:image/svg+xml,${encodeURIComponent(
                `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" fill="#EA4335" stroke="white" stroke-width="2"/>
                </svg>`,
              )}`,
              size: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12),
            }}
          />
        )}
      </GoogleMap>

      {/* Floating Panels */}
      <div className="absolute top-20 left-4 z-10">
        {userType === "passenger" ? (
          activeRide ? (
            <ActiveRidePanel
              className="w-[400px]"
              ride={activeRide}
              onCancel={() => setActiveRide(null)}
            />
          ) : (
            <RideSearchPanel
              onLocationSelect={(type, coords) => {
                setSearchedLocations((prev) => ({
                  ...prev,
                  [type]: coords,
                }));
                if (map) {
                  map.panTo(coords);
                  map.setZoom(14);
                }
              }}
            />
          )
        ) : activeRide?.status === "in_progress" ? (
          <DriverRideScreen
            className="w-[400px]"
            ride={activeRide}
            onComplete={() => setActiveRide(null)}
          />
        ) : (
          <OfferRidePanel
            onLocationSelect={(type, coords) => {
              setSearchedLocations((prev) => ({
                ...prev,
                [type]: coords,
              }));
              if (map) {
                map.panTo(coords);
                map.setZoom(14);
              }
            }}
          />
        )}
      </div>

      {/* Map Controls */}
      <Card className="absolute bottom-4 right-4 p-2 space-x-2 flex">
        <button
          className="w-8 h-8 flex items-center justify-center bg-white rounded-md hover:bg-gray-100"
          onClick={() => map?.setZoom((map.getZoom() || zoom) + 1)}
        >
          +
        </button>
        <button
          className="w-8 h-8 flex items-center justify-center bg-white rounded-md hover:bg-gray-100"
          onClick={() => map?.setZoom((map.getZoom() || zoom) - 1)}
        >
          -
        </button>
      </Card>
    </div>
  );
};

export default MapView;
