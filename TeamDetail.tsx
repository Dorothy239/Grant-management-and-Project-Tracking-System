// =========================
// hooks/useTeamDetails.ts
// =========================
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useTeamDetails(id?: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);

      const [
        startup,
        members,
        tasks,
        expenditures,
        documents,
        budget,
        activities,
        profiles,
      ] = await Promise.all([
        supabase.from('startups').select('*').eq('id', id).single(),
        supabase.from('startup_members').select('*, profiles:user_id(full_name,email)').eq('startup_id', id),
        supabase.from('tasks').select('*').eq('startup_id', id),
        supabase.from('expenditures').select('*').eq('startup_id', id),
        supabase.from('documents').select('*').eq('startup_id', id),
        supabase.from('budgets').select('*').eq('startup_id', id).maybeSingle(),
        supabase.from('activities').select('*').eq('startup_id', id),
        supabase.from('profiles').select('id, full_name'),
      ]);

      setData({
        startup: startup.data,
        members: members.data || [],
        tasks: tasks.data || [],
        expenditures: expenditures.data || [],
        documents: documents.data || [],
        budget: budget.data,
        activities: activities.data || [],
        profiles: profiles.data || [],
      });

      setLoading(false);
    };

    fetchData();
  }, [id]);

  return { data, loading };
}

// =========================
// components/SummaryCards.tsx
// =========================
import { Card, CardContent } from '@/components/ui/card';
import { Users, DollarSign } from 'lucide-react';

export function SummaryCards({ members, spent, grant }: any) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="pt-6 flex items-center gap-3">
          <Users />
          <div>
            <p className="text-sm">Members</p>
            <p className="text-xl font-bold">{members.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 flex items-center gap-3">
          <DollarSign />
          <div>
            <p className="text-sm">Spent</p>
            <p className="text-xl font-bold">{spent} / {grant}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =========================
// components/TaskList.tsx
// =========================
export function TaskList({ tasks }: any) {
  if (!tasks.length) return <p>No tasks</p>;

  return (
    <div className="space-y-2">
      {tasks.map((t: any) => (
        <div key={t.id} className="p-3 border rounded">
          <p className="font-medium">{t.title}</p>
          <p className="text-xs">{t.status}</p>
        </div>
      ))}
    </div>
  );
}

// =========================
// pages/TeamDetail.tsx
// =========================
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useTeamDetails } from '@/hooks/useTeamDetails';
import { SummaryCards } from '@/components/SummaryCards';
import { TaskList } from '@/components/TaskList';

export default function TeamDetail() {
  const { id } = useParams();
  const { data, loading } = useTeamDetails(id);

  const metrics = useMemo(() => {
    if (!data) return null;

    const spent = data.expenditures.reduce((s: number, e: any) => s + Number(e.amount), 0);

    return {
      spent,
      grant: data.startup?.grant_amount || 0,
    };
  }, [data]);

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;
  if (!data) return <DashboardLayout>No data</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{data.startup?.name}</h1>

        <SummaryCards
          members={data.members}
          spent={metrics?.spent}
          grant={metrics?.grant}
        />

        <TaskList tasks={data.tasks} />
      </div>
    </DashboardLayout>
  );
}
