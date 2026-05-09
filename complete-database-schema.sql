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
  CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR
    (status <> 'approved' AND approved_by IS NULL AND approved_at IS NULL)
  ),
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

-- Expenditure categories table
CREATE TABLE public.expenditure_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- EXPENDITURES
CREATE TABLE public.expenditures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.startups(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category_id uuid REFERENCES public.expenditure_categories(id) ON DELETE RESTRICT,
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

-- =====================================================
-- 3. REPORTING VIEWS
-- =====================================================

CREATE OR REPLACE VIEW public.startup_budget_summary AS
SELECT
  s.id AS startup_id,
  s.name AS startup_name,
  s.grant_amount,
  b.id AS budget_id,
  b.total_amount AS budget_total_amount,
  b.status AS budget_status,
  COALESCE(SUM(e.amount) FILTER (WHERE e.deleted_at IS NULL), 0)::numeric(12,2) AS total_spent,
  (COALESCE(b.total_amount, 0) - COALESCE(SUM(e.amount) FILTER (WHERE e.deleted_at IS NULL), 0))::numeric(12,2) AS budget_remaining,
  (s.grant_amount - COALESCE(SUM(e.amount) FILTER (WHERE e.deleted_at IS NULL), 0))::numeric(12,2) AS grant_remaining,
  COUNT(e.id) FILTER (WHERE e.deleted_at IS NULL) AS expenditure_count
FROM public.startups s
LEFT JOIN public.budgets b ON b.startup_id = s.id AND b.deleted_at IS NULL
LEFT JOIN public.expenditures e ON e.startup_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, s.grant_amount, b.id, b.total_amount, b.status;

CREATE OR REPLACE VIEW public.startup_task_progress_summary AS
SELECT
  s.id AS startup_id,
  s.name AS startup_name,
  COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL) AS total_tasks,
  COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL AND t.status = 'todo') AS todo_tasks,
  COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL AND t.status = 'in_progress') AS in_progress_tasks,
  COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL AND t.status = 'completed') AS completed_tasks,
  CASE
    WHEN COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL) = 0 THEN 0
    ELSE ROUND(
      (
        COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL AND t.status = 'completed')::numeric
        / COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL)::numeric
      ) * 100,
      2
    )
  END AS completion_percentage
FROM public.startups s
LEFT JOIN public.tasks t ON t.startup_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name;

CREATE OR REPLACE VIEW public.startup_overview_summary AS
SELECT
  s.id AS startup_id,
  s.name AS startup_name,
  s.is_active,
  s.grant_amount,
  COALESCE(b.total_amount, 0)::numeric(12,2) AS budget_total_amount,
  COALESCE(exp.total_spent, 0)::numeric(12,2) AS total_spent,
  (s.grant_amount - COALESCE(exp.total_spent, 0))::numeric(12,2) AS grant_remaining,
  COALESCE(task_counts.total_tasks, 0) AS total_tasks,
  COALESCE(task_counts.completed_tasks, 0) AS completed_tasks,
  COALESCE(doc_counts.total_documents, 0) AS total_documents
FROM public.startups s
LEFT JOIN public.budgets b
  ON b.startup_id = s.id
  AND b.deleted_at IS NULL
LEFT JOIN (
  SELECT startup_id, COALESCE(SUM(amount), 0) AS total_spent
  FROM public.expenditures
  WHERE deleted_at IS NULL
  GROUP BY startup_id
) exp ON exp.startup_id = s.id
LEFT JOIN (
  SELECT
    startup_id,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks
  FROM public.tasks
  WHERE deleted_at IS NULL
  GROUP BY startup_id
) task_counts ON task_counts.startup_id = s.id
LEFT JOIN (
  SELECT startup_id, COUNT(*) AS total_documents
  FROM public.documents
  WHERE deleted_at IS NULL
  GROUP BY startup_id
) doc_counts ON doc_counts.startup_id = s.id
WHERE s.deleted_at IS NULL;

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

-- 4. ADD SOFT-DELETE COLUMNS FOR EXISTING TABLES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'budgets_approval_fields_match_status'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_approval_fields_match_status
      CHECK (
        (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
        OR
        (status <> 'approved' AND approved_by IS NULL AND approved_at IS NULL)
      );
  END IF;
END $$;

ALTER TABLE public.expenditures
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.expenditure_categories(id) ON DELETE RESTRICT;

INSERT INTO public.expenditure_categories (name)
SELECT DISTINCT trim(category)
FROM public.expenditures
WHERE category IS NOT NULL
  AND trim(category) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE public.expenditures e
SET category_id = c.id
FROM public.expenditure_categories c
WHERE e.category_id IS NULL
  AND trim(e.category) = c.name;

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
CREATE INDEX IF NOT EXISTS idx_expenditure_categories_name ON public.expenditure_categories(name);
CREATE INDEX IF NOT EXISTS idx_expenditures_startup_id ON public.expenditures(startup_id);
CREATE INDEX IF NOT EXISTS idx_expenditures_category_id ON public.expenditures(category_id);
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
ALTER TABLE public.expenditure_categories ENABLE ROW LEVEL SECURITY;
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

CREATE OR REPLACE FUNCTION public.enforce_budget_status_transition()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'rejected' AND NEW.status = 'approved' THEN
      RAISE EXCEPTION 'Rejected budgets cannot move directly to approved. Move them through pending first.';
    END IF;

    IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'Approved budgets cannot transition back to another status.';
    END IF;
  END IF;

  IF NEW.status = 'approved' THEN
    IF NEW.approved_by IS NULL THEN
      RAISE EXCEPTION 'approved_by is required when status is approved.';
    END IF;

    IF NEW.approved_at IS NULL THEN
      NEW.approved_at = now();
    END IF;
  ELSE
    NEW.approved_by = NULL;
    NEW.approved_at = NULL;
  END IF;

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

CREATE TRIGGER enforce_budget_status_transition
BEFORE INSERT OR UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_budget_status_transition();

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

-- EXPENDITURE_CATEGORIES
CREATE POLICY "Admins can do everything with expenditure categories" ON public.expenditure_categories
  FOR ALL USING (public.has_role('admin'));
CREATE POLICY "Authenticated users can view expenditure categories" ON public.expenditure_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "member expenditures" ON public.expenditures
FOR ALL USING (public.is_startup_member(startup_id));

CREATE POLICY "member documents" ON public.documents
FOR ALL USING (public.is_startup_member(startup_id));
