-- ====================================================
-- DATABASE REFACTORING MIGRATION SCRIPT
-- ====================================================

-- 1. EXTEND THE MAIN 'groups' AND 'group_members' TABLES
-- Add created_by column as nullable first to allow existing records
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Make invite_code UNIQUE if not already
ALTER TABLE public.groups ADD CONSTRAINT groups_invite_code_unique UNIQUE (invite_code);

-- Extend group_members with a role column
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member'));

-- 2. MIGRATE DATA FROM OLD ROTATION TABLES (IF THEY EXIST)
DO $$
BEGIN
    -- Check if rotation_groups exists before migrating
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rotation_groups') THEN
        
        -- Copy groups
        INSERT INTO public.groups (id, name, invite_code, created_by, created_at, updated_at)
        SELECT
            rg.id,
            rg.name,
            rg.invite_code,
            COALESCE(
                (SELECT user_id FROM public.rotation_members rm WHERE rm.group_id = rg.id LIMIT 1),
                (SELECT id FROM public.profiles LIMIT 1)
            ),
            rg.created_at,
            rg.created_at
        FROM public.rotation_groups rg
        ON CONFLICT (id) DO UPDATE 
        SET invite_code = EXCLUDED.invite_code || '_migrated'; -- avoid duplicate invite code collisions

        -- Copy memberships
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rotation_members') THEN
            INSERT INTO public.group_members (group_id, user_id, joined_at, role)
            SELECT
                rm.group_id,
                rm.user_id,
                rm.joined_at,
                'member'
            FROM public.rotation_members rm
            ON CONFLICT (group_id, user_id) DO NOTHING;
        END IF;

    END IF;
END $$;

-- 3. FILL MISSING 'created_by' FOR GROUPS
-- If created_by is still NULL, use the oldest joined member or the first profile
UPDATE public.groups g
SET created_by = COALESCE(
    (SELECT user_id FROM public.group_members gm WHERE gm.group_id = g.id ORDER BY joined_at ASC LIMIT 1),
    (SELECT id FROM public.profiles LIMIT 1)
)
WHERE g.created_by IS NULL;

-- Now enforce NOT NULL constraint on created_by
ALTER TABLE public.groups ALTER COLUMN created_by SET NOT NULL;

-- Set group creators as owners
UPDATE public.group_members gm
SET role = 'owner'
FROM public.groups g
WHERE gm.group_id = g.id AND gm.user_id = g.created_by;

-- 4. CREATE NEW EXPENSES AND PAYMENT_LOGS TABLES
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_expense_payment UNIQUE (expense_id, user_id)
);

-- 5. MIGRATE ROTATION LOGS TO EXPENSES & PAYMENT_LOGS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rotation_logs') THEN
        
        -- Create an expense for each rotation log
        INSERT INTO public.expenses (id, group_id, title, amount, created_by, created_at, updated_at)
        SELECT
            id,
            group_id,
            COALESCE(notes, 'Rotation log tracking turn on ' || tracked_date::text),
            0.00,
            user_id,
            tracked_at,
            created_at
        FROM public.rotation_logs;

        -- Create payment confirmation for each rotation log
        INSERT INTO public.payment_logs (expense_id, user_id, paid_at, note, created_at)
        SELECT
            id, -- references the expense ID we preserved from rotation_log
            user_id,
            tracked_at,
            notes,
            created_at
        FROM public.rotation_logs
        ON CONFLICT (expense_id, user_id) DO NOTHING;

    END IF;
END $$;

-- 6. DROP OLD ROTATION TABLES (AFTER MIGRATION IN PRODUCTION IS COMPLETE)
-- Note: Comment out if you want to verify migration before dropping
DROP TABLE IF EXISTS public.rotation_logs;
DROP TABLE IF EXISTS public.rotation_members;
DROP TABLE IF EXISTS public.rotation_groups;

-- 7. CLEAN UP AND CONSTRAINT INTEGRITY FOR AVAILABILITY SLOTS
-- Remove orphan availability slots (slots belonging to users not in the group)
DELETE FROM public.availability_slots a
WHERE NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = a.group_id AND gm.user_id = a.user_id
);

