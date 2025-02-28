import React from "react";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Bell, Menu, MessageSquare, LogOut, Car } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  userAvatar?: string;
  userName?: string;
  role?: "driver" | "passenger";
  onProfileClick?: () => void;
  onNotificationsClick?: () => void;
  onMessagesClick?: () => void;
  onMenuClick?: () => void;
}

const Header = ({
  userAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=default",
  userName = "John Doe",
  role = "passenger",
  onProfileClick = () => {},
  onNotificationsClick = () => {},
  onMessagesClick = () => {},
  onMenuClick = () => {},
}: HeaderProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };
  return (
    <header className="w-full h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between fixed top-0 z-50">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={onMenuClick}>
          <Menu className="h-6 w-6" />
        </Button>
        <div className="text-xl font-bold">RideShare</div>
        <div className="text-sm text-muted-foreground capitalize">{role}</div>
      </div>

      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={onNotificationsClick}>
          <Bell className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="icon" onClick={onMessagesClick}>
          <MessageSquare className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar>
                <img
                  src={userAvatar}
                  alt={userName}
                  className="h-8 w-8 rounded-full"
                />
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onProfileClick}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
