import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Camera, Loader2, Clock } from 'lucide-react';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  last_name_change: string | null;
}

const AccountSettings = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newName, setNewName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [canChangeName, setCanChangeName] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const NAME_CHANGE_COOLDOWN_HOURS = 12;

  useEffect(() => {
    if (isOpen && user) {
      fetchProfile();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (profile?.last_name_change) {
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    } else {
      setCanChangeName(true);
      setCountdown(null);
    }
  }, [profile?.last_name_change]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, last_name_change')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setProfile(data);
      setNewName(data.full_name || '');
    }
    setIsLoading(false);
  };

  const updateCountdown = () => {
    if (!profile?.last_name_change) {
      setCanChangeName(true);
      setCountdown(null);
      return;
    }

    const lastChange = new Date(profile.last_name_change);
    const nextAllowed = new Date(lastChange.getTime() + NAME_CHANGE_COOLDOWN_HOURS * 60 * 60 * 1000);
    const now = new Date();
    const diff = nextAllowed.getTime() - now.getTime();

    if (diff <= 0) {
      setCanChangeName(true);
      setCountdown(null);
    } else {
      setCanChangeName(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast.success('Profile picture updated!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleNameChange = async () => {
    if (!user || !newName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    if (!canChangeName) {
      toast.error(`You can only change your name once every ${NAME_CHANGE_COOLDOWN_HOURS} hours.`);
      return;
    }

    setIsSavingName(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: newName.trim(),
          last_name_change: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { 
        ...prev, 
        full_name: newName.trim(),
        last_name_change: new Date().toISOString()
      } : null);
      
      toast.success('Name updated successfully!');
    } catch (error: any) {
      console.error('Name update error:', error);
      toast.error('Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-accent"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Profile Picture Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="w-24 h-24 border-4 border-primary/20">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-accent text-accent-foreground">
                    {profile?.full_name?.[0] || profile?.username?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Click the camera icon to update your photo
              </p>
            </div>

            {/* Name Change Section */}
            <div className="space-y-3">
              <Label htmlFor="fullName">Display Name</Label>
              <div className="flex gap-2">
                <Input
                  id="fullName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={50}
                  disabled={!canChangeName}
                  className={!canChangeName ? 'opacity-50' : ''}
                />
                <Button
                  onClick={handleNameChange}
                  disabled={isSavingName || !canChangeName || newName.trim() === profile?.full_name}
                  className="shrink-0"
                >
                  {isSavingName ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
              
              {/* Countdown Timer */}
              {!canChangeName && countdown && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    You can change your name again in{' '}
                    <span className="font-mono font-semibold text-foreground">{countdown}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Username Display (read-only) */}
            <div className="space-y-2">
              <Label>Username</Label>
              <p className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                @{profile?.username || 'unknown'}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AccountSettings;
