import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStartup } from '@/hooks/useStartup';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ListTodo, DollarSign, FolderOpen, TrendingUp, Clock, CheckCircle2, AlertCircle,
  ArrowRight, Users, Building2, KeyRound, Loader2, AlertTriangle, MessageCircle, CalendarRange,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { SDLC_PHASES } from '@/types/database';
import { formatNaira } from '@/lib/currency';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';

export default function StudentDashboard() {
  const { user, role, loading } = useAuth();
  const { startup, membership, budget, members, loading: startupLoading, refetch } = useStartup();
  const { logActivity } = useActivityLog();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, inProgress: 0 });
  const [totalSpent, setTotalSpent] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [expendituresByCategory, setExpendituresByCategory] = useState<{ name: string; value: number }[]>([]);
  const [burnRateData, setBurnRateData] = useState<{ day: string; spent: number; projected: number }[]>([]);

  const [phaseAllocations, setPhaseAllocations] = useState<Record<string, string>>(
    Object.fromEntries(SDLC_PHASES.map(p => [p, '']))
  );

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
    if (!loading && role === 'admin') navigate('/admin');
  }, [user, role, loading, navigate]);

  useEffect(() => { if (startup) fetchStats(); }, [startup]);

  const fetchStats = async () => {
    if (!startup) return;
    const [tasksRes, expRes, docsRes] = await Promise.all([
      supabase.from('tasks').select('status').eq('startup_id', startup.id),
      supabase.from('expenditures').select('amount, category, date, created_at').eq('startup_id', startup.id).order('date', { ascending: true }),
      supabase.from('documents').select('id').eq('startup_id', startup.id),
    ]);
    const tasks = tasksRes.data || [];
    const exps = expRes.data || [];
    setTaskStats({ total: tasks.length, completed: tasks.filter(t => t.status === 'completed').length, inProgress: tasks.filter(t => t.status === 'in_progress').length });
    const spent = exps.reduce((s, e) => s + Number(e.amount), 0);
    setTotalSpent(spent);
    setDocCount((docsRes.data || []).length);

    const catMap: Record<string, number> = {};
    exps.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
    setExpendituresByCategory(Object.entries(catMap).map(([name, value]) => ({ name, value })));

    if (exps.length > 0) {
      const startDate = new Date(startup.created_at);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 6);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const grantAmt = Number(startup.grant_amount);

      const dailyMap: Record<string, number> = {};
      exps.forEach(e => {
        const d = e.date || e.created_at.split('T')[0];
        dailyMap[d] = (dailyMap[d] || 0) + Number(e.amount);
      });

      const sortedDates = Object.keys(dailyMap).sort();
      let cumulative = 0;
      const dataPoints: { day: string; spent: number; projected: number }[] = [];

      const startStr = startDate.toISOString().split('T')[0];
      if (!sortedDates.includes(startStr)) {
        dataPoints.push({ day: startStr, spent: 0, projected: 0 });
      }

      sortedDates.forEach(d => {
        cumulative += dailyMap[d];
        const dayNum = Math.ceil((new Date(d).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const projected = (grantAmt / totalDays) * dayNum;
        dataPoints.push({ day: d, spent: cumulative, projected: Math.round(projected) });
      });

      const endStr = endDate.toISOString().split('T')[0];
      dataPoints.push({ day: endStr, spent: cumulative, projected: grantAmt });

      setBurnRateData(dataPoints);
    }
  };

  const handleJoinTeam = async () => {
    if (!user || !inviteCode.trim()) return;
    setJoining(true);
    try {
      const { data: startupData, error: lookupError } = await supabase
        .from('startups').select('id, name').eq('invite_code', inviteCode.trim().toUpperCase()).maybeSingle();
      if (lookupError) throw lookupError;
      if (!startupData) { toast({ title: 'Invalid Code', description: 'No team found.', variant: 'destructive' }); setJoining(false); return; }
      const { error: joinError } = await supabase.from('startup_members').insert({ startup_id: startupData.id, user_id: user.id, role: 'member' });
      if (joinError) {
        if (joinError.code === '23505') toast({ title: 'Already a Member', description: 'You are already in this team.', variant: 'destructive' });
        else throw joinError;
      } else {
        toast({ title: 'Welcome!', description: `You have joined ${startupData.name}.` });
        await refetch();
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to join team.', variant: 'destructive' });
    } finally { setJoining(false); }
  };

  const handleSubmitBudget = async () => {
    if (!user || !startup) return;
    setBudgetSubmitting(true);
    try {
      const allocations: Record<string, number> = {};
      let total = 0;
      for (const phase of SDLC_PHASES) {
        const val = parseFloat(phaseAllocations[phase] || '0');
        if (val > 0) { allocations[phase] = val; total += val; }
      }

      if (total <= 0) {
        toast({ title: 'Invalid Budget', description: 'Please allocate amounts to at least one phase.', variant: 'destructive' });
        setBudgetSubmitting(false); return;
      }

      const grantAmount = Number(startup.grant_amount);
      let status: 'pending' | 'approved' | 'rejected' = 'pending';
      let adminNotes = 'Budget submitted for admin review.';

      if (total <= grantAmount) {
        adminNotes = `Budget submitted for review — ${formatNaira(total)} of ${formatNaira(grantAmount)} grant.`;
      } else {
        status = 'rejected';
        adminNotes = `Budget auto-rejected — ${formatNaira(total)} exceeds the grant allocation of ${formatNaira(grantAmount)}.`;
      }

      const { error } = await supabase.from('budgets').insert({
        startup_id: startup.id, total_amount: total, status,
        phase_allocations: allocations,
        submitted_by: user.id,
        admin_notes: adminNotes,
      });

      if (error) {
        if (error.code === '23505') toast({ title: 'Budget Exists', description: 'A budget already exists for your team.', variant: 'destructive' });
        else throw error;
      } else {
        if (status === 'rejected') {
          toast({ title: '❌ Budget Auto-Rejected', description: `Your budget exceeds the grant of ${formatNaira(grantAmount)}.`, variant: 'destructive' });
        } else {
          toast({ title: '📋 Budget Submitted', description: `Your budget of ${formatNaira(total)} has been submitted for admin approval.` });
        }
        await logActivity(startup.id, `submitted budget (${formatNaira(total)})`, 'budget', undefined, { total, allocations });
        setIsBudgetDialogOpen(false);
        setPhaseAllocations(Object.fromEntries(SDLC_PHASES.map(p => [p, ''])));
        await refetch();
        fetchStats();
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to submit budget.', variant: 'destructive' });
    } finally { setBudgetSubmitting(false); }
  };

  const phaseBudgetTotal = Object.values(phaseAllocations).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  // Show loading spinner while auth or startup data is loading
  if (loading || startupLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!startup || !membership) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-12 space-y-8">
          <div className="text-center space-y-3">
            <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center"><Building2 className="h-10 w-10 text-primary" /></div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.user_metadata?.full_name?.split(' ')[0] || 'there'}! 👋</h1>
            <p className="text-muted-foreground text-lg">You're not part of any team yet. Join using an invite code.</p>
          </div>
          <Card className="border-2 border-dashed border-primary/30">
            <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Join a Team</CardTitle><CardDescription>Enter the invite code shared by your administrator</CardDescription></CardHeader>
            <CardContent><div className="flex gap-3"><Input placeholder="Enter invite code (e.g. AB12CD34)" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} className="text-lg tracking-wider font-mono uppercase" maxLength={8} /><Button onClick={handleJoinTeam} disabled={joining || !inviteCode.trim()}>{joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Join</Button></div></CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const grantAmount = Number(startup.grant_amount);
  const budgetApproved = budget?.status === 'approved';
  const budgetAmount_ = budget ? Number(budget.total_amount) : 0;
  const spentPercent = budgetAmount_ > 0 ? (totalSpent / budgetAmount_) * 100 : 0;
  const progressPercent = taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0;

  const CHART_COLORS = ['hsl(222, 71%, 25%)', 'hsl(38, 95%, 55%)', 'hsl(200, 90%, 45%)', 'hsl(152, 76%, 36%)', 'hsl(0, 84%, 60%)', 'hsl(280, 60%, 50%)'];

  const budgetChartData = budgetApproved ? [
    { name: 'Spent', value: totalSpent },
    { name: 'Remaining', value: Math.max(0, budgetAmount_ - totalSpent) },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'Student'}</h1>
            <p className="text-muted-foreground">Team: <span className="font-medium text-foreground">{startup.name}</span></p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">Code: {startup.invite_code}</Badge>
        </div>

        {/* Budget Banners */}
        {!budget && (
          <Card className="border-warning/50 bg-warning/5"><CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-warning" /><div><p className="font-medium">No Budget Submitted</p><p className="text-sm text-muted-foreground">Submit a phase-by-phase budget breakdown for admin approval.</p></div></div>
            <Button onClick={() => setIsBudgetDialogOpen(true)}>Submit Budget</Button>
          </CardContent></Card>
        )}
        {budget && budget.status === 'pending' && (
          <Card className="border-primary/50 bg-primary/5"><CardContent className="pt-6 flex items-center gap-3"><Clock className="h-5 w-5 text-primary" /><div><p className="font-medium">Budget Pending Approval</p><p className="text-sm text-muted-foreground">Your budget of {formatNaira(budgetAmount_)} is awaiting admin review.</p></div></CardContent></Card>
        )}
        {budget && budget.status === 'rejected' && (
          <Card className="border-destructive/50 bg-destructive/5"><CardContent className="pt-6 flex items-center gap-3"><AlertCircle className="h-5 w-5 text-destructive" /><div><p className="font-medium">Budget Rejected</p><p className="text-sm text-muted-foreground">{budget.admin_notes || 'Please submit a revised budget.'}</p></div></CardContent></Card>
        )}
        {budget && budget.status === 'approved' && spentPercent > 90 && (
          <Card className="border-destructive/50 bg-destructive/5"><CardContent className="pt-6 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><div><p className="font-medium">⚠️ Budget Warning</p><p className="text-sm text-muted-foreground">You've used {spentPercent.toFixed(0)}% of your approved budget.</p></div></CardContent></Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Grant Amount</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(grantAmount)}</div><p className="text-xs text-muted-foreground">Allocated funding</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Budget Used</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(totalSpent)}</div>{budgetApproved && <><Progress value={Math.min(spentPercent, 100)} className="mt-2" /><p className="text-xs text-muted-foreground mt-1">{spentPercent.toFixed(0)}% of budget</p></>}{!budgetApproved && <p className="text-xs text-muted-foreground">Budget not yet approved</p>}</CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Project Progress</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{progressPercent.toFixed(0)}%</div>{taskStats.total > 0 && <Progress value={progressPercent} className="mt-2" />}<p className="text-xs text-muted-foreground mt-1">{taskStats.completed}/{taskStats.total} tasks done</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Team</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{members.length}</div><p className="text-xs text-muted-foreground">Team members</p></CardContent></Card>
        </div>

        {/* Burn Rate Chart */}
        {budgetApproved && burnRateData.length > 1 && (
          <Card>
            <CardHeader><CardTitle>Grant Spending vs Time</CardTitle><CardDescription>Actual spending pace compared to projected linear spending over the incubation period</CardDescription></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={burnRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={(d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                  <YAxis tickFormatter={(v) => `${formatNaira(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => formatNaira(v)} labelFormatter={(d) => new Date(d).toLocaleDateString()} />
                  <Legend />
                  <Line type="monotone" dataKey="spent" name="Actual Spent" stroke="hsl(38, 95%, 55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="projected" name="Projected (Linear)" stroke="hsl(222, 71%, 25%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Charts + Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Budget Visual */}
          <Card>
            <CardHeader><CardTitle>Budget Breakdown</CardTitle><CardDescription>Visual representation of spending</CardDescription></CardHeader>
            <CardContent>
              {budgetApproved && budgetChartData.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart><Pie data={budgetChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                      <Cell fill="hsl(38, 95%, 55%)" /><Cell fill="hsl(220, 25%, 94%)" />
                    </Pie><Tooltip formatter={(v: number) => formatNaira(v)} /><Legend /></PieChart>
                  </ResponsiveContainer>
                  {budget?.phase_allocations && Object.keys(budget.phase_allocations).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Phase Allocations</p>
                      {Object.entries(budget.phase_allocations as Record<string, number>).map(([phase, amount]) => (
                        <div key={phase} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{phase}</span>
                          <span className="font-medium">{formatNaira(Number(amount))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {expendituresByCategory.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">By Category</p>
                      {expendituresByCategory.map((cat, i) => (
                        <div key={cat.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span>{cat.name}</span>
                          </div>
                          <span className="font-medium">{formatNaira(cat.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : <div className="text-center py-8 text-muted-foreground">Submit and get a budget approved to see visualizations.</div>}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle><CardDescription>Common tasks at your fingertips</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/tasks')}>
                <ListTodo className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Manage Tasks</div><div className="text-xs text-muted-foreground">Create and track project tasks</div></div><ArrowRight className="ml-auto h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/expenditures')}>
                <DollarSign className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Log Expenditure</div><div className="text-xs text-muted-foreground">Track your spending with evidence</div></div><ArrowRight className="ml-auto h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/documents')}>
                <FolderOpen className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Upload Deliverable</div><div className="text-xs text-muted-foreground">Share project files</div></div><ArrowRight className="ml-auto h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/timeline')}>
                <CalendarRange className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Project Timeline</div><div className="text-xs text-muted-foreground">View Gantt chart and milestones</div></div><ArrowRight className="ml-auto h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/chat')}>
                <MessageCircle className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Team Chat</div><div className="text-xs text-muted-foreground">Communicate with your team</div></div><ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Team Members */}
        <Card>
          <CardHeader><CardTitle>Team Members</CardTitle><CardDescription>Your project team</CardDescription></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {(m.profiles?.full_name || '?')[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{m.profiles?.full_name || 'Unknown'}</span>
                  </div>
                  <Badge variant={m.role === 'leader' ? 'default' : 'secondary'} className="capitalize text-xs">{m.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Budget Dialog */}
        <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit Project Budget</DialogTitle>
              <DialogDescription>
                Break down your budget by SDLC phase. Grant: <strong>{formatNaira(grantAmount)}</strong>. The admin will review and approve or modify it.
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
                      value={phaseAllocations[phase]}
                      onChange={(e) => setPhaseAllocations(prev => ({ ...prev, [phase]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className={`text-lg font-bold ${phaseBudgetTotal > grantAmount ? 'text-destructive' : 'text-foreground'}`}>
                  {formatNaira(phaseBudgetTotal)}
                </span>
              </div>
              {phaseBudgetTotal > grantAmount && (
                <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Exceeds grant of {formatNaira(grantAmount)}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBudgetDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitBudget} disabled={budgetSubmitting || phaseBudgetTotal <= 0}>
                {budgetSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
