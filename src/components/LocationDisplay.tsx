import React from "react";
import { Loader2 } from "lucide-react";

interface LocationDisplayProps {
  lat: number;
  lng: number;
  icon: React.ReactNode;
  label: string;
}

function LocationDisplay({ lat, lng, icon, label }: LocationDisplayProps) {
  const [address, setAddress] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!window.google?.maps) {
      setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setLoading(false);
      return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat, lng } },
      (
        results: google.maps.GeocoderResult[],
        status: google.maps.GeocoderStatus,
      ) => {
        if (status === "OK" && results[0]) {
          setAddress(results[0].formatted_address);
        } else {
          setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setLoading(false);
      },
    );
  }, [lat, lng]);

  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span className="text-sm">{address}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default LocationDisplay;
