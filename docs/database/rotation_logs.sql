-- SQL Script for creating the rotation_logs table and setting up Row Level Security (RLS)

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.rotation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tracked_date DATE NOT NULL,
    notes TEXT,
    tracked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create indices for performance optimization
CREATE INDEX IF NOT EXISTS idx_rotation_logs_group_id ON public.rotation_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_rotation_logs_tracked_date ON public.rotation_logs(tracked_date);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.rotation_logs ENABLE ROW LEVEL SECURITY;

-- 4. Set RLS Policies
-- SELECT: Allow group members to view logs of that group
CREATE POLICY select_rotation_logs ON public.rotation_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = rotation_logs.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

-- INSERT: Allow group members to log turns for the group
CREATE POLICY insert_rotation_logs ON public.rotation_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = rotation_logs.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

-- UPDATE: Allow log creator to edit their notes or entry details
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
