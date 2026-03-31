import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, DollarSign, TrendingUp, ArrowRight, Clock, AlertTriangle, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatNaira } from '@/lib/currency';

export default function AdminDashboard() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ teams: 0, activeTeams: 0, totalGrants: 0, totalMembers: 0, pendingBudgets: 0, totalTasks: 0, completedTasks: 0 });
  const [loadingData, setLoadingData] = useState(true);
  const [pendingBudgetTeams, setPendingBudgetTeams] = useState<{ name: string; amount: number; startupId: string }[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
    if (!loading && role === 'student') navigate('/dashboard');
    if (user && role === 'admin') fetchStats();
  }, [user, role, loading]);

  const fetchStats = async () => {
    try {
      const [startupsRes, membersRes, budgetsRes, tasksRes] = await Promise.all([
        supabase.from('startups').select('id, name, is_active, grant_amount'),
        supabase.from('startup_members').select('id'),
        supabase.from('budgets').select('startup_id, total_amount, status, startups(name)'),
        supabase.from('tasks').select('status'),
      ]);
      const startups = startupsRes.data || [];
      const budgets = budgetsRes.data || [];
      const tasks = tasksRes.data || [];
      const pending = budgets.filter((b: any) => b.status === 'pending');

      setStats({
        teams: startups.length,
        activeTeams: startups.filter(s => s.is_active).length,
        totalGrants: startups.reduce((s, t) => s + Number(t.grant_amount), 0),
        totalMembers: (membersRes.data || []).length,
        pendingBudgets: pending.length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
      });
      setPendingBudgetTeams(pending.map((b: any) => ({
        name: (b as any).startups?.name || 'Unknown',
        amount: Number(b.total_amount),
        startupId: b.startup_id,
      })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingData(false);
    }
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage teams, review budgets, and track progress</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Teams</CardTitle><Building2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.teams}</div><p className="text-xs text-muted-foreground">{stats.activeTeams} active</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Grants Allocated</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatNaira(stats.totalGrants)}</div><p className="text-xs text-muted-foreground">Total funding</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Task Progress</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalTasks > 0 ? `${((stats.completedTasks / stats.totalTasks) * 100).toFixed(0)}%` : '0%'}</div><p className="text-xs text-muted-foreground">{stats.completedTasks}/{stats.totalTasks} tasks done</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending Budgets</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.pendingBudgets}</div><p className="text-xs text-muted-foreground">Awaiting review</p></CardContent></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {pendingBudgetTeams.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Pending Budget Reviews</CardTitle><CardDescription>Teams waiting for budget approval</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingBudgetTeams.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => navigate(`/admin/teams/${t.startupId}`)}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        <div><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{formatNaira(t.amount)} requested</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Pending</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/admin/startups')}><Building2 className="mr-2 h-4 w-4" />Create Team</Button>
              <Button variant="outline" onClick={() => navigate('/admin/reports')}><TrendingUp className="mr-2 h-4 w-4" />View Reports</Button>
              <Button variant="outline" onClick={() => navigate('/admin/users')}><Users className="mr-2 h-4 w-4" />Manage Users</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
