import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateGroupDialog({
  open,
  onClose,
}: CreateGroupDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [categories, setCategories] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    category_id: "",
    location: "",
  });

  const locationInputRef = React.useRef<HTMLInputElement>(null);
  const [coordinates, setCoordinates] = React.useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  React.useEffect(() => {
    // Load categories
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("group_categories")
        .select("*");

      if (error) {
        console.error("Error loading categories:", error);
        return;
      }

      setCategories(data);
    };

    loadCategories();
  }, []);

  React.useEffect(() => {
    if (!window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(
      locationInputRef.current!,
      { types: ["(cities)"], componentRestrictions: { country: "us" } },
    );

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;

      setCoordinates({
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
      });
      setFormData((prev) => ({
        ...prev,
        location: place.formatted_address || "",
      }));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !coordinates) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_groups")
        .insert({
          name: formData.name,
          description: formData.description,
          category_id: formData.category_id,
          location_name: formData.location,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Join the group automatically
      const { error: joinError } = await supabase.from("group_members").insert({
        group_id: data.id,
        user_id: user.id,
      });

      if (error) throw error;
      onClose();
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Group</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) =>
                setFormData({ ...formData, category_id: value })
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              ref={locationInputRef}
              id="location"
              placeholder="Enter a city in the USA"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
