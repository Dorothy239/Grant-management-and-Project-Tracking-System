import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStartup } from '@/hooks/useStartup';
import { useActivityLog } from '@/hooks/useActivityLog';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CalendarRange, Plus, Loader2, AlertTriangle, User, CheckCircle2, Clock, Circle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCustomPhases } from '@/hooks/useCustomPhases';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Milestone {
  id: string;
  startup_id: string;
  title: string;
  phase: string;
  assigned_to: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export default function Timeline() {
  const { user, loading } = useAuth();
  const { startup, members, loading: startupLoading } = useStartup();
  const { logActivity } = useActivityLog();
  const { phases: dynamicPhases } = useCustomPhases(startup?.id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: '', phase: 'Development', assigned_to: '', start_date: '', end_date: '',
  });

  useEffect(() => { if (!loading && !user) navigate('/auth'); }, [user, loading]);
  useEffect(() => {
    if (startup) { fetchTasks(); fetchProfiles(); }
    else if (!startupLoading) setLoadingData(false);
  }, [startup, startupLoading]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    const map: Record<string, string> = {};
    (data || []).forEach((p: any) => { map[p.id] = p.full_name || 'Unknown'; });
    setProfileMap(map);
  };

  const fetchTasks = async () => {
    if (!startup) return;
    try {
      const { data, error } = await supabase.from('tasks').select('*').eq('startup_id', startup.id).order('created_at', { ascending: true });
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error(error);
    } finally { setLoadingData(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startup) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('tasks').insert({
        startup_id: startup.id,
        title: form.title,
        phase: form.phase,
        assigned_to: form.assigned_to || null,
        due_date: form.end_date || null,
        status: 'todo',
        priority: 'medium',
        created_by: user.id,
        description: `Timeline: ${form.start_date} → ${form.end_date}`,
      }).select().single();
      if (error) throw error;
      toast({ title: 'Milestone Added', description: 'Added to project timeline' });
      await logActivity(startup.id, 'added timeline milestone', 'task', data.id, { title: form.title, phase: form.phase });
      setIsAddOpen(false);
      setForm({ title: '', phase: 'Development', assigned_to: '', start_date: '', end_date: '' });
      fetchTasks();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to add milestone', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  if (startupLoading || loadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!startup && !startupLoading && !loadingData) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg mx-auto mt-12">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
            <h2 className="text-xl font-semibold">No Team Assigned</h2>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Gantt chart calculations
  const tasksWithDates = tasks.filter(t => t.due_date);
  const allDates = tasksWithDates.flatMap(t => {
    const desc = t.description || '';
    const match = desc.match(/Timeline:\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})/);
    if (match) return [new Date(match[1]), new Date(match[2])];
    return [new Date(t.due_date)];
  });

  // Add startup creation date and 6 months out
  if (startup) {
    allDates.push(new Date(startup.created_at));
    const end = new Date(startup.created_at);
    end.setMonth(end.getMonth() + 6);
    allDates.push(end);
  }

  const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
  const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Generate month headers
  const months: { label: string; startPx: number; widthPx: number }[] = [];
  const pxPerDay = 6;
  const totalWidth = totalDays * pxPerDay;

  let currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (currentMonth <= maxDate) {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const startDay = Math.max(0, Math.ceil((currentMonth.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
    const endDay = Math.min(totalDays, Math.ceil((nextMonth.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
    months.push({
      label: currentMonth.toLocaleDateString('en', { month: 'short', year: 'numeric' }),
      startPx: startDay * pxPerDay,
      widthPx: (endDay - startDay) * pxPerDay,
    });
    currentMonth = nextMonth;
  }

  // Group tasks by phase for the Gantt chart
  const phaseGroups = dynamicPhases.map(phase => ({
    phase,
    tasks: tasks.filter(t => t.phase === phase),
  })).filter(g => g.tasks.length > 0);

  const getTaskBar = (task: any) => {
    const desc = task.description || '';
    const match = desc.match(/Timeline:\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})/);
    let start: Date, end: Date;
    if (match) {
      start = new Date(match[1]);
      end = new Date(match[2]);
    } else if (task.due_date) {
      end = new Date(task.due_date);
      start = new Date(end);
      start.setDate(start.getDate() - 7); // default 1 week
    } else {
      return null;
    }
    const startDay = Math.max(0, Math.ceil((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
    const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { left: startDay * pxPerDay, width: duration * pxPerDay };
  };

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      'Requirements': 'hsl(200, 90%, 45%)',
      'Design': 'hsl(38, 95%, 55%)',
      'Development': 'hsl(222, 71%, 25%)',
      'Testing': 'hsl(38, 92%, 50%)',
      'Deployment': 'hsl(152, 76%, 36%)',
      'Maintenance': 'hsl(220, 15%, 45%)',
    };
    return colors[phase] || 'hsl(222, 71%, 25%)';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-3 w-3 text-accent" />;
      case 'in_progress': return <Clock className="h-3 w-3 text-primary" />;
      default: return <Circle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  // Today line
  const todayOffset = Math.ceil((new Date().getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * pxPerDay;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Project Timeline</h1>
            <p className="text-muted-foreground">Gantt chart view — plan phases and assign responsibilities</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />Add Milestone</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Timeline Milestone</DialogTitle><DialogDescription>Plan a task with start and end dates</DialogDescription></DialogHeader>
              <form onSubmit={handleAdd}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label>Title</Label><Input placeholder="Milestone title" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phase</Label>
                      <Input
                        placeholder="Type or pick a phase"
                        value={form.phase}
                        onChange={(e) => setForm(p => ({ ...p, phase: e.target.value }))}
                        list="timeline-phase-suggestions"
                        required
                      />
                      <datalist id="timeline-phase-suggestions">
                        {dynamicPhases.map(p => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label>Responsible</Label>
                      <Select value={form.assigned_to} onValueChange={(v) => setForm(p => ({ ...p, assigned_to: v }))}>
                        <SelectTrigger><SelectValue placeholder="Assign" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {members.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.full_name || 'Unknown'}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm(p => ({ ...p, start_date: e.target.value }))} required /></div>
                    <div className="space-y-2"><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm(p => ({ ...p, end_date: e.target.value }))} required /></div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting || !form.title}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Phase Legend */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              {dynamicPhases.map(phase => (
                <div key={phase} className="flex items-center gap-2">
                  <div className="h-3 w-8 rounded-sm" style={{ backgroundColor: getPhaseColor(phase) }} />
                  <span className="text-sm">{phase}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gantt Chart */}
        <Card>
          <CardHeader><CardTitle>Gantt Chart</CardTitle><CardDescription>{tasks.length} tasks across {phaseGroups.length} phases</CardDescription></CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <CalendarRange className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tasks yet. Add milestones to build your timeline.</p>
              </div>
            ) : (
              <ScrollArea className="w-full">
                <div style={{ minWidth: Math.max(totalWidth + 250, 800) }}>
                  {/* Month headers */}
                  <div className="flex border-b mb-2" style={{ marginLeft: 200 }}>
                    {months.map((m, i) => (
                      <div key={i} className="text-xs text-muted-foreground border-l px-1 py-1 shrink-0" style={{ width: m.widthPx, minWidth: 30 }}>
                        {m.widthPx > 40 ? m.label : ''}
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  {phaseGroups.map(group => (
                    <div key={group.phase}>
                      <div className="flex items-center gap-2 py-1 px-2 bg-secondary/30 rounded mb-1">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getPhaseColor(group.phase) }} />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.phase}</span>
                      </div>
                      {group.tasks.map(task => {
                        const bar = getTaskBar(task);
                        return (
                          <div key={task.id} className="flex items-center h-10 hover:bg-secondary/20 rounded">
                            <div className="w-[200px] shrink-0 px-2 flex items-center gap-2 overflow-hidden">
                              {getStatusIcon(task.status)}
                              <span className="text-xs truncate">{task.title}</span>
                              {task.assigned_to && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                                  <User className="h-2.5 w-2.5" />{profileMap[task.assigned_to]?.split(' ')[0] || '?'}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 relative h-full">
                              {bar && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="absolute top-2 h-6 rounded-md opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                                      style={{
                                        left: bar.left,
                                        width: Math.max(bar.width, 8),
                                        backgroundColor: getPhaseColor(task.phase),
                                      }}
                                    >
                                      <span className="text-[10px] text-white px-1 truncate block leading-6">{task.title}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{task.title}</p>
                                    <p className="text-xs">{task.phase} • {task.status.replace('_', ' ')}</p>
                                    {task.assigned_to && <p className="text-xs">Assigned: {profileMap[task.assigned_to] || 'Unknown'}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {/* Today line */}
                              {todayOffset > 0 && todayOffset < totalWidth && (
                                <div className="absolute top-0 bottom-0 w-px bg-destructive/50" style={{ left: todayOffset }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Responsibility Matrix */}
        <Card>
          <CardHeader><CardTitle>Phase Responsibilities</CardTitle><CardDescription>Who is responsible for what</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dynamicPhases.map(phase => {
                const phaseTasks = tasks.filter(t => t.phase === phase);
                if (phaseTasks.length === 0) return null;
                const assignees = [...new Set(phaseTasks.filter(t => t.assigned_to).map(t => t.assigned_to))];
                return (
                  <div key={phase} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getPhaseColor(phase) }} />
                        <span className="font-medium">{phase}</span>
                      </div>
                      <Badge variant="outline">{phaseTasks.length} task{phaseTasks.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    {assignees.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {assignees.map(id => (
                          <Badge key={id} variant="secondary" className="text-xs">
                            <User className="h-3 w-3 mr-1" />{profileMap[id] || 'Unknown'}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No members assigned</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
