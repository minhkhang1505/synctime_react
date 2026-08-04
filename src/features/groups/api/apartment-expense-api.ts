import { supabase } from '../../../lib/supabase';

export interface EVNTier {
  tier: number;
  name: string;
  minKwh: number;
  maxKwh: number | null; // null means infinity
  pricePerKwh: number; // VNĐ / kWh
}

// Biểu giá điện sinh hoạt 6 bậc EVN chính thức mới nhất (theo QĐ 1416/QĐ-BCT)
export const DEFAULT_EVN_TIERS: EVNTier[] = [
  { tier: 1, name: 'Bậc 1 (0 - 50 kWh)', minKwh: 0, maxKwh: 50, pricePerKwh: 1893 },
  { tier: 2, name: 'Bậc 2 (51 - 100 kWh)', minKwh: 50, maxKwh: 100, pricePerKwh: 1956 },
  { tier: 3, name: 'Bậc 3 (101 - 200 kWh)', minKwh: 100, maxKwh: 200, pricePerKwh: 2271 },
  { tier: 4, name: 'Bậc 4 (201 - 300 kWh)', minKwh: 200, maxKwh: 300, pricePerKwh: 2860 },
  { tier: 5, name: 'Bậc 5 (301 - 400 kWh)', minKwh: 301, maxKwh: 400, pricePerKwh: 3197 },
  { tier: 6, name: 'Bậc 6 (Từ 401 kWh trở lên)', minKwh: 400, maxKwh: null, pricePerKwh: 3302 },
];

export interface ApartmentConfig {
  groupId: string;
  totalAreaM2: number; // Diện tích căn hộ m2
  managementFeePerM2: number; // Phí quản lý / m2
  waterFeePerM3: number; // Phí nước / m3
  waterTotalM3: number; // Tổng m3 nước tiêu thụ
  waterVatPercentage: number; // Thuế VAT nước % (mặc định 5%)
  waterBvmtPercentage: number; // Phí bảo vệ môi trường % (mặc định 10%)
  electricityPricingMode: 'evn_progressive' | 'flat_rate';
  electricityFeePerKwh: number; // Nếu dùng flat rate
  electricityTotalKwh: number; // Tổng số kWh điện cả căn hộ
  vatPercentage: number; // VAT điện % (mặc định 8%)
  parkingFeePerVehicle: number; // Phí gửi 1 xe
  apartmentRent: number; // Tiền thuê căn hộ / tháng
  billingMonth: string; // Thống kê tháng YYYY-MM
}

export interface MemberSpaceAllocation {
  userId: string;
  memberName: string;
  avatarUrl?: string;
  livingRoomM2: number; // Phòng khách m2 (dùng chung)
  bedroomM2: number; // Phòng ngủ m2 (riêng)
  bathroomM2: number; // W.C m2 (dùng chung hoặc riêng)
  activeDaysInMonth: number; // Số ngày ở trong tháng (mặc định 30)
  customElectricityKwh: number | null; // Số kWh riêng (nếu có công tơ phụ)
  vehiclesCount: number; // Số lượng xe gửi
  includeRent?: boolean; // Bật/Tắt tính tiền thuê nhà (mặc định true)
  includeManagementFee?: boolean; // Bật/Tắt tính phí quản lý (mặc định true)
  includeWater?: boolean; // Bật/Tắt tính tiền nước (mặc định true)
  includeElectricity?: boolean; // Bật/Tắt tính tiền điện (mặc định true)
  includeParkingFee?: boolean; // Bật/Tắt tính phí gửi xe (mặc định true)
}

export interface SpecialAppliance {
  id: string;
  name: string; // Tên thiết bị: Máy lạnh P1, PC Gaming...
  kwhConsumed: number; // Số kWh tiêu thụ
  assignedUserIds: string[]; // Danh sách ID các thành viên sử dụng thiết bị
  memberCaps?: Record<string, number | null>; // Mốc kWh dừng dùng của từng thành viên (ví dụ: { "user-b": 32 })
}

