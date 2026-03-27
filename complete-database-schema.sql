-- =====================================================
-- COMPLETE DATABASE SCHEMA FOR STARTUP GRANT MANAGEMENT
-- Non-destructive setup/update script for Supabase SQL Editor
-- Safe to run without dropping application data
-- =====================================================

-- 1. REFRESH RECREATABLE OBJECTS ONLY
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view accessible profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything with roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can do everything with startups" ON public.startups;
DROP POLICY IF EXISTS "Anyone authenticated can view startups" ON public.startups;
DROP POLICY IF EXISTS "Users can view accessible startups" ON public.startups;
DROP POLICY IF EXISTS "Admins can do everything with members" ON public.startup_members;
DROP POLICY IF EXISTS "Users can view all memberships" ON public.startup_members;
DROP POLICY IF EXISTS "Users can view accessible memberships" ON public.startup_members;
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.startup_members;
DROP POLICY IF EXISTS "Admins can do everything with budgets" ON public.budgets;
DROP POLICY IF EXISTS "Members can manage their budgets" ON public.budgets;
DROP POLICY IF EXISTS "Admins can do everything with tasks" ON public.tasks;
DROP POLICY IF EXISTS "Members can manage their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can do everything with expenditures" ON public.expenditures;
DROP POLICY IF EXISTS "Members can manage their expenditures" ON public.expenditures;
DROP POLICY IF EXISTS "Admins can do everything with documents" ON public.documents;
DROP POLICY IF EXISTS "Members can manage their documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can do everything with messages" ON public.messages;
DROP POLICY IF EXISTS "Members can manage their messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can do everything with activity_log" ON public.activity_log;
DROP POLICY IF EXISTS "Members can view their activity_log" ON public.activity_log;
DROP POLICY IF EXISTS "Members can insert activity_log" ON public.activity_log;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS set_startups_updated_at ON public.startups;
DROP TRIGGER IF EXISTS set_budgets_updated_at ON public.budgets;

-- 2. CREATE ENUMS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'student');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.budget_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'completed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

-- 3. CREATE TABLES

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.startups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  invite_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 8)),
  grant_amount numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (invite_code)
);

CREATE TABLE IF NOT EXISTS public.startup_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (startup_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  phase_allocations jsonb DEFAULT '{}'::jsonb,
  status budget_status DEFAULT 'pending' NOT NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  admin_notes text,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (startup_id)
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  phase text NOT NULL DEFAULT 'Development',
  status task_status DEFAULT 'todo' NOT NULL,
  priority task_priority DEFAULT 'medium' NOT NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  due_date date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expenditures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  category text NOT NULL,
  phase text,
  receipt_url text,
  date date NOT NULL,
  linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 4. ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenditures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- 5. SECURITY DEFINER FUNCTIONS

CREATE OR REPLACE FUNCTION public.has_role(_role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_startup_member(_startup_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.startup_members WHERE user_id = auth.uid() AND startup_id = _startup_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_startup(_startup_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role('admin') OR public.is_startup_member(_startup_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    auth.uid() = _profile_id
    OR public.has_role('admin')
    OR EXISTS (
      SELECT 1
      FROM public.startup_members viewer_membership
      JOIN public.startup_members target_membership
        ON viewer_membership.startup_id = target_membership.startup_id
      WHERE viewer_membership.user_id = auth.uid()
        AND target_membership.user_id = _profile_id
    );
$$;

-- 6. TRIGGER FUNCTIONS

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 7. TRIGGERS
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_startups_updated_at BEFORE UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. RLS POLICIES

-- PROFILES
CREATE POLICY "Users can view accessible profiles" ON public.profiles FOR SELECT USING (public.can_view_profile(id));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Admins can do everything with roles" ON public.user_roles FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- STARTUPS
CREATE POLICY "Admins can do everything with startups" ON public.startups FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Users can view accessible startups" ON public.startups FOR SELECT USING (public.can_access_startup(id));

-- STARTUP_MEMBERS
CREATE POLICY "Admins can do everything with members" ON public.startup_members FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Users can view accessible memberships" ON public.startup_members FOR SELECT USING (
  auth.uid() = user_id OR public.can_access_startup(startup_id)
);
CREATE POLICY "Users can insert their own membership" ON public.startup_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- BUDGETS
CREATE POLICY "Admins can do everything with budgets" ON public.budgets FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their budgets" ON public.budgets FOR ALL USING (public.is_startup_member(startup_id));

-- TASKS
CREATE POLICY "Admins can do everything with tasks" ON public.tasks FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their tasks" ON public.tasks FOR ALL USING (public.is_startup_member(startup_id));

-- EXPENDITURES
CREATE POLICY "Admins can do everything with expenditures" ON public.expenditures FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their expenditures" ON public.expenditures FOR ALL USING (public.is_startup_member(startup_id));

-- DOCUMENTS
CREATE POLICY "Admins can do everything with documents" ON public.documents FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their documents" ON public.documents FOR ALL USING (public.is_startup_member(startup_id));

-- MESSAGES
CREATE POLICY "Admins can do everything with messages" ON public.messages FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their messages" ON public.messages FOR ALL USING (public.is_startup_member(startup_id));

-- ACTIVITY_LOG
CREATE POLICY "Admins can do everything with activity_log" ON public.activity_log FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can view their activity_log" ON public.activity_log FOR SELECT USING (public.is_startup_member(startup_id));
CREATE POLICY "Members can insert activity_log" ON public.activity_log FOR INSERT WITH CHECK (public.is_startup_member(startup_id));

-- Enable realtime for messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- 9. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their own documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- 10. BACKFILL
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student' FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.user_roles) ON CONFLICT (user_id, role) DO NOTHING;

-- =====================================================
-- DONE! Tables: profiles, user_roles, startups, startup_members, budgets, tasks, expenditures, documents, messages, activity_log
-- =====================================================
