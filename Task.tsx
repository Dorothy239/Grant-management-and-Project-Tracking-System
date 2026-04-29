import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStartup } from '@/hooks/useStartup';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useCustomPhases } from '@/hooks/useCustomPhases';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ListTodo, Plus, Loader2, Clock, CheckCircle2, Circle, Trash2, AlertTriangle,
  ArrowUp, ArrowDown, Minus, AlertCircle, User, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Task, TaskPriority } from '@/types/database';

export default function Tasks() {
  const { user, loading } = useAuth();
  const { startup, members, loading: startupLoading } = useStartup();
  const { logActivity } = useActivityLog();
  const { phases, refetchPhases } = useCustomPhases(startup?.id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [dismissedDeadlines, setDismissedDeadlines] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    title: '', description: '', phase: '', due_date: '', priority: 'medium' as TaskPriority, assigned_to: '',
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
      const { data, error } = await supabase.from('tasks').select('*').eq('startup_id', startup.id).order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load tasks', variant: 'destructive' });
    } finally { setLoadingData(false); }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startup || !form.phase.trim()) return;
    setSubmitting(true);
    try {
      const assignedTo = form.assigned_to && form.assigned_to !== 'none' ? form.assigned_to : null;
      const { data, error } = await supabase.from('tasks').insert({
        startup_id: startup.id, title: form.title, description: form.description || null,
        phase: form.phase.trim(), status: 'todo', priority: form.priority,
        due_date: form.due_date || null, created_by: user.id,
        assigned_to: assignedTo,
      }).select().single();
      if (error) throw error;
      toast({ title: 'Task Created', description: 'New task added to your project' });
      await logActivity(startup.id, 'created task', 'task', data.id, { title: form.title, phase: form.phase, priority: form.priority });

      if (assignedTo && assignedTo !== user.id) {
        try {
          await supabase.from('notifications').insert({
            user_id: assignedTo,
            title: 'New Task Assigned',
            message: `You have been assigned to task: "${form.title}" (${form.priority} priority)`,
            type: 'task_assignment',
            related_id: data.id,
            startup_id: startup.id,
          });
        } catch (e) { console.error('Failed to send notification:', e); }
      }

      setIsAddOpen(false);
      setForm({ title: '', description: '', phase: '', due_date: '', priority: 'medium', assigned_to: '' });
      fetchTasks();
      refetchPhases();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to create task', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
      if (error) throw error;
      if (startup) {
        const task = tasks.find(t => t.id === taskId);
        await logActivity(startup.id, `marked task as ${status.replace('_', ' ')}`, 'task', taskId, { title: task?.title });
      }
      fetchTasks();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Task removed' });
      if (startup) await logActivity(startup.id, 'deleted task', 'task', taskId, { title: task?.title });
      fetchTasks();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'destructive' });
    }
  };

  // Deadline warnings: tasks due within 2 days that aren't completed
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    return tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false;
      if (dismissedDeadlines.has(t.id)) return false;
      const due = new Date(t.due_date);
      return due <= twoDaysLater;
    });
  }, [tasks, dismissedDeadlines]);

  const dismissDeadline = (taskId: string) => {
    setDismissedDeadlines(prev => new Set(prev).add(taskId));
  };

  // Unique phases from tasks for filter dropdown
  const taskPhases = useMemo(() => {
    return [...new Set(tasks.map(t => t.phase).filter(Boolean))];
  }, [tasks]);

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
            <p className="text-muted-foreground">You need to join a team before you can create tasks.</p>
            <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const filteredTasks = tasks.filter(t => {
    const matchesPhase = phaseFilter === 'all' || t.phase === phaseFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesPhase && matchesStatus && matchesPriority;
  });

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'high': return <ArrowUp className="h-4 w-4 text-warning" />;
      case 'low': return <ArrowDown className="h-4 w-4 text-muted-foreground" />;
      default: return <Minus className="h-4 w-4 text-primary" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high': return 'bg-warning/10 text-warning-foreground border-warning/20';
      case 'medium': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      'Requirements': 'bg-info/10 text-info border-info/20',
      'Design': 'bg-accent/10 text-accent-foreground border-accent/20',
      'Development': 'bg-primary/10 text-primary border-primary/20',
      'Testing': 'bg-warning/10 text-warning-foreground border-warning/20',
      'Deployment': 'bg-success/10 text-success border-success/20',
      'Maintenance': 'bg-muted text-muted-foreground border-border',
    };
    return colors[phase] || 'bg-secondary text-secondary-foreground border-border';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-accent" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-primary" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedTasks = [...filteredTasks].sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

  const getDeadlineLabel = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffMs < 0) return 'Overdue!';
    if (diffHours < 24) return `Due in ${Math.max(0, diffHours)} hour${diffHours !== 1 ? 's' : ''}`;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Project Tasks</h1>
            <p className="text-muted-foreground">Manage tasks organized by custom phases with priorities</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />Add Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Task</DialogTitle><DialogDescription>Add a task to your project</DialogDescription></DialogHeader>
              <form onSubmit={handleAddTask}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label>Title</Label><Input placeholder="Task title" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Phase</Label>
                      <Input
                        placeholder="Type or pick a phase"
                        value={form.phase}
                        onChange={(e) => setForm(p => ({ ...p, phase: e.target.value }))}
                        list="phase-suggestions"
                        required
                      />
                      <datalist id="phase-suggestions">
                        {phases.map(p => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm(p => ({ ...p, priority: v as TaskPriority }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">{'\uD83D\uDFE2'} Low</SelectItem>
                          <SelectItem value="medium">{'\uD83D\uDD35'} Medium</SelectItem>
                          <SelectItem value="high">{'\uD83D\uDFE0'} High</SelectItem>
                          <SelectItem value="critical">{'\uD83D\uDD34'} Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
                    <div className="space-y-2">
                      <Label>Assign To</Label>
                      <Select value={form.assigned_to} onValueChange={(v) => setForm(p => ({ ...p, assigned_to: v }))}>
                        <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {members.map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.full_name || 'Unknown'}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Describe the task" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting || !form.title || !form.phase.trim()}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Deadline Warnings */}
        {upcomingDeadlines.length > 0 && (
          <div className="space-y-2">
            {upcomingDeadlines.map(task => (
              <Alert key={task.id} variant="destructive" className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <div>
                    <AlertTitle className="text-sm font-semibold mb-0">
                      {getDeadlineLabel(task.due_date!)} — {task.title}
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      {task.assigned_to ? `Assigned to: ${profileMap[task.assigned_to] || 'Unknown'}` : 'Unassigned'} · Phase: {task.phase}
                    </AlertDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => dismissDeadline(task.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </Alert>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-muted"><CardContent className="pt-6 flex items-center gap-3"><Circle className="h-6 w-6 text-muted-foreground" /><div><p className="text-2xl font-bold">{todoCount}</p><p className="text-sm text-muted-foreground">To Do</p></div></CardContent></Card>
          <Card className="border-l-4 border-l-primary"><CardContent className="pt-6 flex items-center gap-3"><Clock className="h-6 w-6 text-primary" /><div><p className="text-2xl font-bold">{inProgressCount}</p><p className="text-sm text-muted-foreground">In Progress</p></div></CardContent></Card>
          <Card className="border-l-4 border-l-accent"><CardContent className="pt-6 flex items-center gap-3"><CheckCircle2 className="h-6 w-6 text-accent" /><div><p className="text-2xl font-bold">{completedCount}</p><p className="text-sm text-muted-foreground">Completed</p></div></CardContent></Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Phase" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {taskPhases.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">{'\uD83D\uDD34'} Critical</SelectItem>
                  <SelectItem value="high">{'\uD83D\uDFE0'} High</SelectItem>
                  <SelectItem value="medium">{'\uD83D\uDD35'} Medium</SelectItem>
                  <SelectItem value="low">{'\uD83D\uDFE2'} Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Task List */}
        {sortedTasks.length === 0 ? (
          <Card><CardContent className="pt-6 text-center py-12"><ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No tasks found.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {sortedTasks.map(task => (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'completed')}
                        className="mt-0.5"
                        disabled={!!task.assigned_to && task.assigned_to !== user?.id}
                        title={!!task.assigned_to && task.assigned_to !== user?.id ? 'Only the assigned user can change status' : 'Click to change status'}
                      >
                        {getStatusIcon(task.status)}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(task.priority)}
                          <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                        </div>
                        {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className={getPhaseColor(task.phase)} variant="outline">{task.phase}</Badge>
                          <Badge className={getPriorityColor(task.priority)} variant="outline">{task.priority}</Badge>
                          <Badge variant={task.status === 'completed' ? 'default' : task.status === 'in_progress' ? 'secondary' : 'outline'} className="capitalize text-xs">{task.status.replace('_', ' ')}</Badge>
                          {task.assigned_to && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> {profileMap[task.assigned_to] || 'Unassigned'}
                            </span>
                          )}
                          {task.created_by && (
                            <span className="text-xs text-muted-foreground">
                              Created by: {profileMap[task.created_by] || 'Unknown'}
                            </span>
                          )}
                          {task.due_date && <span className="text-xs text-muted-foreground">Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {(!task.assigned_to || task.assigned_to === user?.id) ? (
                        <Select value={task.status} onValueChange={(v) => updateTaskStatus(task.id, v)}>
                          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="h-8 text-xs capitalize">{task.status.replace('_', ' ')}</Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteTask(task.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
