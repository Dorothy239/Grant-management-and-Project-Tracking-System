-- =====================================================
-- 1. ENUMS
-- =====================================================

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
  deleted_at timestamptz,
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
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (startup_id, user_id)
);

-- BUDGETS
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  phase_allocations jsonb DEFAULT '{}'::jsonb,
  status budget_status DEFAULT 'pending' NOT NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  admin_notes text,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
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
  priority text DEFAULT 'medium',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  due_date date,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- TASK COMMENTS
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- EXPENDITURES
CREATE TABLE public.expenditures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
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

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ACTIVITIES
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- INVITES
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE,
  email text,
  invite_code text NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- 3. INDEXES
-- =====================================================

CREATE INDEX idx_startup_members_startup_id ON public.startup_members(startup_id);
CREATE INDEX idx_tasks_startup_id ON public.tasks(startup_id);
CREATE INDEX idx_expenditures_startup_id ON public.expenditures(startup_id);
CREATE INDEX idx_documents_startup_id ON public.documents(startup_id);

CREATE UNIQUE INDEX idx_one_leader_per_startup
ON public.startup_members(startup_id)
WHERE role = 'leader';

-- =====================================================
-- 4. RLS ENABLE
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
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_startup_member(_startup_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.startup_members
    WHERE user_id = auth.uid() AND startup_id = _startup_id
  );
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), '')
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 7. BUDGET LIMIT PROTECTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_budget_limit()
RETURNS trigger AS $$
DECLARE
  total_spent numeric;
  budget_limit numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO total_spent
  FROM public.expenditures
  WHERE startup_id = NEW.startup_id
  AND deleted_at IS NULL;

  SELECT total_amount INTO budget_limit
  FROM public.budgets
  WHERE startup_id = NEW.startup_id;

  IF (total_spent + NEW.amount) > budget_limit THEN
    RAISE EXCEPTION 'Budget exceeded!';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_budget_limit
BEFORE INSERT ON public.expenditures
FOR EACH ROW
EXECUTE FUNCTION public.check_budget_limit();

-- =====================================================
-- 8. RLS POLICIES (FIXED)
-- =====================================================

-- PROFILES
CREATE POLICY "view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- USER ROLES
CREATE POLICY "admin roles full access" ON public.user_roles
FOR ALL USING (public.has_role('admin'));

-- STARTUPS (FIXED)
CREATE POLICY "members can view startups" ON public.startups
FOR SELECT USING (
  public.is_startup_member(id) OR public.has_role('admin')
);

-- MEMBERS
CREATE POLICY "join startup" ON public.startup_members
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SHARED ACCESS
CREATE POLICY "member budgets" ON public.budgets
FOR ALL USING (public.is_startup_member(startup_id));

CREATE POLICY "member tasks" ON public.tasks
FOR ALL USING (public.is_startup_member(startup_id));

CREATE POLICY "member expenditures" ON public.expenditures
FOR ALL USING (public.is_startup_member(startup_id));

CREATE POLICY "member documents" ON public.documents
FOR ALL USING (public.is_startup_member(startup_id));