export interface MemberExpenseBreakdown {
  userId: string;
  memberName: string;
  avatarUrl?: string;
  allocatedAreaM2: number; // Tổng diện tích quy đổi
  activeDays: number;
  rentShare: number; // Tiền nhà
  managementFeeShare: number; // Phí quản lý
  waterShare: number; // Tiền nước
  applianceElectricityShare: number; // Tiền điện thiết bị đặc thù
  sharedElectricityShare: number; // Tiền điện dùng chung (theo số ngày ở)
  totalElectricityShare: number; // Tổng tiền điện
  parkingShare: number; // Phí gửi xe
  includeRent: boolean;
  includeManagementFee: boolean;
  includeWater: boolean;
  includeElectricity: boolean;
  includeParkingFee: boolean;
  grandTotal: number; // Tổng cộng phải trả
}

export interface ApartmentExpenseReport {
  config: ApartmentConfig;
  totalApplianceKwh: number;
  sharedKwh: number;
  totalElectricityCostWithVat: number;
  effectiveKwhPrice: number; // Đơn giá điện trung bình thực tế / kWh
  totalWaterCostBeforeTax: number; // Tiền nước trước thuế & phí
  waterVatAmount: number; // Thuế VAT nước
  waterBvmtAmount: number; // Phí bảo vệ môi trường nước
  totalWaterCost: number; // Tổng tiền nước sau VAT & BVMT
  totalManagementCost: number;
  autoLivingRoomM2: number; // Diện tích phòng khách / dùng chung (tự động = Tổng diện tích - Tổng diện tích riêng)
  sharedLivingRoomPerMember: number; // Diện tích dùng chung chia cho từng người
  totalPrivateArea: number; // Tổng diện tích phòng riêng của tất cả thành viên
  breakdowns: MemberExpenseBreakdown[];
}

// ----------------------------------------------------
// TÍNH TOÁN TIỀN ĐIỆN THEO BẬC THANG EVN
// ----------------------------------------------------
export function calculateEVNElectricityCost(totalKwh: number, vatPercent: number = 8): { costBeforeVat: number; vatAmount: number; totalCost: number; tierDetails: Array<{ tier: number; kwh: number; price: number; amount: number }> } {
  if (totalKwh <= 0) return { costBeforeVat: 0, vatAmount: 0, totalCost: 0, tierDetails: [] };

  let remainingKwh = totalKwh;
  let costBeforeVat = 0;
  const tierDetails = [];

  for (const tier of DEFAULT_EVN_TIERS) {
    if (remainingKwh <= 0) break;

    const tierCapacity = tier.maxKwh ? (tier.maxKwh - tier.minKwh) : Infinity;
    const kwhInTier = Math.min(remainingKwh, tierCapacity);
    const amount = kwhInTier * tier.pricePerKwh;

    costBeforeVat += amount;
    tierDetails.push({
      tier: tier.tier,
      kwh: kwhInTier,
      price: tier.pricePerKwh,
      amount
    });

    remainingKwh -= kwhInTier;
  }

  const vatAmount = (costBeforeVat * vatPercent) / 100;
  const totalCost = costBeforeVat + vatAmount;

  return { costBeforeVat, vatAmount, totalCost, tierDetails };
}

// ----------------------------------------------------
// TÍNH TOÁN PHÂN BỔ KWH THIẾT BỊ ĐIỆN THEO MỐC DÙNG CHUNG
// ----------------------------------------------------
export function calculateApplianceKwhSplit(app: SpecialAppliance): Record<string, number> {
  const totalKwh = app.kwhConsumed || 0;
  const assignedIds = app.assignedUserIds || [];
  const result: Record<string, number> = {};

  if (totalKwh <= 0 || assignedIds.length === 0) {
    return result;
  }

  assignedIds.forEach(id => { result[id] = 0; });

  const memberCaps = app.memberCaps || {};

  // Lấy mốc giới hạn kWh của từng người (nếu không khai báo thì mặc định = totalKwh)
  const capsMap: Array<{ userId: string; cap: number }> = assignedIds.map(id => {
    const rawCap = memberCaps[id];
    const cap = rawCap !== undefined && rawCap !== null && rawCap > 0 ? Math.min(rawCap, totalKwh) : totalKwh;
    return { userId: id, cap };
  });

  // Tìm các mốc kWh duy nhất tăng dần [0, t1, t2, ..., totalKwh]
  const uniqueThresholds = Array.from(
    new Set([0, ...capsMap.map(c => c.cap), totalKwh])
  ).sort((a, b) => a - b);

  // Chia khoảng [t_{j-1}, t_j]
  for (let j = 1; j < uniqueThresholds.length; j++) {
    const prevT = uniqueThresholds[j - 1];
    const currT = uniqueThresholds[j];
    const delta = currT - prevT;
    if (delta <= 0) continue;

    // Các thành viên còn sử dụng ở khoảng này (cap >= currT)
    const activeMembers = capsMap.filter(c => c.cap >= currT);
    const activeCount = activeMembers.length;

    if (activeCount > 0) {
      const sharePerActive = delta / activeCount;
      activeMembers.forEach(m => {
        result[m.userId] = (result[m.userId] || 0) + sharePerActive;
      });
    }
  }

  return result;
}

