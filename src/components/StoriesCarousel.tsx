import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, X, ChevronLeft, ChevronRight, Eye, Loader2, Globe, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WORLD_CHAT_ID } from '@/lib/constants';

type StoryVisibility = 'world' | 'friends';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  hasViewed: boolean;
  visibility: StoryVisibility;
}

interface UserStories {
  user_id: string;
  profile: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
  stories: Story[];
  hasUnviewedStories: boolean;
}

interface StoryViewer {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

// Preloaded images cache
const preloadedImages = new Map<string, HTMLImageElement>();

const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (preloadedImages.has(url)) {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      preloadedImages.set(url, img);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
};

const preloadVideo = (url: string): Promise<void> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.oncanplaythrough = () => resolve();
    video.onerror = () => resolve(); // Resolve anyway to not block
    video.src = url;
    // Start loading
    video.load();
  });
};

const StoriesCarousel = () => {
  const { user } = useAuth();
  const [userStoriesMap, setUserStoriesMap] = useState<UserStories[]>([]);
  const [viewingUserIndex, setViewingUserIndex] = useState<number | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isAddingStory, setIsAddingStory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newStoryCaption, setNewStoryCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyViewers, setStoryViewers] = useState<StoryViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<StoryVisibility>('friends');
  const [newStoryVisibility, setNewStoryVisibility] = useState<StoryVisibility>('world');
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const STORY_DURATION = 5000; // 5 seconds for images

  // Fetch friend IDs (users with active conversations)
  const fetchFriendIds = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .neq('conversation_id', WORLD_CHAT_ID);

    if (error) {
      console.error('Error fetching friends:', error);
      return;
    }

    // Find all conversation_ids the current user is part of
    const myConversations = new Set(
      data?.filter(p => p.user_id === user.id).map(p => p.conversation_id) || []
    );

    // Get all other users from those conversations
    const friends = new Set(
      data
        ?.filter(p => myConversations.has(p.conversation_id) && p.user_id !== user.id)
        .map(p => p.user_id) || []
    );

    setFriendIds(friends);
  }, [user]);

  useEffect(() => {
    fetchFriendIds();
  }, [fetchFriendIds]);

  const fetchStories = useCallback(async () => {
    if (!user) return;

    const { data: storiesData, error } = await supabase
      .from('stories')
      .select(`
        id,
        user_id,
        media_url,
        media_type,
        caption,
        created_at,
        visibility,
        profiles!stories_user_id_fkey (
          username,
          full_name,
          avatar_url
        )
      `)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

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
    const userMap = new Map<string, UserStories>();
    
    storiesData?.forEach((story: any) => {
      const storyItem: Story = {
        id: story.id,
        user_id: story.user_id,
        media_url: story.media_url,
        media_type: story.media_type,
        caption: story.caption,
        created_at: story.created_at,
        hasViewed: viewedStoryIds.has(story.id),
        visibility: story.visibility || 'world',
      };

      if (!userMap.has(story.user_id)) {
        userMap.set(story.user_id, {
          user_id: story.user_id,
          profile: story.profiles,
          stories: [],
          hasUnviewedStories: false,
        });
      }
      
      const userStories = userMap.get(story.user_id)!;
      userStories.stories.push(storyItem);
      if (!storyItem.hasViewed) {
        userStories.hasUnviewedStories = true;
      }
    });

    // Sort: current user first, then users with unviewed stories
    const sortedUsers = Array.from(userMap.values()).sort((a, b) => {
      if (a.user_id === user.id) return -1;
      if (b.user_id === user.id) return 1;
      if (a.hasUnviewedStories && !b.hasUnviewedStories) return -1;
      if (!a.hasUnviewedStories && b.hasUnviewedStories) return 1;
      return 0;
    });

    setUserStoriesMap(sortedUsers);
  }, [user]);

  // Filter stories based on active tab
  const filteredUserStoriesMap = userStoriesMap.map(userStories => {
    const filteredStories = userStories.stories.filter(story => {
      if (activeTab === 'world') {
        return story.visibility === 'world';
      } else {
        // Friends tab: show friends' stories only (including own)
        return story.visibility === 'friends' && 
          (friendIds.has(story.user_id) || story.user_id === user?.id);
      }
    });

    return {
      ...userStories,
      stories: filteredStories,
      hasUnviewedStories: filteredStories.some(s => !s.hasViewed),
    };
  }).filter(userStories => userStories.stories.length > 0);

  useEffect(() => {
    fetchStories();

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
  }, [fetchStories]);

  const fetchStoryViewers = async (storyId: string) => {
    const { data, error } = await supabase
      .from('story_views')
      .select(`
        viewer_id,
        profiles!story_views_viewer_id_fkey (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('story_id', storyId);

    if (!error && data) {
      setStoryViewers(data.map((v: any) => v.profiles));
    }
  };

  // Preload next stories when viewing
  const preloadNextStories = useCallback(async () => {
    if (viewingUserIndex === null) return;

    const currentUserStories = userStoriesMap[viewingUserIndex];
    const nextStoryIndex = currentStoryIndex + 1;

    // Priority 1: Next story in current user's set
    if (nextStoryIndex < currentUserStories.stories.length) {
      const nextStory = currentUserStories.stories[nextStoryIndex];
      if (nextStory.media_type === 'video') {
        preloadVideo(nextStory.media_url);
      } else {
        preloadImage(nextStory.media_url);
      }
    }

    // Priority 2: First story of next user
    const nextUserIndex = viewingUserIndex + 1;
    if (nextUserIndex < userStoriesMap.length) {
      const nextUserFirstStory = userStoriesMap[nextUserIndex].stories[0];
      if (nextUserFirstStory) {
        if (nextUserFirstStory.media_type === 'video') {
          preloadVideo(nextUserFirstStory.media_url);
        } else {
          preloadImage(nextUserFirstStory.media_url);
        }
      }
    }
  }, [viewingUserIndex, currentStoryIndex, userStoriesMap]);

  // Trigger preloading when story changes
  useEffect(() => {
    preloadNextStories();
  }, [preloadNextStories]);

  const startStoryProgress = useCallback(() => {
    setStoryProgress(0);
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const currentUserStories = viewingUserIndex !== null ? userStoriesMap[viewingUserIndex] : null;
    const currentStory = currentUserStories?.stories[currentStoryIndex];
    
    // Don't auto-advance for videos (handled by onEnded) or while loading
    if (currentStory?.media_type === 'video' || isMediaLoading) return;

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setStoryProgress(progress);

      if (progress >= 100) {
        goToNextStory();
      }
    }, 50);
  }, [viewingUserIndex, currentStoryIndex, userStoriesMap, isMediaLoading]);

  useEffect(() => {
    if (viewingUserIndex !== null && !isMediaLoading) {
      startStoryProgress();
    }
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [viewingUserIndex, currentStoryIndex, startStoryProgress, isMediaLoading]);

  const goToNextStory = useCallback(() => {
    if (viewingUserIndex === null) return;

    const currentUserStories = userStoriesMap[viewingUserIndex];
    
    // Set loading state for transition
    setIsMediaLoading(true);
    
    if (currentStoryIndex < currentUserStories.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else if (viewingUserIndex < userStoriesMap.length - 1) {
      setViewingUserIndex(viewingUserIndex + 1);
      setCurrentStoryIndex(0);
    } else {
      closeStoryViewer();
    }
  }, [viewingUserIndex, currentStoryIndex, userStoriesMap]);

  const goToPreviousStory = useCallback(() => {
    if (viewingUserIndex === null) return;

    // Set loading state for transition
    setIsMediaLoading(true);

    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else if (viewingUserIndex > 0) {
      const prevUserIndex = viewingUserIndex - 1;
      setViewingUserIndex(prevUserIndex);
      setCurrentStoryIndex(userStoriesMap[prevUserIndex].stories.length - 1);
    }
  }, [viewingUserIndex, currentStoryIndex, userStoriesMap]);

  const closeStoryViewer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setViewingUserIndex(null);
    setCurrentStoryIndex(0);
    setStoryProgress(0);
    setShowViewers(false);
    setStoryViewers([]);
    setIsMediaLoading(false);
  };

  const viewUserStories = async (userIndex: number) => {
    if (!user) return;
    
    setIsMediaLoading(true);
    setViewingUserIndex(userIndex);
    setCurrentStoryIndex(0);
    
    const userStories = userStoriesMap[userIndex];
    const firstUnviewedIndex = userStories.stories.findIndex(s => !s.hasViewed);
    
    if (firstUnviewedIndex !== -1) {
      setCurrentStoryIndex(firstUnviewedIndex);
    }

    // Preload the first story
    const storyToView = userStories.stories[firstUnviewedIndex !== -1 ? firstUnviewedIndex : 0];
    
    // Mark first story as viewed
    if (!storyToView.hasViewed && storyToView.user_id !== user.id) {
      await supabase.from('story_views').insert({
        story_id: storyToView.id,
        viewer_id: user.id,
      });
    }
  };

  useEffect(() => {
    const markCurrentStoryViewed = async () => {
      if (viewingUserIndex === null || !user) return;
      
      const currentUserStories = userStoriesMap[viewingUserIndex];
      const currentStory = currentUserStories?.stories[currentStoryIndex];
      
      if (currentStory && !currentStory.hasViewed && currentStory.user_id !== user.id) {
        await supabase.from('story_views').insert({
          story_id: currentStory.id,
          viewer_id: user.id,
        });
        fetchStories();
      }

      // Fetch viewers if viewing own story
      if (currentStory && currentStory.user_id === user.id) {
        fetchStoryViewers(currentStory.id);
      }
    };

    markCurrentStoryViewed();
  }, [viewingUserIndex, currentStoryIndex]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select an image or video file');
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be under 50MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setIsAddingStory(true);
  };

  const uploadStory = async () => {
    if (!user || !selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const mediaType = selectedFile.type.startsWith('video') ? 'video' : 'image';

      const { error: uploadError } = await supabase.storage
        .from('story-media')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('story-media')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: mediaType,
        caption: newStoryCaption.trim() || null,
        visibility: newStoryVisibility,
      });

      if (insertError) throw insertError;

      toast.success('Story added!');
      resetUploadForm();
      fetchStories();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload story');
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setNewStoryCaption('');
    setNewStoryVisibility('world');
    setIsAddingStory(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentUserStories = viewingUserIndex !== null ? filteredUserStoriesMap[viewingUserIndex] : null;
  const currentStory = currentUserStories?.stories[currentStoryIndex];
  const isOwnStory = currentStory?.user_id === user?.id;

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Stories</h2>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StoryVisibility)}>
          <TabsList className="h-8">
            <TabsTrigger value="friends" className="text-xs px-3 h-6 gap-1">
              <Users className="w-3 h-3" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="world" className="text-xs px-3 h-6 gap-1">
              <Globe className="w-3 h-3" />
              World
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {/* Add Story Button */}
        <button 
          className="flex-shrink-0 flex flex-col items-center gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center border-2 border-dashed border-primary/50 hover:border-primary transition-colors">
              <Plus className="w-6 h-6 text-primary" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Add Story</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* User Stories */}
        {filteredUserStoriesMap.map((userStories, index) => (
          <button
            key={userStories.user_id}
            className="flex-shrink-0 flex flex-col items-center gap-2"
            onClick={() => viewUserStories(index)}
          >
            <Avatar 
              className={`w-16 h-16 ring-2 ring-offset-2 ring-offset-card ${
                userStories.hasUnviewedStories 
                  ? 'ring-green-500' 
                  : 'ring-muted-foreground/30'
              }`}
            >
              <AvatarImage src={userStories.profile.avatar_url || undefined} />
              <AvatarFallback className="bg-accent text-accent-foreground">
                {userStories.profile.full_name?.[0] || userStories.profile.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-foreground truncate w-16 text-center">
              {userStories.user_id === user?.id ? 'You' : userStories.profile.username || 'User'}
            </span>
          </button>
        ))}
      </div>

      {/* Upload Story Modal */}
      <Dialog open={isAddingStory} onOpenChange={(open) => !open && resetUploadForm()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Add New Story</h3>
            
            {previewUrl && (
              <div className="relative w-full aspect-[9/16] max-h-[50vh] bg-muted rounded-lg overflow-hidden">
                {selectedFile?.type.startsWith('video') ? (
                  <video 
                    src={previewUrl} 
                    className="w-full h-full object-contain"
                    controls
                  />
                ) : (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            )}
            
            <Input
              placeholder="Caption (optional)"
              value={newStoryCaption}
              onChange={(e) => setNewStoryCaption(e.target.value)}
            />
            
            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium text-foreground">Post to:</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={newStoryVisibility === 'world' ? 'default' : 'outline'}
                  onClick={() => setNewStoryVisibility('world')}
                  className="gap-1"
                >
                  <Globe className="w-4 h-4" />
                  World
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={newStoryVisibility === 'friends' ? 'default' : 'outline'}
                  onClick={() => setNewStoryVisibility('friends')}
                  className="gap-1"
                >
                  <Users className="w-4 h-4" />
                  Friends
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                Change File
              </Button>
              <Button 
                onClick={uploadStory} 
                disabled={isUploading || !selectedFile}
                className="flex-1 gradient-primary text-primary-foreground"
              >
                {isUploading ? 'Uploading...' : 'Post Story'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Story Viewer Modal */}
      <Dialog open={viewingUserIndex !== null} onOpenChange={(open) => !open && closeStoryViewer()}>
        <DialogContent className="max-w-lg w-full h-[90vh] p-0 bg-black border-0 overflow-hidden">
          {currentUserStories && currentStory && (
            <div className="relative w-full h-full flex flex-col">
              {/* Progress bars */}
              <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
                {currentUserStories.stories.map((_, idx) => (
                  <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-100"
                      style={{ 
                        width: idx < currentStoryIndex 
                          ? '100%' 
                          : idx === currentStoryIndex 
                            ? `${storyProgress}%` 
                            : '0%' 
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Header */}
              <div className="absolute top-6 left-0 right-0 z-20 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border-2 border-white">
                    <AvatarImage src={currentUserStories.profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {currentUserStories.profile.full_name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {currentUserStories.profile.full_name || currentUserStories.profile.username}
                    </p>
                    <p className="text-xs text-white/70">
                      {new Date(currentStory.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={closeStoryViewer}
                  className="p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Story Content */}
              <div className="flex-1 flex items-center justify-center bg-black relative">
                {/* Loading Spinner */}
                {isMediaLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                )}
                
                {currentStory.media_type === 'video' ? (
                  <video
                    ref={videoRef}
                    src={currentStory.media_url}
                    className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${isMediaLoading ? 'opacity-0' : 'opacity-100'}`}
                    autoPlay
                    playsInline
                    onEnded={goToNextStory}
                    onCanPlay={() => setIsMediaLoading(false)}
                    onLoadedData={() => setIsMediaLoading(false)}
                    onTimeUpdate={(e) => {
                      const video = e.currentTarget;
                      const progress = (video.currentTime / video.duration) * 100;
                      setStoryProgress(progress);
                    }}
                  />
                ) : (
                  <img
                    src={currentStory.media_url}
                    alt="Story"
                    className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${isMediaLoading ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setIsMediaLoading(false)}
                  />
                )}
              </div>

              {/* Navigation Areas */}
              <button 
                className="absolute left-0 top-20 bottom-20 w-1/3 z-10"
                onClick={goToPreviousStory}
              />
              <button 
                className="absolute right-0 top-20 bottom-20 w-1/3 z-10"
                onClick={goToNextStory}
              />

              {/* Caption */}
              {currentStory.caption && (
                <div className="absolute bottom-16 left-4 right-4 z-20">
                  <p className="text-sm text-white bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg">
                    {currentStory.caption}
                  </p>
                </div>
              )}

              {/* Viewers (for own stories) */}
              {isOwnStory && (
                <div className="absolute bottom-4 left-4 right-4 z-20">
                  <button
                    onClick={() => setShowViewers(!showViewers)}
                    className="flex items-center gap-2 text-white text-sm bg-black/40 backdrop-blur-sm px-3 py-2 rounded-lg"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{storyViewers.length} viewers</span>
                  </button>
                  
                  {showViewers && storyViewers.length > 0 && (
                    <div className="mt-2 bg-black/60 backdrop-blur-sm rounded-lg p-2 max-h-32 overflow-y-auto">
                      {storyViewers.map((viewer) => (
                        <div key={viewer.id} className="flex items-center gap-2 py-1">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={viewer.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {viewer.full_name?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-white">
                            {viewer.full_name || viewer.username}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Arrows */}
              {viewingUserIndex > 0 && (
                <button 
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60"
                  onClick={goToPreviousStory}
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
              )}
              {(currentStoryIndex < currentUserStories.stories.length - 1 || viewingUserIndex < userStoriesMap.length - 1) && (
                <button 
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60"
                  onClick={goToNextStory}
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoriesCarousel;