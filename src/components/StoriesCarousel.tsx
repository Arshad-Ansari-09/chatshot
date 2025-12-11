import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface StoryWithProfile {
  id: string;
  user_id: string;
  media_url: string;
  caption: string | null;
  created_at: string;
  profile: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  hasViewed: boolean;
}

const StoriesCarousel = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryWithProfile[]>([]);
  const [viewingStory, setViewingStory] = useState<StoryWithProfile | null>(null);
  const [isAddingStory, setIsAddingStory] = useState(false);
  const [newStoryUrl, setNewStoryUrl] = useState('');
  const [newStoryCaption, setNewStoryCaption] = useState('');

  const fetchStories = async () => {
    if (!user) return;

    const { data: storiesData, error } = await supabase
      .from('stories')
      .select(`
        id,
        user_id,
        media_url,
        caption,
        created_at,
        profiles!stories_user_id_fkey (
          username,
          full_name,
          avatar_url
        )
      `)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stories:', error);
      return;
    }

    // Get viewed stories
    const { data: viewedData } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', user.id);

    const viewedStoryIds = new Set(viewedData?.map(v => v.story_id) || []);

    // Group stories by user
    const userStories = new Map<string, StoryWithProfile>();
    
    storiesData?.forEach((story: any) => {
      if (!userStories.has(story.user_id)) {
        userStories.set(story.user_id, {
          ...story,
          profile: story.profiles,
          hasViewed: viewedStoryIds.has(story.id),
        });
      }
    });

    setStories(Array.from(userStories.values()));
  };

  useEffect(() => {
    fetchStories();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('stories-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stories' },
        () => fetchStories()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const viewStory = async (story: StoryWithProfile) => {
    if (!user) return;
    setViewingStory(story);

    // Mark as viewed if not already
    if (!story.hasViewed && story.user_id !== user.id) {
      await supabase.from('story_views').insert({
        story_id: story.id,
        viewer_id: user.id,
      });
      fetchStories();
    }
  };

  const addStory = async () => {
    if (!user || !newStoryUrl.trim()) {
      toast.error('Please provide an image URL');
      return;
    }

    const { error } = await supabase.from('stories').insert({
      user_id: user.id,
      media_url: newStoryUrl.trim(),
      caption: newStoryCaption.trim() || null,
    });

    if (error) {
      toast.error('Failed to add story');
      console.error(error);
    } else {
      toast.success('Story added!');
      setNewStoryUrl('');
      setNewStoryCaption('');
      setIsAddingStory(false);
      fetchStories();
    }
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Stories</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {/* Add Story Button */}
        <Dialog open={isAddingStory} onOpenChange={setIsAddingStory}>
          <DialogTrigger asChild>
            <button className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center border-2 border-dashed border-primary/50 hover:border-primary transition-colors">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
              </div>
              <span className="text-xs text-muted-foreground">Add Story</span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Add New Story</h3>
              <Input
                placeholder="Image URL"
                value={newStoryUrl}
                onChange={(e) => setNewStoryUrl(e.target.value)}
              />
              <Input
                placeholder="Caption (optional)"
                value={newStoryCaption}
                onChange={(e) => setNewStoryCaption(e.target.value)}
              />
              <Button onClick={addStory} className="w-full gradient-primary text-primary-foreground">
                Post Story
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stories */}
        {stories.map((story) => (
          <Dialog key={story.id}>
            <DialogTrigger asChild>
              <button
                className="flex-shrink-0 flex flex-col items-center gap-2"
                onClick={() => viewStory(story)}
              >
                <Avatar 
                  className={`w-16 h-16 ${
                    story.hasViewed ? 'story-ring-viewed' : 'story-ring-unread'
                  }`}
                >
                  <AvatarImage src={story.profile.avatar_url || undefined} />
                  <AvatarFallback className="bg-accent text-accent-foreground">
                    {story.profile.full_name?.[0] || story.profile.username?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground truncate w-16 text-center">
                  {story.user_id === user?.id ? 'You' : story.profile.username || 'User'}
                </span>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card">
              {viewingStory && (
                <div className="relative">
                  <img
                    src={viewingStory.media_url}
                    alt="Story"
                    className="w-full aspect-[9/16] object-cover"
                  />
                  <div className="absolute top-4 left-4 flex items-center gap-3">
                    <Avatar className="w-10 h-10 border-2 border-card">
                      <AvatarImage src={viewingStory.profile.avatar_url || undefined} />
                      <AvatarFallback>
                        {viewingStory.profile.full_name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-card">
                        {viewingStory.profile.full_name || viewingStory.profile.username}
                      </p>
                      <p className="text-xs text-card/70">
                        {new Date(viewingStory.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  {viewingStory.caption && (
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-sm text-card bg-foreground/20 backdrop-blur-sm px-3 py-2 rounded-lg">
                        {viewingStory.caption}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
};

export default StoriesCarousel;