-- Add composite foreign key guarantee
ALTER TABLE public.availability_slots DROP CONSTRAINT IF EXISTS fk_availability_slots_group_member;
ALTER TABLE public.availability_slots
ADD CONSTRAINT fk_availability_slots_group_member
FOREIGN KEY (group_id, user_id)
REFERENCES public.group_members(group_id, user_id)
ON DELETE CASCADE;

-- Deduplicate identical availability slots
DELETE FROM public.availability_slots a
WHERE a.id NOT IN (
    SELECT MIN(b.id)
    FROM public.availability_slots b
    GROUP BY b.group_id, b.user_id, b.available_date, b.start_time, b.end_time
);

-- Prevent duplicates using UNIQUE constraint
ALTER TABLE public.availability_slots DROP CONSTRAINT IF EXISTS unique_user_availability_slot;
ALTER TABLE public.availability_slots
ADD CONSTRAINT unique_user_availability_slot
UNIQUE (group_id, user_id, available_date, start_time, end_time);

-- 8. CREATE NOTIFICATIONS AND ACTIVITY_LOGS TABLES
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('USER_JOINED', 'USER_LEFT', 'AVAILABLE_UPDATED', 'PAYMENT_MARKED')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE_GROUP', 'USER_JOINED', 'USER_LEFT', 'UPDATE_AVAILABILITY', 'CREATE_EXPENSE', 'PAYMENT_MARKED')),
    entity VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. DEFINE PERFORMANCE INDEXES
-- Availability Indexes
CREATE INDEX IF NOT EXISTS idx_availability_slots_group_id ON public.availability_slots(group_id);
CREATE INDEX IF NOT EXISTS idx_availability_slots_user_id ON public.availability_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_slots_group_date ON public.availability_slots(group_id, available_date);

-- Payments Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_payment_logs_expense_id ON public.payment_logs(expense_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON public.payment_logs(user_id);

-- Group Members Indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- 10. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 11. DEFINE RLS POLICIES

-- Expenses policies
DROP POLICY IF EXISTS select_expenses ON public.expenses;
CREATE POLICY select_expenses ON public.expenses
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = expenses.group_id AND gm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS insert_expenses ON public.expenses;
CREATE POLICY insert_expenses ON public.expenses
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = expenses.group_id AND gm.user_id = auth.uid()
        ) AND created_by = auth.uid()
    );

DROP POLICY IF EXISTS update_expenses ON public.expenses;
CREATE POLICY update_expenses ON public.expenses
    FOR UPDATE TO authenticated
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = expenses.group_id AND gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS delete_expenses ON public.expenses;
CREATE POLICY delete_expenses ON public.expenses
    FOR DELETE TO authenticated
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = expenses.group_id AND gm.user_id = auth.uid() AND gm.role IN ('owner', 'admin')
        )
    );

-- Payment logs policies
DROP POLICY IF EXISTS select_payment_logs ON public.payment_logs;
CREATE POLICY select_payment_logs ON public.payment_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            JOIN public.expenses e ON e.group_id = gm.group_id
            WHERE e.id = payment_logs.expense_id AND gm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS insert_payment_logs ON public.payment_logs;
CREATE POLICY insert_payment_logs ON public.payment_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            JOIN public.expenses e ON e.group_id = gm.group_id
            WHERE e.id = payment_logs.expense_id AND gm.user_id = auth.uid()
        ) AND user_id = auth.uid()
    );

DROP POLICY IF EXISTS delete_payment_logs ON public.payment_logs;
CREATE POLICY delete_payment_logs ON public.payment_logs
    FOR DELETE TO authenticated
    USING (
        user_id = auth.uid()
    );

-- Notifications policies
DROP POLICY IF EXISTS select_notifications ON public.notifications;
CREATE POLICY select_notifications ON public.notifications
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
    );

DROP POLICY IF EXISTS update_notifications ON public.notifications;
CREATE POLICY update_notifications ON public.notifications
    FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid()
    );

