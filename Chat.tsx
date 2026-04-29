import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStartup } from '@/hooks/useStartup';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import {
  format,
  isToday,
  isYesterday,
  differenceInCalendarDays,
  startOfDay,
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export default function Chat() {
  const { user, loading } = useAuth();
  const { startup, loading: startupLoading } = useStartup();
  const { markAsRead } = useUnreadMessages();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect
  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  // Fetch + subscribe
  useEffect(() => {
    if (!startup) {
      if (!startupLoading) setLoadingMessages(false);
      return;
    }

    let isMounted = true;

    fetchMessages(isMounted);
    fetchProfiles(isMounted);

    const channel = supabase
      .channel(`messages-${startup.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `startup_id=eq.${startup.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [startup, startupLoading]);

  // Auto scroll + mark read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    markAsRead();
  }, [messages, markAsRead]);

  const fetchProfiles = async (isMounted = true) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name');

      if (error) throw error;

      if (!isMounted) return;

      const map: Record<string, string> = {};
      data?.forEach((p) => {
        map[p.id] = p.full_name || 'Unknown';
      });

      setProfileMap(map);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (isMounted = true) => {
    if (!startup) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('startup_id', startup.id)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      if (!isMounted) return;

      setMessages(data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      if (isMounted) setLoadingMessages(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !startup || !newMessage.trim() || sending) return;

    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert({
        startup_id: startup.id,
        user_id: user.id,
        content: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage('');
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const getDateLabel = (date: Date): string => {
    const now = new Date();

    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';

    const diff = differenceInCalendarDays(now, date);

    if (diff < 7) return format(date, 'EEEE');

    return format(date, 'd MMM yyyy');
  };

  if (loading || startupLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Team Chat</h1>
            <p className="text-muted-foreground">
              {startup?.name} — Real-time messaging
            </p>
          </div>
          <MessageCircle className="h-8 w-8 text-primary" />
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMessages ? (
              <div className="flex justify-center h-full">
                <Loader2 className="animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground">
                No messages yet
              </div>
            ) : (
              messages.map((msg, i) => {
                const isOwn = msg.user_id === user?.id;
                const name = profileMap[msg.user_id] || 'Unknown';

                const msgDate = new Date(msg.created_at);
                const prevDate =
                  i > 0 ? new Date(messages[i - 1].created_at) : null;

                const showDate =
                  !prevDate ||
                  startOfDay(msgDate).getTime() !==
                    startOfDay(prevDate).getTime();

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="text-center text-xs text-muted-foreground my-2">
                        {getDateLabel(msgDate)}
                      </div>
                    )}

                    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <p className="text-xs text-muted-foreground">
                          {isOwn ? 'You' : name}
                        </p>

                        <div className="bg-secondary px-3 py-2 rounded-xl">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            }

            <div ref={messagesEndRef} />
          </CardContent>

          <div className="border-t p-3">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
              />
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
