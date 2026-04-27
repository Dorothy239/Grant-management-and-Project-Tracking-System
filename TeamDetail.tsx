import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Users, DollarSign, ListTodo, FolderOpen, TrendingUp, Activity,
  Building2, CheckCircle2, Clock, Circle, AlertTriangle, FileText, Download,
  Eye, Edit, User, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SDLC_PHASES } from '@/types/database';
import { formatNaira } from '@/lib/currency';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';

const CHART_COLORS = [
  'hsl(222, 71%, 25%)', 'hsl(38, 95%, 55%)', 'hsl(200, 90%, 45%)',
  'hsl(152, 76%, 36%)', 'hsl(0, 84%, 60%)', 'hsl(280, 60%, 50%)',
];

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingData, setLoadingData] = useState(true);
  const [startup, setStartup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [expenditures, setExpenditures] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [budget, setBudget] = useState<any>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});

  const [isBudgetReviewOpen, setIsBudgetReviewOpen] = useState(false);
  const [budgetAction, setBudgetAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [modifiedAllocations, setModifiedAllocations] = useState<Record<string, string>>({});
  const [modifiedTotal, setModifiedTotal] = useState('');
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
    if (!loading && role !== 'admin') navigate('/dashboard');
    if (user && role === 'admin' && id) fetchAll();
  }, [user, role, loading, id]);

  const fetchAll = async () => {
    if (!id) return;
    try {
      const [startupRes, membersRes, tasksRes, expRes, docsRes, budgetRes, activityRes, profilesRes] = await Promise.all([
        supabase.from('startups').select('*').eq('id', id).single(),
        supabase.from('startup_members').select('*, profiles:user_id(full_name, email)').eq('startup_id', id),
        supabase.from('tasks').select('*').eq('startup_id', id).order('created_at', { ascending: false }),
        supabase.from('expenditures').select('*').eq('startup_id', id).order('created_at', { ascending: false }),
        supabase.from('documents').select('*').eq('startup_id', id).order('created_at', { ascending: false }),
        supabase.from('budgets').select('*').eq('startup_id', id).maybeSingle(),
        supabase.from('activity_log').select('*').eq('startup_id', id).order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('id, full_name'),
      ]);

      setStartup(startupRes.data);
      setMembers(membersRes.data || []);
      setTasks(tasksRes.data || []);
      setExpenditures(expRes.data || []);
      setDocuments(docsRes.data || []);
      setBudget(budgetRes.data);
      setActivityLog(activityRes.data || []);

      const map: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => { map[p.id] = p.full_name || 'Unknown'; });
      setProfileMap(map);

      if (budgetRes.data) {
        const allocs = budgetRes.data.phase_allocations || {};
        setModifiedAllocations(Object.fromEntries(
          SDLC_PHASES.map(p => [p, (allocs[p] || '').toString()])
        ));
        setModifiedTotal(budgetRes.data.total_amount?.toString() || '');
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to load team details', variant: 'destructive' });
    } finally {
      setLoadingData(false);
    }
  };

  const handleBudgetDecision = async (action?: 'approve' | 'reject') => {
    const finalAction = action || budgetAction;
    if (!budget || !finalAction) return;
    setBudgetSubmitting(true);
    try {
      const newAllocations: Record<string, number> = {};
      let newTotal = 0;
      for (const phase of SDLC_PHASES) {
        const val = parseFloat(modifiedAllocations[phase] || '0');
        if (val > 0) { newAllocations[phase] = val; newTotal += val; }
      }

      const updateData: any = {
        status: finalAction === 'approve' ? 'approved' : 'rejected',
        admin_notes: adminNotes || (finalAction === 'approve' ? 'Approved by admin.' : 'Rejected by admin.'),
        approved_by: user?.id,
        approved_at: finalAction === 'approve' ? new Date().toISOString() : null,
      };

      if (finalAction === 'approve' && newTotal > 0) {
        updateData.phase_allocations = newAllocations;
        updateData.total_amount = newTotal;
      }

      const { error } = await supabase.from('budgets').update(updateData).eq('id', budget.id);
      if (error) throw error;

      toast({ title: finalAction === 'approve' ? '✅ Budget Approved' : '❌ Budget Rejected', description: `Budget has been ${finalAction}d.` });
      setIsBudgetReviewOpen(false);
      setAdminNotes('');
      setBudgetAction(null);
      fetchAll();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update budget', variant: 'destructive' });
    } finally { setBudgetSubmitting(false); }
  };

  if (loading || loadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!startup) {
    return <DashboardLayout><Card className="max-w-lg mx-auto mt-12"><CardContent className="pt-6 text-center"><p>Team not found.</p><Button onClick={() => navigate('/admin/startups')} className="mt-4">Back to Teams</Button></CardContent></Card></DashboardLayout>;
  }

  const grantAmount = Number(startup.grant_amount);
  const budgetAmount = budget ? Number(budget.total_amount) : 0;
  const totalSpent = expenditures.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
  const spentPercent = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

  const phaseTaskData = SDLC_PHASES.map(phase => ({
    phase,
    total: tasks.filter((t: any) => t.phase === phase).length,
    completed: tasks.filter((t: any) => t.phase === phase && t.status === 'completed').length,
  })).filter(d => d.total > 0);

  const categorySpendData = Object.entries(
    expenditures.reduce((acc: Record<string, number>, e: any) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const budgetVsSpent = [
    { name: 'Spent', value: totalSpent },
    { name: 'Remaining', value: Math.max(0, budgetAmount - totalSpent) },
  ];

  const burnRateData = (() => {
    if (expenditures.length === 0) return [];
    const startDate = new Date(startup.created_at);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 6);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const dailyMap: Record<string, number> = {};
    expenditures.forEach((e: any) => {
      const d = e.date || e.created_at.split('T')[0];
      dailyMap[d] = (dailyMap[d] || 0) + Number(e.amount);
    });

    const sortedDates = Object.keys(dailyMap).sort();
    let cumulative = 0;
    const points: { day: string; spent: number; projected: number }[] = [];
    sortedDates.forEach(d => {
      cumulative += dailyMap[d];
      const dayNum = Math.ceil((new Date(d).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      points.push({ day: d, spent: cumulative, projected: Math.round((grantAmount / totalDays) * dayNum) });
    });
    return points;
  })();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-accent" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-primary" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
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

  const modifiedTotalCalc = Object.values(modifiedAllocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/startups')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{startup.name}</h1>
            <p className="text-muted-foreground">{startup.description || 'No description'}</p>
          </div>
          <Badge variant={startup.is_active ? 'default' : 'outline'}>{startup.is_active ? 'Active' : 'Inactive'}</Badge>
        </div>

        {/* Budget Pending Banner */}
        {budget && budget.status === 'pending' && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-medium">Budget Pending Review</p>
                  <p className="text-sm text-muted-foreground">This team has submitted a budget of {formatNaira(budgetAmount)} for your review.</p>
                </div>
              </div>
              <Button onClick={() => { setIsBudgetReviewOpen(true); setBudgetAction(null); }}>
                <Eye className="mr-2 h-4 w-4" />Review Budget
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div><p className="text-sm text-muted-foreground">Members</p><p className="text-2xl font-bold">{members.length}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-accent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-accent" />
                <div>
                  <p className="text-sm text-muted-foreground">Budget / Grant</p>
                  <p className="text-2xl font-bold">{formatNaira(totalSpent)} <span className="text-sm text-muted-foreground font-normal">/ {formatNaira(grantAmount)}</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-info">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <ListTodo className="h-5 w-5 text-info" />
                  <span className="text-2xl font-bold">{progressPercent.toFixed(0)}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">{completedTasks}/{tasks.length} tasks completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-warning">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-8 w-8 text-warning" />
                <div><p className="text-sm text-muted-foreground">Documents</p><p className="text-2xl font-bold">{documents.length}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
            <TabsTrigger value="expenses">Expenses ({expenditures.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Budget Chart */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div><CardTitle>Budget Usage</CardTitle><CardDescription>
                      {budget ? <Badge variant={budget.status === 'approved' ? 'default' : budget.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{budget.status}</Badge> : 'No budget submitted'}
                    </CardDescription></div>
                    {budget && (
                      <Button variant="outline" size="sm" onClick={() => { setIsBudgetReviewOpen(true); setBudgetAction(null); }}>
                        <Edit className="mr-1 h-3 w-3" />Review
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {budgetAmount > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={budgetVsSpent} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                            <Cell fill="hsl(38, 95%, 55%)" />
                            <Cell fill="hsl(220, 25%, 94%)" />
                          </Pie>
                          <Tooltip formatter={(value: number) => formatNaira(value)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{spentPercent.toFixed(1)}% used</p>
                        <p className="text-sm text-muted-foreground">{formatNaira(totalSpent)} of {formatNaira(budgetAmount)}</p>
                      </div>
                    </div>
                  ) : <p className="text-center text-muted-foreground py-8">No budget data available</p>}
                </CardContent>
              </Card>

              {/* Spending by Category */}
              <Card>
                <CardHeader><CardTitle>Spending by Category</CardTitle></CardHeader>
                <CardContent>
                  {categorySpendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={categorySpendData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {categorySpendData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatNaira(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-muted-foreground py-8">No expenses recorded</p>}
                </CardContent>
              </Card>

              {/* Burn Rate */}
              {burnRateData.length > 1 && (
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle>Grant Spending vs Time</CardTitle><CardDescription>Actual burn rate vs projected linear spending</CardDescription></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={burnRateData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" tickFormatter={(d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                        <YAxis tickFormatter={(v) => `${formatNaira(v / 1000)}k`} />
                        <Tooltip formatter={(v: number) => formatNaira(v)} />
                        <Legend />
                        <Line type="monotone" dataKey="spent" name="Actual Spent" stroke="hsl(38, 95%, 55%)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="projected" name="Projected" stroke="hsl(222, 71%, 25%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Task Progress by Phase */}
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Task Progress by SDLC Phase</CardTitle></CardHeader>
                <CardContent>
                  {phaseTaskData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={phaseTaskData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="phase" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name="Total" fill="hsl(222, 71%, 25%)" />
                        <Bar dataKey="completed" name="Completed" fill="hsl(152, 76%, 36%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-muted-foreground py-8">No tasks created yet</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Budget Tab */}
          <TabsContent value="budget">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Budget Details</CardTitle>
                    {budget && (
                      <Badge variant={budget.status === 'approved' ? 'default' : budget.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{budget.status}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!budget ? (
                    <p className="text-center text-muted-foreground py-8">No budget submitted yet</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Total Amount</span>
                        <span className="text-xl font-bold">{formatNaira(budgetAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Grant Amount</span>
                        <span className="text-xl font-bold">{formatNaira(grantAmount)}</span>
                      </div>
                      {budget.submitted_by && (
                        <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                          <span className="text-sm text-muted-foreground">Submitted By</span>
                          <span className="text-sm font-medium">{profileMap[budget.submitted_by] || 'Unknown'}</span>
                        </div>
                      )}
                      {budget.admin_notes && (
                        <div className="p-3 bg-secondary/50 rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">Admin Notes</p>
                          <p className="text-sm">{budget.admin_notes}</p>
                        </div>
                      )}
                      {budget.phase_allocations && Object.keys(budget.phase_allocations).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Phase Allocations</p>
                          {Object.entries(budget.phase_allocations as Record<string, number>).map(([phase, amount]) => (
                            <div key={phase} className="flex items-center justify-between text-sm p-2 border rounded">
                              <span>{phase}</span>
                              <span className="font-semibold">{formatNaira(Number(amount))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button className="w-full" onClick={() => { setIsBudgetReviewOpen(true); setBudgetAction(null); }}>
                        <Edit className="mr-2 h-4 w-4" />{budget.status === 'pending' ? 'Review & Decide' : 'Modify Budget'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Budget vs Spending</CardTitle></CardHeader>
                <CardContent>
                  {budgetAmount > 0 ? (
                    <div className="space-y-6">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={budgetVsSpent} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                            <Cell fill="hsl(38, 95%, 55%)" /><Cell fill="hsl(220, 25%, 94%)" />
                          </Pie>
                          <Tooltip formatter={(v: number) => formatNaira(v)} /><Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="text-center">
                        <p className="text-lg font-bold">{spentPercent.toFixed(1)}% spent</p>
                        <p className="text-sm text-muted-foreground">{formatNaira(Math.max(0, budgetAmount - totalSpent))} remaining</p>
                      </div>
                    </div>
                  ) : <p className="text-center text-muted-foreground py-8">No budget data</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {members.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {(m.profiles?.full_name || '?')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{m.profiles?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{m.profiles?.email || ''}</p>
                        </div>
                      </div>
                      <Badge variant={m.role === 'leader' ? 'default' : 'secondary'} className="capitalize">{m.role}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <Card>
              <CardContent className="pt-6">
                {tasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No tasks created yet</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                        {getStatusIcon(t.status)}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${t.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">{t.phase}</Badge>
                            <Badge variant="outline" className={`text-xs ${getPriorityColor(t.priority)}`}>{t.priority}</Badge>
                            {t.assigned_to && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" /> {profileMap[t.assigned_to] || 'Unassigned'}
                              </span>
                            )}
                            {t.created_by && (
                              <span className="text-xs text-muted-foreground">Created by: {profileMap[t.created_by] || 'Unknown'}</span>
                            )}
                          </div>
                        </div>
                        <Badge variant={t.status === 'completed' ? 'default' : 'outline'} className="capitalize text-xs">{t.status.replace('_', ' ')}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardContent className="pt-6">
                {expenditures.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No expenses recorded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Phase</TableHead>
                        <TableHead>Amount</TableHead><TableHead>Recorded By</TableHead><TableHead>Evidence</TableHead><TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenditures.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.title}</TableCell>
                          <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                          <TableCell>{e.phase || '\u2014'}</TableCell>
                          <TableCell className="font-semibold">{formatNaira(Number(e.amount))}</TableCell>
                          <TableCell className="text-muted-foreground">{profileMap[e.created_by] || 'Unknown'}</TableCell>
                          <TableCell>
                            {e.receipt_url ? (
                              <Button variant="ghost" size="sm" onClick={() => window.open(e.receipt_url, '_blank')}>
                                <Eye className="h-3 w-3 mr-1" />View
                              </Button>
                            ) : <span className="text-muted-foreground text-xs">None</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{new Date(e.date).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardContent className="pt-6">
                {documents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No documents uploaded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Size</TableHead>
                        <TableHead>Uploaded By</TableHead><TableHead>Date</TableHead><TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.name}</TableCell>
                          <TableCell><Badge variant="outline">{d.file_type.split('/')[1] || 'file'}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{formatFileSize(d.file_size)}</TableCell>
                          <TableCell className="text-muted-foreground">{profileMap[d.uploaded_by] || 'Unknown'}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => window.open(d.file_url, '_blank')}><Download className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader><CardTitle>Activity Log</CardTitle><CardDescription>Who did what and when</CardDescription></CardHeader>
              <CardContent>
                {activityLog.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No activity recorded yet</p>
                ) : (
                  <div className="space-y-3">
                    {activityLog.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 border-l-2 border-primary/30 bg-secondary/20 rounded-r-lg">
                        <Activity className="h-4 w-4 mt-1 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{profileMap[log.user_id] || 'Unknown'}</span>
                            {' '}{log.action}{' '}
                            <span className="text-muted-foreground">({log.entity_type})</span>
                          </p>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {log.details.title || log.details.name || JSON.stringify(log.details)}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Budget Review Dialog */}
        <Dialog open={isBudgetReviewOpen} onOpenChange={setIsBudgetReviewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Budget</DialogTitle>
              <DialogDescription>
                Review the phase-by-phase budget. You can modify allocations before approving or reject with notes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
              {SDLC_PHASES.map(phase => (
                <div key={phase} className="flex items-center gap-4">
                  <Label className="w-32 text-sm shrink-0">{phase}</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{'\u20A6'}</span>
                    <Input
                      type="number" step="0.01" placeholder="0.00" className="pl-7"
                      value={modifiedAllocations[phase] || ''}
                      onChange={(e) => setModifiedAllocations(prev => ({ ...prev, [phase]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className={`text-lg font-bold ${modifiedTotalCalc > grantAmount ? 'text-destructive' : 'text-foreground'}`}>
                  {formatNaira(modifiedTotalCalc)}
                </span>
              </div>
              {modifiedTotalCalc > grantAmount && (
                <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Exceeds grant of {formatNaira(grantAmount)}</p>
              )}
              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea placeholder="Notes for the team..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setIsBudgetReviewOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleBudgetDecision('reject')} disabled={budgetSubmitting}>
                Reject
              </Button>
              <Button onClick={() => handleBudgetDecision('approve')} disabled={budgetSubmitting || modifiedTotalCalc > grantAmount}>
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
