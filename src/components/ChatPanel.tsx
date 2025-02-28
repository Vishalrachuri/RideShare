import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  region_id: string;
  sender?: {
    full_name: string;
    avatar_url: string;
  };
}

interface Region {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export default function ChatPanel() {
  const [userRegion, setUserRegion] = React.useState<Region | null>(null);
  const [regions, setRegions] = React.useState<Region[]>([]);
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Function to calculate distance between two points using Haversine formula
  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Function to find user's region based on their location
  const findUserRegion = (
    userLat: number,
    userLon: number,
    regions: Region[],
  ) => {
    return regions.find(
      (region) =>
        getDistance(userLat, userLon, region.latitude, region.longitude) <=
        region.radius,
    );
  };

  // Load regions and determine user's region
  React.useEffect(() => {
    const loadRegions = async () => {
      const { data: regionsData, error } = await supabase
        .from("regions")
        .select("*");

      if (error) {
        console.error("Error loading regions:", error);
        return;
      }

      setRegions(regionsData);

      // Get user's location and find their region
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userRegion = findUserRegion(
              position.coords.latitude,
              position.coords.longitude,
              regionsData,
            );
            setUserRegion(userRegion || null);
          },
          (error) => {
            console.error("Error getting location:", error);
            // Default to North Texas if location access is denied
            setUserRegion(
              regionsData.find((r) => r.name === "North Texas") || null,
            );
          },
        );
      }
    };

    loadRegions();
  }, []);

  React.useEffect(() => {
    // Load initial messages
    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel("global_chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_chat_messages" },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          scrollToBottom();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMessages = async () => {
    if (!userRegion) return;

    const { data, error } = await supabase
      .from("global_chat_messages")
      .select(
        `
        *,
        sender:sender_id(full_name, avatar_url)
      `,
      )
      .eq("region_id", userRegion.id)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error loading messages:", error);
      return;
    }

    setMessages(data);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    if (!userRegion) {
      alert("Unable to determine your region");
      return;
    }

    const { error } = await supabase.from("global_chat_messages").insert({
      content: newMessage.trim(),
      sender_id: user.id,
      region_id: userRegion.id,
    });

    if (error) {
      console.error("Error sending message:", error);
      return;
    }

    setNewMessage("");
  };

  if (!userRegion) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <p className="text-muted-foreground">Determining your region...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="px-4 py-2 border-b bg-muted/50">
        <h3 className="font-semibold">Chat - {userRegion.name}</h3>
      </div>
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <Card
                key={message.id}
                className={`p-3 max-w-[80%] ${message.sender_id === user?.id ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                <div className="flex items-start gap-2">
                  <Avatar className="w-6 h-6">
                    <img
                      src={
                        message.sender?.avatar_url ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.sender_id}`
                      }
                      alt={message.sender?.full_name || "User"}
                    />
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {message.sender?.full_name || "Anonymous"}
                    </p>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-auto border-t bg-background p-4">
        <form onSubmit={sendMessage}>
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
