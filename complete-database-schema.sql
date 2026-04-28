
-- =====================================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TYPE public.budget_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'completed');
CREATE TYPE public.member_role AS ENUM ('leader', 'member');

-- =====================================================
-- 2. TABLES
-- =====================================================

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- STARTUPS
CREATE TABLE public.startups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  invite_code text NOT NULL DEFAULT upper(substr(gen_random_uuid()::text, 1, 8)),
  grant_amount numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (invite_code)
);

-- STARTUP MEMBERS
CREATE TABLE public.startup_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role member_role NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (startup_id, user_id)
);

-- BUDGETS
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

-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  phase text DEFAULT 'Development',
  status task_status DEFAULT 'todo' NOT NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  due_date date,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- EXPENDITURES
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
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- DOCUMENTS
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
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- OPTIONAL: MESSAGES (FIXED)
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- =====================================================
-- 3. INDEXES
-- =====================================================

CREATE INDEX idx_startup_members_startup_id ON public.startup_members(startup_id);
CREATE INDEX idx_startup_members_user_id ON public.startup_members(user_id);

CREATE UNIQUE INDEX idx_one_leader_per_startup
ON public.startup_members(startup_id)
WHERE role = 'leader';

CREATE INDEX idx_tasks_startup_id ON public.tasks(startup_id);
CREATE INDEX idx_tasks_deleted_at ON public.tasks(deleted_at);

CREATE INDEX idx_expenditures_startup_id ON public.expenditures(startup_id);
CREATE INDEX idx_expenditures_deleted_at ON public.expenditures(deleted_at);

CREATE INDEX idx_documents_startup_id ON public.documents(startup_id);
CREATE INDEX idx_documents_deleted_at ON public.documents(deleted_at);

CREATE INDEX idx_messages_startup_id_created_at
ON public.messages(startup_id, created_at DESC);

-- =====================================================
-- 4. ENABLE RLS
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenditures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. SECURITY FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_role(_role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_startup_member(_startup_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.startup_members
    WHERE user_id = auth.uid() AND startup_id = _startup_id
  );
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_startups_updated_at BEFORE UPDATE ON public.startups FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_expenditures_updated_at BEFORE UPDATE ON public.expenditures FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

-- PROFILES
CREATE POLICY "view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- USER ROLES
CREATE POLICY "admin roles full access" ON public.user_roles
FOR ALL USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

CREATE POLICY "view own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- STARTUPS
CREATE POLICY "admin startups full access" ON public.startups
FOR ALL USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

CREATE POLICY "authenticated can view startups" ON public.startups
FOR SELECT USING (auth.uid() IS NOT NULL);

-- MEMBERS
CREATE POLICY "admin members full access" ON public.startup_members
FOR ALL USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

CREATE POLICY "view memberships" ON public.startup_members
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "join startup" ON public.startup_members
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SHARED MEMBER ACCESS
CREATE POLICY "member budgets" ON public.budgets
FOR ALL USING (public.is_startup_member(startup_id))
WITH CHECK (public.is_startup_member(startup_id));

CREATE POLICY "member tasks" ON public.tasks
FOR ALL USING (public.is_startup_member(startup_id))
WITH CHECK (public.is_startup_member(startup_id));

CREATE POLICY "member expenditures" ON public.expenditures
FOR ALL USING (public.is_startup_member(startup_id))
WITH CHECK (public.is_startup_member(startup_id));

CREATE POLICY "member documents" ON public.documents
FOR ALL USING (public.is_startup_member(startup_id))
WITH CHECK (public.is_startup_member(startup_id));

-- =====================================================
-- 
-- =====================================================
IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
  NEW.updated_at = now();
END IF;

-- =====================================================
created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
