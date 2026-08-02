-- ====================================================================
-- MIGRATION SCRIPT: CẤU TRÚC DATABASE SUPABASE CHO QUẢN LÝ CHI PHÍ CĂN HỘ
-- Chạy script này trong Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ====================================================================

-- 1. Bảng `apartment_configs` (Cấu hình đơn giá & diện tích tổng căn hộ)
CREATE TABLE IF NOT EXISTS public.apartment_configs (
    group_id UUID PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
    total_area_m2 NUMERIC(10,2) NOT NULL DEFAULT 75.00 CHECK (total_area_m2 > 0),
    management_fee_per_m2 NUMERIC(12,2) NOT NULL DEFAULT 12000.00 CHECK (management_fee_per_m2 >= 0),
    water_fee_per_m3 NUMERIC(12,2) NOT NULL DEFAULT 18000.00 CHECK (water_fee_per_m3 >= 0),
    water_total_m3 NUMERIC(10,2) NOT NULL DEFAULT 15.00 CHECK (water_total_m3 >= 0),
    electricity_pricing_mode VARCHAR(30) NOT NULL DEFAULT 'evn_progressive' CHECK (electricity_pricing_mode IN ('evn_progressive', 'flat_rate')),
    electricity_fee_per_kwh NUMERIC(12,2) NOT NULL DEFAULT 2500.00 CHECK (electricity_fee_per_kwh >= 0),
    electricity_total_kwh NUMERIC(10,2) NOT NULL DEFAULT 350.00 CHECK (electricity_total_kwh >= 0),
    vat_percentage NUMERIC(5,2) NOT NULL DEFAULT 8.00 CHECK (vat_percentage >= 0),
    parking_fee_per_vehicle NUMERIC(12,2) NOT NULL DEFAULT 120000.00 CHECK (parking_fee_per_vehicle >= 0),
    apartment_rent NUMERIC(14,2) NOT NULL DEFAULT 10000000.00 CHECK (apartment_rent >= 0),
    billing_month VARCHAR(7) NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bảng `member_space_allocations` (Phân bổ diện tích & số ngày ở của thành viên)
CREATE TABLE IF NOT EXISTS public.member_space_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    living_room_m2 NUMERIC(10,2) NOT NULL DEFAULT 25.00 CHECK (living_room_m2 >= 0),
    bedroom_m2 NUMERIC(10,2) NOT NULL DEFAULT 15.00 CHECK (bedroom_m2 >= 0),
    bathroom_m2 NUMERIC(10,2) NOT NULL DEFAULT 6.00 CHECK (bathroom_m2 >= 0),
    active_days_in_month INT NOT NULL DEFAULT 30 CHECK (active_days_in_month BETWEEN 0 AND 31),
    custom_electricity_kwh NUMERIC(10,2) DEFAULT NULL CHECK (custom_electricity_kwh IS NULL OR custom_electricity_kwh >= 0),
    vehicles_count INT NOT NULL DEFAULT 1 CHECK (vehicles_count >= 0),
    include_parking_fee BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_group_user_allocation UNIQUE (group_id, user_id)
);

-- 3. Bảng `special_appliances` (Khai báo thiết bị điện đặc thù dùng riêng/nhóm)
CREATE TABLE IF NOT EXISTS public.special_appliances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    kwh_consumed NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (kwh_consumed >= 0),
    assigned_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    member_caps JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Bổ sung cột nếu bảng đã tồn tại sẵn
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='member_space_allocations' AND column_name='include_parking_fee') THEN
        ALTER TABLE public.member_space_allocations ADD COLUMN include_parking_fee BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='special_appliances' AND column_name='member_caps') THEN
        ALTER TABLE public.special_appliances ADD COLUMN member_caps JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 5. Tạo Chỉ Mục (Indexes) để tối ưu hóa truy vấn
CREATE INDEX IF NOT EXISTS idx_member_space_allocations_group_id ON public.member_space_allocations(group_id);
CREATE INDEX IF NOT EXISTS idx_special_appliances_group_id ON public.special_appliances(group_id);

-- 6. Bật Row Level Security (RLS) bảo mật dữ liệu
ALTER TABLE public.apartment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_space_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_appliances ENABLE ROW LEVEL SECURITY;

-- 7. Định nghĩa Chính sách Bảo mật RLS (Quyền xem & chỉnh sửa dành cho thành viên nhóm)
-- RLS policies cho `apartment_configs`
DROP POLICY IF EXISTS select_apartment_configs ON public.apartment_configs;
CREATE POLICY select_apartment_configs ON public.apartment_configs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = apartment_configs.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS insert_apartment_configs ON public.apartment_configs;
CREATE POLICY insert_apartment_configs ON public.apartment_configs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = apartment_configs.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS update_apartment_configs ON public.apartment_configs;
CREATE POLICY update_apartment_configs ON public.apartment_configs
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = apartment_configs.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

-- RLS policies cho `member_space_allocations`
DROP POLICY IF EXISTS select_member_space_allocations ON public.member_space_allocations;
CREATE POLICY select_member_space_allocations ON public.member_space_allocations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = member_space_allocations.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS insert_member_space_allocations ON public.member_space_allocations;
CREATE POLICY insert_member_space_allocations ON public.member_space_allocations
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = member_space_allocations.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS update_member_space_allocations ON public.member_space_allocations;
CREATE POLICY update_member_space_allocations ON public.member_space_allocations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = member_space_allocations.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

-- RLS policies cho `special_appliances`
DROP POLICY IF EXISTS select_special_appliances ON public.special_appliances;
CREATE POLICY select_special_appliances ON public.special_appliances
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = special_appliances.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS insert_special_appliances ON public.special_appliances;
CREATE POLICY insert_special_appliances ON public.special_appliances
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = special_appliances.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS update_special_appliances ON public.special_appliances;
CREATE POLICY update_special_appliances ON public.special_appliances
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = special_appliances.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS delete_special_appliances ON public.special_appliances;
CREATE POLICY delete_special_appliances ON public.special_appliances
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE public.group_members.group_id = special_appliances.group_id
            AND public.group_members.user_id = auth.uid()
        )
    );
