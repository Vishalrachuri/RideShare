import React from "react";
import Header from "@/components/Header";
import MapView from "@/components/MapView";
import MainDrawer from "@/components/MainDrawer";
import { useAuth } from "@/lib/AuthContext";

const PassengerDashboard = () => {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <MainDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Header
        userName={user?.user_metadata?.full_name}
        userAvatar={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
        role="passenger"
        onProfileClick={() => console.log("Profile clicked")}
        onNotificationsClick={() => console.log("Notifications clicked")}
        onMessagesClick={() => console.log("Messages clicked")}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <main className="pt-16">
        <MapView
          userType="passenger"
          center={{ lat: 33.2148, lng: -97.1331 }}
          zoom={12}
          onMapClick={(coords) => {
            console.log("Map clicked at:", coords);
          }}
        />
      </main>
    </div>
  );
};

export default PassengerDashboard;
