-- SQL Script for creating independent Rotation Tracking tables and setting up Row Level Security (RLS)

-- 1. Create rotation_groups table
CREATE TABLE IF NOT EXISTS public.rotation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    invite_code VARCHAR(20) NOT NULL UNIQUE DEFAULT substring(md5(random()::text) from 1 for 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create rotation_members table (junction table)
CREATE TABLE IF NOT EXISTS public.rotation_members (
    group_id UUID NOT NULL REFERENCES public.rotation_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (group_id, user_id)
);

-- 3. Create rotation_logs table pointing to rotation_groups
CREATE TABLE IF NOT EXISTS public.rotation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.rotation_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tracked_date DATE NOT NULL,
    notes TEXT,
    tracked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create indices for performance optimization
CREATE INDEX IF NOT EXISTS idx_rotation_members_user_id ON public.rotation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rotation_logs_group_id ON public.rotation_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_rotation_logs_tracked_date ON public.rotation_logs(tracked_date);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.rotation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotation_logs ENABLE ROW LEVEL SECURITY;

-- 6. Set RLS Policies for rotation_groups
-- SELECT: Allow group members to view details
CREATE POLICY select_rotation_groups ON public.rotation_groups
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rotation_members
            WHERE public.rotation_members.group_id = rotation_groups.id
            AND public.rotation_members.user_id = auth.uid()
        )
    );

-- INSERT: Allow authenticated users to create groups
CREATE POLICY insert_rotation_groups ON public.rotation_groups
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 7. Set RLS Policies for rotation_members
-- SELECT: Allow members of the group to see other memberships
CREATE POLICY select_rotation_members ON public.rotation_members
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rotation_members as rm
            WHERE rm.group_id = rotation_members.group_id
            AND rm.user_id = auth.uid()
        )
    );

-- INSERT: Allow users to join a group
CREATE POLICY insert_rotation_members ON public.rotation_members
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 8. Set RLS Policies for rotation_logs
-- SELECT: Allow group members to view logs of that group
CREATE POLICY select_rotation_logs ON public.rotation_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rotation_members
            WHERE public.rotation_members.group_id = rotation_logs.group_id
            AND public.rotation_members.user_id = auth.uid()
        )
    );

-- INSERT: Allow group members to log turns for the group
CREATE POLICY insert_rotation_logs ON public.rotation_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rotation_members
            WHERE public.rotation_members.group_id = rotation_logs.group_id
            AND public.rotation_members.user_id = auth.uid()
        )
    );

-- UPDATE: Allow log creator to edit notes
CREATE POLICY update_rotation_logs ON public.rotation_logs
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- DELETE: Allow log creator to delete their logged turns
CREATE POLICY delete_rotation_logs ON public.rotation_logs
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
    );
