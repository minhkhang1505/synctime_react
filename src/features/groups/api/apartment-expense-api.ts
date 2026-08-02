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
  electricityPricingMode: 'evn_progressive' | 'flat_rate';
  electricityFeePerKwh: number; // Nếu dùng flat rate
  electricityTotalKwh: number; // Tổng số kWh điện cả căn hộ
  vatPercentage: number; // VAT % (mặc định 8%)
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
}

export interface SpecialAppliance {
  id: string;
  name: string; // Tên thiết bị: Máy lạnh P1, PC Gaming...
  kwhConsumed: number; // Số kWh tiêu thụ
  assignedUserIds: string[]; // Danh sách ID các thành viên sử dụng thiết bị
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
  grandTotal: number; // Tổng cộng phải trả
}

export interface ApartmentExpenseReport {
  config: ApartmentConfig;
  totalApplianceKwh: number;
  sharedKwh: number;
  totalElectricityCostWithVat: number;
  effectiveKwhPrice: number; // Đơn giá điện trung bình thực tế / kWh
  totalWaterCost: number;
  totalManagementCost: number;
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

  // 4. Tổng nước & quản lý
  const totalWaterCost = config.waterTotalM3 * config.waterFeePerM3;

  // 5. Tính toán chi tiết cho từng thành viên
  const breakdowns: MemberExpenseBreakdown[] = members.map(member => {
    // a. Diện tích quy đổi: Phòng ngủ riêng + (Phòng khách + WC dùng chung / số người)
    const sharedAreaPart = (member.livingRoomM2 + member.bathroomM2) / memberCount;
    const allocatedAreaM2 = member.bedroomM2 + sharedAreaPart;

    // b. Tiền thuê nhà theo tỷ lệ diện tích quy đổi
    const rentShare = config.totalAreaM2 > 0
      ? (config.apartmentRent * allocatedAreaM2) / config.totalAreaM2
      : config.apartmentRent / memberCount;

    // c. Phí quản lý
    const managementFeeShare = allocatedAreaM2 * config.managementFeePerM2;

    // d. Tiền nước theo tỷ lệ số ngày ở trong tháng
    const activeDays = member.activeDaysInMonth > 0 ? member.activeDaysInMonth : 30;
    const waterShare = (totalWaterCost * activeDays) / totalActiveDays;

    // e. Tiền điện thiết bị đặc thù
    let applianceElectricityShare = 0;
    appliances.forEach(app => {
      if (app.assignedUserIds.includes(member.userId) && app.assignedUserIds.length > 0) {
        const appCost = app.kwhConsumed * effectiveKwhPrice;
        applianceElectricityShare += appCost / app.assignedUserIds.length;
      }
    });

    // f. Tiền điện dùng chung (hoặc công tơ riêng)
    let sharedElectricityShare = 0;
    if (member.customElectricityKwh !== null && member.customElectricityKwh > 0) {
      sharedElectricityShare = member.customElectricityKwh * effectiveKwhPrice;
    } else {
      sharedElectricityShare = (sharedKwh * effectiveKwhPrice * activeDays) / totalActiveDays;
    }

    const totalElectricityShare = applianceElectricityShare + sharedElectricityShare;

    // g. Phí gửi xe
    const parkingShare = member.vehiclesCount * config.parkingFeePerVehicle;

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
      grandTotal
    };
  });

  const totalManagementCost = breakdowns.reduce((sum, b) => sum + b.managementFeeShare, 0);

  return {
    config,
    totalApplianceKwh,
    sharedKwh,
    totalElectricityCostWithVat,
    effectiveKwhPrice,
    totalWaterCost,
    totalManagementCost,
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
      return JSON.parse(stored);
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
          return { ...existing, memberName: dm.name, avatarUrl: dm.avatarUrl };
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
