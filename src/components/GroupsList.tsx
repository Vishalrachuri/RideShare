import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Users, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

interface Group {
  id: string;
  name: string;
  description: string;
  location_name: string;
  category_id: string;
  _count: {
    members: number;
  };
}

interface GroupsListProps {
  onSelectGroup: (groupId: string) => void;
  onCreateGroup: () => void;
}

export default function GroupsList({
  onSelectGroup,
  onCreateGroup,
}: GroupsListProps) {
  const { user } = useAuth();
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    if (!user) return;

    const { data, error } = await supabase.from("chat_groups").select("*");

    if (error) {
      console.error("Error loading groups:", error);
      return;
    }

    // Get member counts for each group
    const { data: membersData, error: membersError } = await supabase
      .from("group_members")
      .select("group_id");

    if (error) {
      console.error("Error loading groups:", error);
      return;
    }

    if (data && !error) {
      const memberCounts = {};
      if (membersData) {
        membersData.forEach((member) => {
          memberCounts[member.group_id] =
            (memberCounts[member.group_id] || 0) + 1;
        });
      }

      const groupsWithCounts = data.map((group) => ({
        ...group,
        _count: {
          members: memberCounts[group.id] || 0,
        },
      }));

      setGroups(groupsWithCounts);
    }
    setLoading(false);
  };

  const joinGroup = async (groupId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: user.id });

    if (error) {
      if (error.code === "23505") {
        // Unique violation error code
        // User is already a member, just open the chat
        onSelectGroup(groupId);
      } else {
        console.error("Error joining group:", error);
      }
      return;
    }

    onSelectGroup(groupId);
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading groups...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Groups</h2>
        <Button onClick={onCreateGroup} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="space-y-4">
          {groups.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No groups found. Create one to get started!
            </div>
          ) : (
            groups.map((group) => (
              <Card
                key={group.id}
                className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => joinGroup(group.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {group.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{group.location_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="h-4 w-4 mr-1" />
                    {group._count.members}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