// ----------------------------------------------------
// CÔNG CỤ TÍNH TOÁN CHI PHÍ CĂN HỘ TỔNG THỂ (CALCULATION ENGINE)
// ----------------------------------------------------
export function calculateApartmentExpenses(
  config: ApartmentConfig,
  members: MemberSpaceAllocation[],
  appliances: SpecialAppliance[]
): ApartmentExpenseReport {
  const memberCount = members.length || 1;

  // 1. Tính tổng điện & đơn giá hiệu dụng
  let totalElectricityCostWithVat = 0;
  if (config.electricityPricingMode === 'evn_progressive') {
    const evnResult = calculateEVNElectricityCost(config.electricityTotalKwh, config.vatPercentage);
    totalElectricityCostWithVat = evnResult.totalCost;
  } else {
    const baseCost = config.electricityTotalKwh * config.electricityFeePerKwh;
    totalElectricityCostWithVat = baseCost * (1 + config.vatPercentage / 100);
  }

  const effectiveKwhPrice = config.electricityTotalKwh > 0
    ? totalElectricityCostWithVat / config.electricityTotalKwh
    : 0;

  // 2. Tính tổng kWh thiết bị đặc thù
  const totalApplianceKwh = appliances.reduce((sum, app) => sum + (app.kwhConsumed || 0), 0);
  const sharedKwh = Math.max(0, config.electricityTotalKwh - totalApplianceKwh);

  // 3. Tính tổng số ngày ở của tất cả thành viên
  const totalActiveDays = members.reduce((sum, m) => sum + (m.activeDaysInMonth || 0), 0) || 1;

  // 4. Tổng nước (Tiền nước trước thuế + VAT Nước + Phí BVMT) & Phí quản lý căn hộ
  const waterVatPct = config.waterVatPercentage !== undefined ? config.waterVatPercentage : 5;
  const waterBvmtPct = config.waterBvmtPercentage !== undefined ? config.waterBvmtPercentage : 10;

  const totalWaterCostBeforeTax = config.waterTotalM3 * config.waterFeePerM3;
  const waterVatAmount = (totalWaterCostBeforeTax * waterVatPct) / 100;
  const waterBvmtAmount = (totalWaterCostBeforeTax * waterBvmtPct) / 100;
  const totalWaterCost = totalWaterCostBeforeTax + waterVatAmount + waterBvmtAmount;

  const totalManagementCost = config.totalAreaM2 * config.managementFeePerM2;

  // 5. Tự động tính diện tích dùng chung (Phòng khách = Tổng diện tích căn hộ - Tổng diện tích riêng)
  const totalPrivateArea = members.reduce((sum, m) => sum + (m.bedroomM2 || 0) + (m.bathroomM2 || 0), 0);
  const autoLivingRoomM2 = Math.max(0, config.totalAreaM2 - totalPrivateArea);
  const sharedLivingRoomPerMember = autoLivingRoomM2 / memberCount;

  // 6. Tính toán chi tiết cho từng thành viên
  const breakdowns: MemberExpenseBreakdown[] = members.map(member => {
    // Trạng thái bật/tắt từng khoản phí của thành viên (mặc định true)
    const includeRent = member.includeRent !== false;
    const includeManagementFee = member.includeManagementFee !== false;
    const includeWater = member.includeWater !== false;
    const includeElectricity = member.includeElectricity !== false;
    const includeParkingFee = member.includeParkingFee !== false;

    // a. Diện tích quy đổi cá nhân = Diện tích phòng riêng + (Diện tích dùng chung tự động / số người)
    const privateArea = (member.bedroomM2 || 0) + (member.bathroomM2 || 0);
    const allocatedAreaM2 = privateArea + sharedLivingRoomPerMember;

    // b. Tiền thuê nhà theo tỷ lệ diện tích quy đổi
    const rawRentShare = config.totalAreaM2 > 0
      ? (config.apartmentRent * allocatedAreaM2) / config.totalAreaM2
      : config.apartmentRent / memberCount;
    const rentShare = includeRent ? rawRentShare : 0;

    // c. Phí quản lý
    const rawManagementFeeShare = allocatedAreaM2 * config.managementFeePerM2;
    const managementFeeShare = includeManagementFee ? rawManagementFeeShare : 0;

    // d. Tiền nước theo tỷ lệ số ngày ở trong tháng
    const activeDays = member.activeDaysInMonth !== undefined && member.activeDaysInMonth !== null ? Math.max(0, member.activeDaysInMonth) : 30;
    const rawWaterShare = activeDays > 0 ? (totalWaterCost * activeDays) / totalActiveDays : 0;
    const waterShare = includeWater ? rawWaterShare : 0;

    // e. Tiền điện thiết bị đặc thù (Tính theo mốc kWh dừng sử dụng nếu có)
    let rawApplianceElectricityShare = 0;
    appliances.forEach(app => {
      if (app.assignedUserIds.includes(member.userId) && app.assignedUserIds.length > 0) {
        const splitMap = calculateApplianceKwhSplit(app);
        const kwhForMember = splitMap[member.userId] || 0;
        rawApplianceElectricityShare += kwhForMember * effectiveKwhPrice;
      }
    });

    // f. Tiền điện dùng chung (hoặc công tơ riêng)
    let rawSharedElectricityShare = 0;
    if (member.customElectricityKwh !== null && member.customElectricityKwh > 0) {
      rawSharedElectricityShare = member.customElectricityKwh * effectiveKwhPrice;
    } else {
      rawSharedElectricityShare = (sharedKwh * effectiveKwhPrice * activeDays) / totalActiveDays;
    }

    const rawTotalElectricityShare = rawApplianceElectricityShare + rawSharedElectricityShare;
    const totalElectricityShare = includeElectricity ? rawTotalElectricityShare : 0;
    const applianceElectricityShare = includeElectricity ? rawApplianceElectricityShare : 0;
    const sharedElectricityShare = includeElectricity ? rawSharedElectricityShare : 0;

    // g. Phí gửi xe
    const rawParkingShare = member.vehiclesCount * config.parkingFeePerVehicle;
    const parkingShare = includeParkingFee ? rawParkingShare : 0;

    // h. Tổng tiền
    const grandTotal = rentShare + managementFeeShare + waterShare + totalElectricityShare + parkingShare;

    return {
      userId: member.userId,
      memberName: member.memberName,
      avatarUrl: member.avatarUrl,
      allocatedAreaM2,
      activeDays,
      rentShare,
      managementFeeShare,
      waterShare,
      applianceElectricityShare,
      sharedElectricityShare,
      totalElectricityShare,
      parkingShare,
      includeRent,
      includeManagementFee,
      includeWater,
      includeElectricity,
      includeParkingFee,
      grandTotal
    };
  });

  return {
    config,
    totalApplianceKwh,
    sharedKwh,
    totalElectricityCostWithVat,
    effectiveKwhPrice,
    totalWaterCostBeforeTax,
    waterVatAmount,
    waterBvmtAmount,
    totalWaterCost,
    totalManagementCost,
    autoLivingRoomM2,
    sharedLivingRoomPerMember,
    totalPrivateArea,
    breakdowns
  };
}

