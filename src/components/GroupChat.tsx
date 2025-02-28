import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

interface GroupChatProps {
  groupId: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url: string;
  };
}

export default function GroupChat({ groupId }: GroupChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`group_${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
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
  }, [groupId]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("group_messages")
      .select(
        `
        *,
        sender:sender_id(full_name, avatar_url)
      `,
      )
      .eq("group_id", groupId)
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

    const { error } = await supabase.from("group_messages").insert({
      content: newMessage.trim(),
      sender_id: user.id,
      group_id: groupId,
    });

    if (error) {
      console.error("Error sending message:", error);
      return;
    }

    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
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
