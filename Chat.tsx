import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStartup } from '@/hooks/useStartup';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { format, isToday, isYesterday, differenceInCalendarDays, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string | null } | null;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading]);

  useEffect(() => {
    if (startup) {
      fetchMessages();
      fetchProfiles();
      // Subscribe to realtime messages
      const channel = supabase
        .channel(`messages-${startup.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `startup_id=eq.${startup.id}`,
        }, (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages(prev => [...prev, msg]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    } else if (!startupLoading) {
      setLoadingMessages(false);
    }
  }, [startup, startupLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Mark as read whenever messages update and component is mounted
    markAsRead();
  }, [messages]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.id] = p.full_name || 'Unknown'; });
      setProfileMap(map);
    }
  };

  const fetchMessages = async () => {
    if (!startup) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('startup_id', startup.id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startup || !newMessage.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        startup_id: startup.id,
        user_id: user.id,
        content: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (!startup && !startupLoading && !loadingMessages) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg mx-auto mt-12">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
            <h2 className="text-xl font-semibold">No Team Assigned</h2>
            <p className="text-muted-foreground">Join a team to access team chat.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getDateLabel = (date: Date): string => {
    const now = new Date();
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    const daysDiff = differenceInCalendarDays(now, date);
    if (daysDiff < 7) return format(date, 'EEEE'); // e.g. "Wednesday"
    return format(date, 'd MMMM yyyy'); // e.g. "12 February 2026"
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-12rem)] animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Chat</h1>
            <p className="text-muted-foreground">{startup?.name} — Real-time messaging</p>
          </div>
          <MessageCircle className="h-8 w-8 text-primary" />
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center space-y-2">
                  <MessageCircle className="h-12 w-12 mx-auto opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOwn = msg.user_id === user?.id;
                const name = profileMap[msg.user_id] || 'Unknown';
                const msgDate = new Date(msg.created_at);
                const prevDate = index > 0 ? new Date(messages[index - 1].created_at) : null;
                const showDateSep = !prevDate || startOfDay(msgDate).getTime() !== startOfDay(prevDate).getTime();

                return (
                  <div key={msg.id}>
                    {showDateSep && (
                      <div className="flex items-center justify-center my-4">
                        <div className="bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full">
                          {getDateLabel(msgDate)}
                        </div>
                      </div>
                    )}
                    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={`text-xs ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                        <p className={`text-xs mb-1 ${isOwn ? 'text-right' : ''} text-muted-foreground`}>
                          {isOwn ? 'You' : name}
                        </p>
                        <div className={`rounded-2xl px-4 py-2 ${isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-secondary-foreground rounded-tl-sm'}`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <p className={`text-[10px] mt-1 ${isOwn ? 'text-right' : ''} text-muted-foreground`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="border-t p-4">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1"
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