// ----------------------------------------------------
// QUẢN LÝ LƯU TRỮ VÀ ĐỒNG BỘ PERSISTENCE
// ----------------------------------------------------
const STORAGE_PREFIX = 'group_apartment_expenses_';

export function getStoredApartmentConfig(groupId: string): ApartmentConfig {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}config_${groupId}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        waterVatPercentage: 5,
        waterBvmtPercentage: 10,
        ...parsed
      };
    } catch (e) {
      console.error('Error parsing stored config', e);
    }
  }
  return {
    groupId,
    totalAreaM2: 75,
    managementFeePerM2: 12000,
    waterFeePerM3: 18000,
    waterTotalM3: 15,
    waterVatPercentage: 5,
    waterBvmtPercentage: 10,
    electricityPricingMode: 'evn_progressive',
    electricityFeePerKwh: 2500,
    electricityTotalKwh: 350,
    vatPercentage: 8,
    parkingFeePerVehicle: 120000,
    apartmentRent: 10000000,
    billingMonth: new Date().toISOString().substring(0, 7),
  };
}

export function saveApartmentConfig(config: ApartmentConfig): void {
  localStorage.setItem(`${STORAGE_PREFIX}config_${config.groupId}`, JSON.stringify(config));
}

export function getStoredSpaceAllocations(groupId: string, defaultMembers: Array<{ userId: string; name: string; avatarUrl?: string }>): MemberSpaceAllocation[] {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}allocations_${groupId}`);
  if (stored) {
    try {
      const parsed: MemberSpaceAllocation[] = JSON.parse(stored);
      // Merge with default members in case members changed
      return defaultMembers.map(dm => {
        const existing = parsed.find(p => p.userId === dm.userId);
        if (existing) {
          return {
            ...existing,
            memberName: dm.name,
            avatarUrl: dm.avatarUrl,
            includeRent: existing.includeRent !== false,
            includeManagementFee: existing.includeManagementFee !== false,
            includeWater: existing.includeWater !== false,
            includeElectricity: existing.includeElectricity !== false,
            includeParkingFee: existing.includeParkingFee !== false
          };
        }
        return {
          userId: dm.userId,
          memberName: dm.name,
          avatarUrl: dm.avatarUrl,
          livingRoomM2: 25,
          bedroomM2: 15,
          bathroomM2: 6,
          activeDaysInMonth: 30,
          customElectricityKwh: null,
          vehiclesCount: 1,
          includeRent: true,
          includeManagementFee: true,
          includeWater: true,
          includeElectricity: true,
          includeParkingFee: true,
        };
      });
    } catch (e) {
      console.error('Error parsing stored allocations', e);
    }
  }
  return defaultMembers.map(dm => ({
    userId: dm.userId,
    memberName: dm.name,
    avatarUrl: dm.avatarUrl,
    livingRoomM2: 25,
    bedroomM2: 15,
    bathroomM2: 6,
    activeDaysInMonth: 30,
    customElectricityKwh: null,
    vehiclesCount: 1,
    includeRent: true,
    includeManagementFee: true,
    includeWater: true,
    includeElectricity: true,
    includeParkingFee: true,
  }));
}

export function saveSpaceAllocations(groupId: string, allocations: MemberSpaceAllocation[]): void {
  localStorage.setItem(`${STORAGE_PREFIX}allocations_${groupId}`, JSON.stringify(allocations));
}

export function getStoredSpecialAppliances(groupId: string): SpecialAppliance[] {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}appliances_${groupId}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing stored appliances', e);
    }
  }
  return [
    {
      id: 'app-1',
      name: 'Máy lạnh Phòng ngủ 1',
      kwhConsumed: 120,
      assignedUserIds: [],
    }
  ];
}

export function saveSpecialAppliances(groupId: string, appliances: SpecialAppliance[]): void {
  localStorage.setItem(`${STORAGE_PREFIX}appliances_${groupId}`, JSON.stringify(appliances));
}

// ----------------------------------------------------
// DỒNG BỘ DỮ LIỆU HAI CHIỀU VỚI SUPABASE DATABASE
// ----------------------------------------------------

export async function fetchApartmentConfigFromDb(groupId: string): Promise<ApartmentConfig | null> {
  try {
    const { data, error } = await supabase
      .from('apartment_configs')
      .select('*')
      .eq('group_id', groupId)
      .maybeSingle();

    if (error || !data) return getStoredApartmentConfig(groupId);

    const config: ApartmentConfig = {
      groupId: data.group_id,
      totalAreaM2: Number(data.total_area_m2),
      managementFeePerM2: Number(data.management_fee_per_m2),
      waterFeePerM3: Number(data.water_fee_per_m3),
      waterTotalM3: Number(data.water_total_m3),
      waterVatPercentage: data.water_vat_percentage !== undefined ? Number(data.water_vat_percentage) : 5,
      waterBvmtPercentage: data.water_bvmt_percentage !== undefined ? Number(data.water_bvmt_percentage) : 10,
      electricityPricingMode: data.electricity_pricing_mode,
      electricityFeePerKwh: Number(data.electricity_fee_per_kwh),
      electricityTotalKwh: Number(data.electricity_total_kwh),
      vatPercentage: Number(data.vat_percentage),
      parkingFeePerVehicle: Number(data.parking_fee_per_vehicle),
      apartmentRent: Number(data.apartment_rent),
      billingMonth: data.billing_month,
    };
    saveApartmentConfig(config); // Cache locally
    return config;
  } catch (err) {
    console.warn('Could not fetch apartment config from Supabase, using local fallback:', err);
    return getStoredApartmentConfig(groupId);
  }
}

export async function saveApartmentConfigToDb(config: ApartmentConfig): Promise<void> {
  saveApartmentConfig(config); // Local first
  try {
    await supabase.from('apartment_configs').upsert({
      group_id: config.groupId,
      total_area_m2: config.totalAreaM2,
      management_fee_per_m2: config.managementFeePerM2,
      water_fee_per_m3: config.waterFeePerM3,
      water_total_m3: config.waterTotalM3,
      water_vat_percentage: config.waterVatPercentage,
      water_bvmt_percentage: config.waterBvmtPercentage,
      electricity_pricing_mode: config.electricityPricingMode,
      electricity_fee_per_kwh: config.electricityFeePerKwh,
      electricity_total_kwh: config.electricityTotalKwh,
      vat_percentage: config.vatPercentage,
      parking_fee_per_vehicle: config.parkingFeePerVehicle,
      apartment_rent: config.apartmentRent,
      billing_month: config.billingMonth,
      updated_at: new Date().toISOString()
    }, { onConflict: 'group_id' });
  } catch (err) {
    console.warn('Could not save apartment config to Supabase:', err);
  }
}

export async function fetchSpaceAllocationsFromDb(
  groupId: string,
  defaultMembers: Array<{ userId: string; name: string; avatarUrl?: string }>
): Promise<MemberSpaceAllocation[]> {
  try {
    const { data, error } = await supabase
      .from('member_space_allocations')
      .select('*')
      .eq('group_id', groupId);

    if (error || !data || data.length === 0) return getStoredSpaceAllocations(groupId, defaultMembers);

    const allocations: MemberSpaceAllocation[] = defaultMembers.map(dm => {
      const existing = data.find((row: any) => row.user_id === dm.userId);
      if (existing) {
        return {
          userId: dm.userId,
          memberName: dm.name,
          avatarUrl: dm.avatarUrl,
          livingRoomM2: Number(existing.living_room_m2),
          bedroomM2: Number(existing.bedroom_m2),
          bathroomM2: Number(existing.bathroom_m2),
          activeDaysInMonth: Number(existing.active_days_in_month),
          customElectricityKwh: existing.custom_electricity_kwh !== null ? Number(existing.custom_electricity_kwh) : null,
          vehiclesCount: Number(existing.vehicles_count),
          includeRent: existing.include_rent !== false,
          includeManagementFee: existing.include_management_fee !== false,
          includeWater: existing.include_water !== false,
          includeElectricity: existing.include_electricity !== false,
          includeParkingFee: existing.include_parking_fee !== false
        };
      }
      return {
        userId: dm.userId,
        memberName: dm.name,
        avatarUrl: dm.avatarUrl,
        livingRoomM2: 25,
        bedroomM2: 15,
        bathroomM2: 6,
        activeDaysInMonth: 30,
        customElectricityKwh: null,
        vehiclesCount: 1,
        includeRent: true,
        includeManagementFee: true,
        includeWater: true,
        includeElectricity: true,
        includeParkingFee: true
      };
    });

    saveSpaceAllocations(groupId, allocations);
    return allocations;
  } catch (err) {
    console.warn('Could not fetch space allocations from Supabase, using local fallback:', err);
    return getStoredSpaceAllocations(groupId, defaultMembers);
  }
}

export async function saveSpaceAllocationsToDb(groupId: string, allocations: MemberSpaceAllocation[]): Promise<void> {
  saveSpaceAllocations(groupId, allocations);
  try {
    const rows = allocations.map(a => ({
      group_id: groupId,
      user_id: a.userId,
      living_room_m2: a.livingRoomM2,
      bedroom_m2: a.bedroomM2,
      bathroom_m2: a.bathroomM2,
      active_days_in_month: a.activeDaysInMonth,
      custom_electricity_kwh: a.customElectricityKwh,
      vehicles_count: a.vehiclesCount,
      include_rent: a.includeRent !== false,
      include_management_fee: a.includeManagementFee !== false,
      include_water: a.includeWater !== false,
      include_electricity: a.includeElectricity !== false,
      include_parking_fee: a.includeParkingFee !== false,
      updated_at: new Date().toISOString()
    }));
    await supabase.from('member_space_allocations').upsert(rows, { onConflict: 'group_id,user_id' });
  } catch (err) {
    console.warn('Could not save space allocations to Supabase:', err);
  }
}

export async function fetchSpecialAppliancesFromDb(groupId: string): Promise<SpecialAppliance[]> {
  try {
    const { data, error } = await supabase
      .from('special_appliances')
      .select('*')
      .eq('group_id', groupId);

    if (error || !data || data.length === 0) return getStoredSpecialAppliances(groupId);

    const appliances: SpecialAppliance[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      kwhConsumed: Number(row.kwh_consumed),
      assignedUserIds: Array.isArray(row.assigned_user_ids) ? row.assigned_user_ids : [],
      memberCaps: row.member_caps || {}
    }));

    saveSpecialAppliances(groupId, appliances);
    return appliances;
  } catch (err) {
    console.warn('Could not fetch special appliances from Supabase, using local fallback:', err);
    return getStoredSpecialAppliances(groupId);
  }
}

export async function saveSpecialAppliancesToDb(groupId: string, appliances: SpecialAppliance[]): Promise<void> {
  saveSpecialAppliances(groupId, appliances);
  try {
    // 1. Tìm các ID trong DB đã bị xóa từ UI để xóa trên Supabase
    const { data: existingDbItems } = await supabase
      .from('special_appliances')
      .select('id')
      .eq('group_id', groupId);

    const activeIds = appliances
      .map(a => a.id)
      .filter(id => id && !id.startsWith('app-'));

    if (existingDbItems && existingDbItems.length > 0) {
      const idsToDelete = existingDbItems
        .map(item => item.id)
        .filter(id => !activeIds.includes(id));

      if (idsToDelete.length > 0) {
        await supabase
          .from('special_appliances')
          .delete()
          .in('id', idsToDelete);
      }
    }

    // 2. Upsert danh sách thiết bị bao gồm memberCaps mốc kWh
    if (appliances.length > 0) {
      const rowsToUpsert = appliances.map(a => {
        const row: any = {
          group_id: groupId,
          name: a.name,
          kwh_consumed: a.kwhConsumed,
          assigned_user_ids: a.assignedUserIds || [],
          member_caps: a.memberCaps || {},
          updated_at: new Date().toISOString()
        };
        if (a.id && !a.id.startsWith('app-')) {
          row.id = a.id;
        }
        return row;
      });

      const { data: upsertedData, error } = await supabase
        .from('special_appliances')
        .upsert(rowsToUpsert)
        .select();

      if (error) {
        console.warn('Supabase special_appliances error (vui lòng chạy script SQL mới):', error);
      } else if (upsertedData) {
        const syncedAppliances: SpecialAppliance[] = upsertedData.map((row: any) => ({
          id: row.id,
          name: row.name,
          kwhConsumed: Number(row.kwh_consumed),
          assignedUserIds: Array.isArray(row.assigned_user_ids) ? row.assigned_user_ids : [],
          memberCaps: row.member_caps || {}
        }));
        saveSpecialAppliances(groupId, syncedAppliances);
      }
    }
  } catch (err) {
    console.warn('Could not save special appliances to Supabase:', err);
  }
}
