import React from "react";
import { LoadScript } from "@react-google-maps/api";

export default function ApiKeyTest() {
  const [error, setError] = React.useState<string>("");
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    // Test the API key by loading the Places service
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      try {
        // Try to create a Places service
        new window.google.maps.places.AutocompleteService();
        setSuccess(true);
      } catch (err) {
        setError(err.message);
      }
    };
    script.onerror = () => {
      setError("Failed to load Google Maps API");
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Google Maps API Key Test</h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          Success! Your API key is working correctly.
        </div>
      )}
      <div className="mt-4 text-sm text-gray-600">
        API Key: {import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
      </div>
    </div>
  );
}