DROP POLICY IF EXISTS delete_notifications ON public.notifications;
CREATE POLICY delete_notifications ON public.notifications
    FOR DELETE TO authenticated
    USING (
        user_id = auth.uid()
    );

-- Activity logs policies (Only readable by group members)
DROP POLICY IF EXISTS select_activity_logs ON public.activity_logs;
CREATE POLICY select_activity_logs ON public.activity_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = activity_logs.group_id AND gm.user_id = auth.uid()
        )
    );

-- 12. DEFINE DATABASE TRIGGERS FOR AUTO-LOGGING AND NOTIFICATIONS

-- Helper to update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_groups_updated_at ON public.groups;
CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Trigger 1: Group Creation Activity Log
CREATE OR REPLACE FUNCTION public.log_group_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_logs (group_id, actor_id, action, entity, entity_id)
    VALUES (NEW.id, NEW.created_by, 'CREATE_GROUP', 'groups', NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_group_creation ON public.groups;
CREATE TRIGGER trigger_log_group_creation
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.log_group_creation();


-- Trigger 2: Member Join/Leave
CREATE OR REPLACE FUNCTION public.log_member_changes()
RETURNS TRIGGER AS $$
DECLARE
    actor_name TEXT;
    target_group_name TEXT;
    member_record RECORD;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        SELECT full_name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
        SELECT name INTO target_group_name FROM public.groups WHERE id = NEW.group_id;

        -- Create a notification for every OTHER member of the group
        FOR member_record IN 
            SELECT user_id FROM public.group_members 
            WHERE group_id = NEW.group_id AND user_id != NEW.user_id
        LOOP
            INSERT INTO public.notifications (user_id, group_id, actor_id, type, payload)
            VALUES (
                member_record.user_id,
                NEW.group_id,
                NEW.user_id,
                'USER_JOINED',
                jsonb_build_object(
                    'userId', NEW.user_id,
                    'userName', COALESCE(actor_name, 'A member'),
                    'groupName', COALESCE(target_group_name, 'the group')
                )
            );
        END LOOP;

        -- Log in activity_logs
        INSERT INTO public.activity_logs (group_id, actor_id, action, entity, entity_id)
        VALUES (NEW.group_id, NEW.user_id, 'USER_JOINED', 'group_members', NEW.user_id);
        
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        SELECT full_name INTO actor_name FROM public.profiles WHERE id = OLD.user_id;
        SELECT name INTO target_group_name FROM public.groups WHERE id = OLD.group_id;

        -- Create a notification for every OTHER member of the group
        FOR member_record IN 
            SELECT user_id FROM public.group_members 
            WHERE group_id = OLD.group_id AND user_id != OLD.user_id
        LOOP
            INSERT INTO public.notifications (user_id, group_id, actor_id, type, payload)
            VALUES (
                member_record.user_id,
                OLD.group_id,
                OLD.user_id,
                'USER_LEFT',
                jsonb_build_object(
                    'userId', OLD.user_id,
                    'userName', COALESCE(actor_name, 'A member'),
                    'groupName', COALESCE(target_group_name, 'the group')
                )
            );
        END LOOP;

        -- Log in activity_logs
        INSERT INTO public.activity_logs (group_id, actor_id, action, entity, entity_id)
        VALUES (OLD.group_id, OLD.user_id, 'USER_LEFT', 'group_members', OLD.user_id);
        
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_member_changes ON public.group_members;
CREATE TRIGGER trigger_log_member_changes
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.log_member_changes();


-- Trigger 3: Availability Changes (Debounced to 1 minute per user/group)
CREATE OR REPLACE FUNCTION public.log_availability_changes()
RETURNS TRIGGER AS $$
DECLARE
    target_group_id UUID;
    target_user_id UUID;
    target_id UUID;
    actor_name TEXT;
    target_group_name TEXT;
    member_record RECORD;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_group_id := OLD.group_id;
        target_user_id := OLD.user_id;
        target_id := OLD.id;
    ELSE
        target_group_id := NEW.group_id;
        target_user_id := NEW.user_id;
        target_id := NEW.id;
    END IF;

    SELECT full_name INTO actor_name FROM public.profiles WHERE id = target_user_id;
    SELECT name INTO target_group_name FROM public.groups WHERE id = target_group_id;

    -- Insert notification for other members if not exists in last 1 minute
    IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE group_id = target_group_id
          AND actor_id = target_user_id
          AND type = 'AVAILABLE_UPDATED'
          AND created_at > now() - interval '1 minute'
    ) THEN
        FOR member_record IN 
            SELECT user_id FROM public.group_members 
            WHERE group_id = target_group_id AND user_id != target_user_id
        LOOP
            INSERT INTO public.notifications (user_id, group_id, actor_id, type, payload)
            VALUES (
                member_record.user_id,
                target_group_id,
                target_user_id,
                'AVAILABLE_UPDATED',
                jsonb_build_object(
                    'userId', target_user_id,
                    'userName', COALESCE(actor_name, 'A member'),
                    'groupName', COALESCE(target_group_name, 'the group')
                )
            );
        END LOOP;
    END IF;

    -- Insert activity log if not exists in last 1 minute
    IF NOT EXISTS (
        SELECT 1 FROM public.activity_logs
        WHERE group_id = target_group_id
          AND actor_id = target_user_id
          AND action = 'UPDATE_AVAILABILITY'
          AND created_at > now() - interval '1 minute'
    ) THEN
        INSERT INTO public.activity_logs (group_id, actor_id, action, entity, entity_id)
        VALUES (target_group_id, target_user_id, 'UPDATE_AVAILABILITY', 'availability_slots', target_id);
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_availability_changes ON public.availability_slots;
CREATE TRIGGER trigger_log_availability_changes
AFTER INSERT OR UPDATE OR DELETE ON public.availability_slots
FOR EACH ROW EXECUTE FUNCTION public.log_availability_changes();


