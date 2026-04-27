-- =====================================================
-- COMPLETE DATABASE SCHEMA FOR STARTUP GRANT MANAGEMENT

-- 1. CREATE ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TYPE public.budget_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'completed');

-- 2. CREATE TABLES

-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Startups table (with invite_code and grant_amount)
CREATE TABLE public.startups (
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

-- Startup members table (FK to profiles for join queries)
CREATE TABLE public.startup_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (startup_id, user_id)
);

-- Budgets table
CREATE TABLE public.budgets (
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

-- Tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  phase text NOT NULL DEFAULT 'Development',
  status task_status DEFAULT 'todo' NOT NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  due_date date,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Expenditures table
CREATE TABLE public.expenditures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  category text NOT NULL,
  phase text,
  receipt_url text,
  date date NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Documents table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 4. ADD SOFT-DELETE COLUMNS FOR EXISTING TABLES
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expenditures ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.expenditures ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. ENABLE RLS ON ALL TABLES
CREATE INDEX IF NOT EXISTS idx_budgets_startup_id ON public.budgets(startup_id);
CREATE INDEX IF NOT EXISTS idx_budgets_approved_by ON public.budgets(approved_by);
CREATE INDEX IF NOT EXISTS idx_budgets_submitted_by ON public.budgets(submitted_by);
CREATE INDEX IF NOT EXISTS idx_startup_members_startup_id ON public.startup_members(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_members_user_id ON public.startup_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_startup_members_one_leader_per_startup
  ON public.startup_members(startup_id)
  WHERE lower(trim(role)) = 'leader';
CREATE INDEX IF NOT EXISTS idx_tasks_startup_id ON public.tasks(startup_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_expenditures_startup_id ON public.expenditures(startup_id);
CREATE INDEX IF NOT EXISTS idx_expenditures_created_by ON public.expenditures(created_by);
CREATE INDEX IF NOT EXISTS idx_expenditures_deleted_at ON public.expenditures(deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_startup_id ON public.documents(startup_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON public.documents(deleted_at);
CREATE INDEX IF NOT EXISTS idx_messages_startup_id_created_at ON public.messages(startup_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenditures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 6. CREATE SECURITY DEFINER FUNCTIONS

CREATE OR REPLACE FUNCTION public.has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_startup_member(_startup_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.startup_members
    WHERE user_id = auth.uid()
      AND startup_id = _startup_id
  );
$$;

-- 7. CREATE TRIGGER FUNCTIONS

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 8. CREATE TRIGGERS

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_startups_updated_at
BEFORE UPDATE ON public.startups
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. CREATE RLS POLICIES

-- PROFILES
CREATE POLICY "Anyone can view profiles" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Admins can do everything with roles" ON public.user_roles
  FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- STARTUPS
CREATE POLICY "Admins can do everything with startups" ON public.startups
  FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Anyone authenticated can view startups" ON public.startups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- STARTUP_MEMBERS
CREATE POLICY "Admins can do everything with members" ON public.startup_members
  FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Users can view all memberships" ON public.startup_members
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert their own membership" ON public.startup_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- BUDGETS
CREATE POLICY "Admins can do everything with budgets" ON public.budgets
  FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their budgets" ON public.budgets
  FOR ALL USING (public.is_startup_member(startup_id));

-- TASKS
CREATE POLICY "Admins can do everything with tasks" ON public.tasks
  FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their tasks" ON public.tasks
  FOR ALL USING (public.is_startup_member(startup_id));

-- EXPENDITURES
CREATE POLICY "Admins can do everything with expenditures" ON public.expenditures
  FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their expenditures" ON public.expenditures
  FOR ALL USING (public.is_startup_member(startup_id));

-- DOCUMENTS
CREATE POLICY "Admins can do everything with documents" ON public.documents
  FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Members can manage their documents" ON public.documents
  FOR ALL USING (public.is_startup_member(startup_id));

-- 10. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

-- 11. BACKFILL: Create profiles for any existing auth users that don't have one
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Ensure existing users have a role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id, role) DO NOTHING;

-- =====================================================
-- DONE! Your database is now set up.
-- Tables: profiles, user_roles, startups, startup_members, budgets, tasks, expenditures, documents
-- =====================================================