-- Trigger 4: Expense Creation
CREATE OR REPLACE FUNCTION public.log_expense_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_logs (group_id, actor_id, action, entity, entity_id)
    VALUES (NEW.group_id, NEW.created_by, 'CREATE_EXPENSE', 'expenses', NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_expense_creation ON public.expenses;
CREATE TRIGGER trigger_log_expense_creation
AFTER INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.log_expense_creation();


-- Trigger 5: Payment Marked
CREATE OR REPLACE FUNCTION public.log_payment_marked()
RETURNS TRIGGER AS $$
DECLARE
    expense_group_id UUID;
    actor_name TEXT;
    target_group_name TEXT;
    expense_title TEXT;
    member_record RECORD;
BEGIN
    SELECT group_id, title INTO expense_group_id, expense_title FROM public.expenses WHERE id = NEW.expense_id;
    SELECT full_name INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
    SELECT name INTO target_group_name FROM public.groups WHERE id = expense_group_id;

    -- Create notification for other members
    FOR member_record IN 
        SELECT user_id FROM public.group_members 
        WHERE group_id = expense_group_id AND user_id != NEW.user_id
    LOOP
        INSERT INTO public.notifications (user_id, group_id, actor_id, type, payload)
        VALUES (
            member_record.user_id,
            expense_group_id,
            NEW.user_id,
            'PAYMENT_MARKED',
            jsonb_build_object(
                'userId', NEW.user_id,
                'userName', COALESCE(actor_name, 'A member'),
                'groupName', COALESCE(target_group_name, 'the group'),
                'expenseId', NEW.expense_id,
                'expenseTitle', expense_title
            )
        );
    END LOOP;

    -- Log in activity_logs
    INSERT INTO public.activity_logs (group_id, actor_id, action, entity, entity_id)
    VALUES (expense_group_id, NEW.user_id, 'PAYMENT_MARKED', 'payment_logs', NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_payment_marked ON public.payment_logs;
CREATE TRIGGER trigger_log_payment_marked
AFTER INSERT ON public.payment_logs
FOR EACH ROW EXECUTE FUNCTION public.log_payment_marked();
