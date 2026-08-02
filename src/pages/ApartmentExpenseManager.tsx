import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { fetchUserGroups, fetchGroupMembers } from '../features/groups/api/groups-api';
import {
  ApartmentConfig,
  MemberSpaceAllocation,
  SpecialAppliance,
  DEFAULT_EVN_TIERS,
  calculateApartmentExpenses,
  calculateEVNElectricityCost,
  getStoredApartmentConfig,
  saveApartmentConfig,
  getStoredSpaceAllocations,
  saveSpaceAllocations,
  getStoredSpecialAppliances,
  saveSpecialAppliances
} from '../features/groups/api/apartment-expense-api';
import {
  ArrowLeft,
  Settings,
  Users,
  Zap,
  PieChart,
  Plus,
  Trash2,
  Check,
  Calendar,
  DollarSign,
  Sliders,
  Copy,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Tv
} from 'lucide-react';
import toast from 'react-hot-toast';

// ----------------------------------------------------
// NORMALIZE & FORMAT NUMBER HELPER (VIETNAMESE LOCALE)
// ----------------------------------------------------
export function formatVNNumber(val: number | null | undefined, maxDecimals: number = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0
  }).format(val);
}

export function formatVND(amount: number): string {
  if (isNaN(amount)) return '0 đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.round(amount));
}

// ----------------------------------------------------
// INPUT FIELD COMPONENT SUPPORTING FORMATTED NUMBERS & DECIMALS
// ----------------------------------------------------
interface FormattedNumberInputProps {
  value: number | null | undefined;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

function FormattedNumberInput({
  value,
  onChange,
  className = '',
  placeholder = '0',
  disabled = false
}: FormattedNumberInputProps) {
  const [inputValue, setInputValue] = useState<string>(() =>
    value !== undefined && value !== null && !isNaN(value) ? formatVNNumber(value) : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(value !== undefined && value !== null && !isNaN(value) ? formatVNNumber(value) : '');
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawStr = e.target.value;
    setInputValue(rawStr);

    // Xóa dấu chấm (phân cách hàng nghìn) và thay dấu phẩy bằng dấu chấm cho float parsing
    const cleanStr = rawStr.replace(/\./g, '').replace(/,/g, '.');
    const parsed = parseFloat(cleanStr);

    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (rawStr === '') {
      onChange(0);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value !== undefined && value !== null && !isNaN(value)) {
      setInputValue(formatVNNumber(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={inputValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}

export function ApartmentExpenseManager() {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'config' | 'members' | 'appliances' | 'report'>('report');

  // Fetch Group Info
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: fetchUserGroups
  });
  const group = groups?.find(g => g.id === groupId);

  // Fetch Members
  const { data: rawMembers, isLoading: isMembersLoading } = useQuery({
    queryKey: ['group_members', groupId],
    queryFn: () => fetchGroupMembers(groupId!),
    enabled: !!groupId
  });

  const isOwner = group?.created_by === user?.id;

  // Form States
  const [config, setConfig] = useState<ApartmentConfig>(() =>
    groupId ? getStoredApartmentConfig(groupId) : ({} as ApartmentConfig)
  );

  const defaultMemberList = useMemo(() => {
    if (!rawMembers) return [];
    return rawMembers.map(m => ({
      userId: m.user_id,
      name: m.profiles.full_name || 'Người dùng ẩn danh',
      avatarUrl: m.profiles.avatar_url || undefined
    }));
  }, [rawMembers]);

  const [allocations, setAllocations] = useState<MemberSpaceAllocation[]>([]);
  const [appliances, setAppliances] = useState<SpecialAppliance[]>([]);

  // Modal State for adding/editing appliance
  const [isApplianceModalOpen, setIsApplianceModalOpen] = useState(false);
  const [editingApplianceId, setEditingApplianceId] = useState<string | null>(null);
  const [applianceName, setApplianceName] = useState('');
  const [applianceKwh, setApplianceKwh] = useState<number>(100);
  const [applianceUsers, setApplianceUsers] = useState<string[]>([]);

  // Load saved data when groupId or defaultMemberList changes
  useEffect(() => {
    if (!groupId) return;
    const loadedConfig = getStoredApartmentConfig(groupId);
    setConfig(loadedConfig);

    if (defaultMemberList.length > 0) {
      const loadedAllocations = getStoredSpaceAllocations(groupId, defaultMemberList);
      setAllocations(loadedAllocations);

      const loadedAppliances = getStoredSpecialAppliances(groupId);
      // Ensure all appliances have valid assignedUserIds
      setAppliances(loadedAppliances.map(a => ({
        ...a,
        assignedUserIds: a.assignedUserIds || []
      })));
    }
  }, [groupId, defaultMemberList]);

  // Save changes
  const handleSaveConfig = (newConfig: ApartmentConfig) => {
    setConfig(newConfig);
    saveApartmentConfig(newConfig);
    toast.success('Đã lưu cấu hình đơn giá căn hộ!');
  };

  const handleSaveAllocations = (newAllocations: MemberSpaceAllocation[]) => {
    setAllocations(newAllocations);
    if (groupId) saveSpaceAllocations(groupId, newAllocations);
    toast.success('Đã cập nhật phân bổ diện tích & số ngày ở!');
  };

  const handleSaveAppliances = (newAppliances: SpecialAppliance[]) => {
    setAppliances(newAppliances);
    if (groupId) saveSpecialAppliances(groupId, newAppliances);
    toast.success('Đã cập nhật danh sách thiết bị điện!');
  };

  const handleToggleMemberParking = (targetUserId: string) => {
    const updated = allocations.map(a => {
      if (a.userId === targetUserId) {
        const currentVal = a.includeParkingFee !== false;
        return { ...a, includeParkingFee: !currentVal };
      }
      return a;
    });
    handleSaveAllocations(updated);
  };

  // Calculation Report
  const report = useMemo(() => {
    if (!config || allocations.length === 0) return null;
    return calculateApartmentExpenses(config, allocations, appliances);
  }, [config, allocations, appliances]);

  // Open Appliance Modal
  const openAddApplianceModal = () => {
    setEditingApplianceId(null);
    setApplianceName('');
    setApplianceKwh(50);
    setApplianceUsers(defaultMemberList.map(m => m.userId)); // default all assigned
    setIsApplianceModalOpen(true);
  };

  const openEditApplianceModal = (app: SpecialAppliance) => {
    setEditingApplianceId(app.id);
    setApplianceName(app.name);
    setApplianceKwh(app.kwhConsumed);
    setApplianceUsers(app.assignedUserIds);
    setIsApplianceModalOpen(true);
  };

  const handleSaveApplianceModal = () => {
    if (!applianceName.trim()) {
      toast.error('Vui lòng nhập tên thiết bị!');
      return;
    }
    if (applianceKwh < 0) {
      toast.error('Số kWh không thể âm!');
      return;
    }

    let updated: SpecialAppliance[];
    if (editingApplianceId) {
      updated = appliances.map(a =>
        a.id === editingApplianceId
          ? { ...a, name: applianceName, kwhConsumed: applianceKwh, assignedUserIds: applianceUsers }
          : a
      );
    } else {
      const newAppliance: SpecialAppliance = {
        id: `app-${Date.now()}`,
        name: applianceName,
        kwhConsumed: applianceKwh,
        assignedUserIds: applianceUsers
      };
      updated = [...appliances, newAppliance];
    }

    handleSaveAppliances(updated);
    setIsApplianceModalOpen(false);
  };

  const handleDeleteAppliance = (id: string) => {
    const updated = appliances.filter(a => a.id !== id);
    handleSaveAppliances(updated);
  };

  // Copy Summary to Clipboard
  const handleCopySummaryText = () => {
    if (!report || !group) return;

    let text = `🏠 *BẢNG TÍNH CHI PHÍ CĂN HỘ - ${group.name.toUpperCase()}*\n`;
    text += `📅 Tháng: ${config.billingMonth}\n`;
    text += `------------------------------------\n`;
    text += `▪ Tổng diện tích căn hộ: ${formatVNNumber(config.totalAreaM2)} m²\n`;
    text += `▪ Tiền thuê căn hộ: ${formatVND(config.apartmentRent)}\n`;
    text += `▪ Phí quản lý (${formatVNNumber(config.totalAreaM2)}m²): ${formatVND(report.totalManagementCost)}\n`;
    text += `▪ Tiền điện (${formatVNNumber(config.electricityTotalKwh)} kWh): ${formatVND(report.totalElectricityCostWithVat)}\n`;
    text += `▪ Tiền nước (${formatVNNumber(config.waterTotalM3)} m³): ${formatVND(report.totalWaterCost)}\n`;
    text += `------------------------------------\n`;
    text += `📊 *TỔNG THU THEO THÀNH VIÊN:*\n\n`;

    report.breakdowns.forEach((b, idx) => {
      const areaPercent = config.totalAreaM2 > 0 ? (b.allocatedAreaM2 / config.totalAreaM2) * 100 : 0;
      text += `${idx + 1}. *${b.memberName}* (${formatVNNumber(b.allocatedAreaM2)} m² ~ ${formatVNNumber(areaPercent, 1)}% căn hộ | ${b.activeDays} ngày ở):\n`;
      text += `   - Tiền nhà (${formatVNNumber(areaPercent, 1)}%): ${formatVND(b.rentShare)}\n`;
      text += `   - Phí quản lý (${formatVNNumber(b.allocatedAreaM2)}m²): ${formatVND(b.managementFeeShare)}\n`;
      text += `   - Tiền điện: ${formatVND(b.totalElectricityShare)} (Chung: ${formatVND(b.sharedElectricityShare)}${b.applianceElectricityShare > 0 ? ` + TB riêng: ${formatVND(b.applianceElectricityShare)}` : ''})\n`;
      text += `   - Tiền nước: ${formatVND(b.waterShare)}\n`;
      if (b.includeParkingFee && b.parkingShare > 0) {
        text += `   - Phí gửi xe: ${formatVND(b.parkingShare)}\n`;
      } else if (!b.includeParkingFee) {
        text += `   - Phí gửi xe: 0 đ (Tắt / Thanh toán riêng)\n`;
      }
      text += `   👉 *TỔNG CỘNG: ${formatVND(b.grandTotal)}*\n\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép bảng tính chi phí!');
  };

  if (isMembersLoading || !group) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 pb-20">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 mt-4 md:mt-2 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            className="p-2.5 md:p-3 rounded-xl md:rounded-2xl glass text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} className="md:w-6 md:h-6" />
          </button>
          <div>
            <h2 className="text-xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              Quản Lý Chi Phí Căn Hộ
              {isOwner && (
                <span className="text-[11px] md:text-xs font-semibold px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-full flex items-center gap-1">
                  <ShieldCheck size={12} /> Trưởng Nhóm
                </span>
              )}
            </h2>
            <p className="text-xs md:text-sm text-gray-400 truncate max-w-[240px] md:max-w-md">
              Nhóm: <span className="text-white font-medium">{group.name}</span>
            </p>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 glass px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-white/10 shrink-0">
          <Calendar size={16} className="text-primary" />
          <input
            type="month"
            value={config.billingMonth}
            onChange={e => handleSaveConfig({ ...config, billingMonth: e.target.value })}
            className="bg-transparent text-xs md:text-sm font-bold text-white focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Navigation Tabs (Optimized for Mobile Touch) */}
      <div className="grid grid-cols-4 gap-1.5 md:gap-3 p-1.5 glass rounded-2xl md:rounded-3xl border border-white/10 mb-6">
        <button
          onClick={() => setActiveTab('report')}
          className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2.5 md:py-3.5 px-2 rounded-xl md:rounded-2xl text-xs md:text-base font-bold transition-all ${
            activeTab === 'report'
              ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <PieChart size={18} />
          <span className="truncate">Hóa Đơn</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2.5 md:py-3.5 px-2 rounded-xl md:rounded-2xl text-xs md:text-base font-bold transition-all ${
            activeTab === 'config'
              ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings size={18} />
          <span className="truncate">Đơn Giá</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2.5 md:py-3.5 px-2 rounded-xl md:rounded-2xl text-xs md:text-base font-bold transition-all ${
            activeTab === 'members'
              ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users size={18} />
          <span className="truncate">Diện Tích & Ngày</span>
        </button>

        <button
          onClick={() => setActiveTab('appliances')}
          className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2.5 md:py-3.5 px-2 rounded-xl md:rounded-2xl text-xs md:text-base font-bold transition-all ${
            activeTab === 'appliances'
              ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap size={18} />
          <span className="truncate">Thiết Bị Điện</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BÁO CÁO & HÓA ĐƠN THÀNH VIÊN (REPORT & BREAKDOWN) */}
      {/* ========================================================================= */}
      {activeTab === 'report' && report && (
        <div className="space-y-6">
          {/* Summary Overview Cards (5 Cards including Phí Quản Lý) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            <div className="glass p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10 relative overflow-hidden">
              <p className="text-xs md:text-sm text-gray-400 font-medium">Tổng Tiền Căn Hộ</p>
              <p className="text-base md:text-xl font-black text-emerald-400 mt-1 truncate">
                {formatVND(
                  config.apartmentRent +
                  report.totalElectricityCostWithVat +
                  report.totalWaterCost +
                  report.totalManagementCost +
                  report.breakdowns.reduce((sum, b) => sum + b.parkingShare, 0)
                )}
              </p>
              <div className="text-[11px] text-gray-500 mt-1">Gồm nhà, điện, nước, QL, xe</div>
            </div>

            <div className="glass p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10">
              <p className="text-xs md:text-sm text-gray-400 font-medium">Phí Quản Lý Căn Hộ</p>
              <p className="text-base md:text-xl font-black text-blue-400 mt-1 truncate">
                {formatVND(report.totalManagementCost)}
              </p>
              <div className="text-[11px] text-gray-500 mt-1">Đơn giá: {formatVND(config.managementFeePerM2)}/m²</div>
            </div>

            <div className="glass p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10">
              <p className="text-xs md:text-sm text-gray-400 font-medium">Tiền Điện ({formatVNNumber(config.electricityTotalKwh)} kWh)</p>
              <p className="text-base md:text-xl font-black text-amber-400 mt-1 truncate">
                {formatVND(report.totalElectricityCostWithVat)}
              </p>
              <div className="text-[11px] text-amber-400/80 mt-1 font-mono">
                ~{Math.round(report.effectiveKwhPrice).toLocaleString('vi-VN')}đ / kWh
              </div>
            </div>

            <div className="glass p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10">
              <p className="text-xs md:text-sm text-gray-400 font-medium">Tiền Nước ({formatVNNumber(config.waterTotalM3)} m³)</p>
              <p className="text-base md:text-xl font-black text-cyan-400 mt-1 truncate">
                {formatVND(report.totalWaterCost)}
              </p>
              <div className="text-[11px] text-gray-500 mt-1">Đơn giá: {formatVND(config.waterFeePerM3)}/m³</div>
            </div>

            <div className="glass p-4 md:p-5 rounded-2xl md:rounded-3xl border border-white/10 col-span-2 sm:col-span-1">
              <p className="text-xs md:text-sm text-gray-400 font-medium">Tiền Thuê Căn Hộ</p>
              <p className="text-base md:text-xl font-black text-purple-400 mt-1 truncate">
                {formatVND(config.apartmentRent)}
              </p>
              <div className="text-[11px] text-gray-500 mt-1">Diện tích: {formatVNNumber(config.totalAreaM2)} m²</div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <PieChart className="text-primary" size={20} /> Hóa Đơn Chi Tiết Từng Thành Viên
            </h3>
            <button
              onClick={handleCopySummaryText}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs md:text-sm border border-white/10 transition-all active:scale-95 shrink-0"
            >
              <Copy size={16} /> Sao chép hóa đơn gửi nhóm
            </button>
          </div>

          {/* Member Invoices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {report.breakdowns.map((item) => {
              const areaPercent = config.totalAreaM2 > 0 ? (item.allocatedAreaM2 / config.totalAreaM2) * 100 : 0;
              return (
                <div
                  key={item.userId}
                  className="glass p-5 md:p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between shadow-2xl relative"
                >
                  <div>
                    {/* Member Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary/30 to-purple-500/30 border border-white/10 flex items-center justify-center font-bold text-white text-lg overflow-hidden shrink-0">
                          {item.avatarUrl ? (
                            <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            item.memberName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base md:text-lg truncate max-w-[170px]">
                            {item.memberName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 flex-wrap">
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-md font-mono font-bold">
                              {formatVNNumber(item.allocatedAreaM2)}m² ({formatVNNumber(areaPercent, 1)}% căn hộ)
                            </span>
                            <span>•</span>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md">{item.activeDays} ngày ở</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expense Items Breakdown */}
                    <div className="space-y-3 text-xs md:text-sm">
                      <div className="flex justify-between items-start text-gray-300">
                        <div>
                          <span className="text-gray-400 block">Tiền thuê nhà (theo m²):</span>
                          <span className="text-[11px] text-gray-500 font-mono">Tỷ lệ {formatVNNumber(areaPercent, 1)}% căn hộ</span>
                        </div>
                        <span className="font-bold text-white">{formatVND(item.rentShare)}</span>
                      </div>

                      <div className="flex justify-between items-start text-gray-300">
                        <div>
                          <span className="text-gray-400 block">Phí quản lý căn hộ:</span>
                          <span className="text-[11px] text-gray-500 font-mono">{formatVNNumber(item.allocatedAreaM2)}m² x {formatVND(config.managementFeePerM2)}/m²</span>
                        </div>
                        <span className="font-bold text-white">{formatVND(item.managementFeeShare)}</span>
                      </div>

                      <div className="flex justify-between items-center text-gray-300">
                        <span className="text-gray-400">Tiền nước ({item.activeDays} ngày ở):</span>
                        <span className="font-semibold text-cyan-300">{formatVND(item.waterShare)}</span>
                      </div>

                      <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-400 flex items-center gap-1.5">
                            <Zap size={14} /> Tiền điện tổng:
                          </span>
                          <span className="font-bold text-amber-400">{formatVND(item.totalElectricityShare)}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 pl-4 space-y-0.5">
                          <div className="flex justify-between">
                            <span>• Điện dùng chung ({item.activeDays}d):</span>
                            <span>{formatVND(item.sharedElectricityShare)}</span>
                          </div>
                          {item.applianceElectricityShare > 0 && (
                            <div className="flex justify-between text-purple-300">
                              <span>• Thiết bị điện đặc thù:</span>
                              <span>{formatVND(item.applianceElectricityShare)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Parking Fee Toggle Switch Row */}
                      <div className="flex justify-between items-center text-gray-300 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Phí giữ xe:</span>
                          <button
                            type="button"
                            onClick={() => handleToggleMemberParking(item.userId)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              item.includeParkingFee ? 'bg-emerald-500' : 'bg-gray-600'
                            }`}
                            title={item.includeParkingFee ? 'Đang cộng phí xe vào tổng hoá đơn' : 'Đã tắt cộng phí xe vào hóa đơn'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                item.includeParkingFee ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {item.includeParkingFee ? `(Bật)` : '(Tắt)'}
                          </span>
                        </div>
                        <span className={`font-semibold ${item.includeParkingFee ? 'text-white' : 'text-gray-500 line-through'}`}>
                          {item.includeParkingFee ? formatVND(item.parkingShare) : '0 đ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Grand Total Footer */}
                  <div className="mt-5 pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs md:text-sm font-bold text-gray-300 uppercase tracking-wider">Tổng cộng:</span>
                    <span className="text-xl md:text-2xl font-black text-emerald-400">
                      {formatVND(item.grandTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CẤU HÌNH ĐƠN GIÁ CĂN HỘ (CONFIG) */}
      {/* ========================================================================= */}
      {activeTab === 'config' && (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column: Form Controls */}
          <div className="lg:col-span-7 glass p-6 md:p-8 rounded-3xl border border-white/10 space-y-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Sliders className="text-primary" size={20} /> Thiết Lập Đơn Giá & Thông Số Căn Hộ
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Diện tích căn hộ (m²)</label>
                <FormattedNumberInput
                  value={config.totalAreaM2}
                  onChange={val => setConfig({ ...config, totalAreaM2: val })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Tiền thuê căn hộ / tháng (VNĐ)</label>
                <FormattedNumberInput
                  value={config.apartmentRent}
                  onChange={val => setConfig({ ...config, apartmentRent: val })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Phí quản lý / m² (VNĐ)</label>
                <FormattedNumberInput
                  value={config.managementFeePerM2}
                  onChange={val => setConfig({ ...config, managementFeePerM2: val })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Phí nước / m³ (VNĐ)</label>
                <FormattedNumberInput
                  value={config.waterFeePerM3}
                  onChange={val => setConfig({ ...config, waterFeePerM3: val })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Tổng số m³ nước tháng này</label>
                <FormattedNumberInput
                  value={config.waterTotalM3}
                  onChange={val => setConfig({ ...config, waterTotalM3: val })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Phí gửi 1 xe / tháng (VNĐ)</label>
                <FormattedNumberInput
                  value={config.parkingFeePerVehicle}
                  onChange={val => setConfig({ ...config, parkingFeePerVehicle: val })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <label className="block text-xs font-semibold text-amber-400 mb-2">Chế độ tính tiền điện</label>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, electricityPricingMode: 'evn_progressive' })}
                  className={`py-3 px-4 rounded-xl border text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    config.electricityPricingMode === 'evn_progressive'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg'
                      : 'bg-black/20 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <Sparkles size={16} /> Biểu giá EVN 6 Bậc Realtime
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, electricityPricingMode: 'flat_rate' })}
                  className={`py-3 px-4 rounded-xl border text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    config.electricityPricingMode === 'flat_rate'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-lg'
                      : 'bg-black/20 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <DollarSign size={16} /> Giá Cố Định / kWh
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Tổng số kWh điện cả căn hộ</label>
                  <FormattedNumberInput
                    value={config.electricityTotalKwh}
                    onChange={val => setConfig({ ...config, electricityTotalKwh: val })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                {config.electricityPricingMode === 'flat_rate' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Đơn giá điện (VNĐ/kWh)</label>
                    <FormattedNumberInput
                      value={config.electricityFeePerKwh}
                      onChange={val => setConfig({ ...config, electricityFeePerKwh: val })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">Thuế VAT điện (%)</label>
                    <FormattedNumberInput
                      value={config.vatPercentage}
                      onChange={val => setConfig({ ...config, vatPercentage: val })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => handleSaveConfig(config)}
              className="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2"
            >
              <Check size={18} /> Lưu Cấu Hình Đơn Giá
            </button>
          </div>

          {/* Right Column: EVN Tariff Viewer */}
          <div className="lg:col-span-5 glass p-6 md:p-8 rounded-3xl border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-amber-400 flex items-center gap-2">
                  <Zap size={18} /> Biểu Giá Điện Sinh Hoạt EVN (QĐ 1416)
                </h4>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Realtime Sync
                </span>
              </div>

              <div className="space-y-2 mb-6">
                {DEFAULT_EVN_TIERS.map(tier => (
                  <div key={tier.tier} className="flex justify-between items-center p-2.5 bg-black/30 rounded-xl border border-white/5 text-xs">
                    <span className="font-semibold text-gray-300">{tier.name}</span>
                    <span className="font-mono font-bold text-amber-300">{formatVNNumber(tier.pricePerKwh)} đ/kWh</span>
                  </div>
                ))}
              </div>

              {/* Simulation Result */}
              {config.electricityPricingMode === 'evn_progressive' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2 text-xs">
                  <div className="font-bold text-amber-300 text-sm">Kết quả tính điện bậc thang tháng này:</div>
                  {(() => {
                    const res = calculateEVNElectricityCost(config.electricityTotalKwh, config.vatPercentage);
                    return (
                      <>
                        <div className="flex justify-between text-gray-300">
                          <span>• Tổng kWh:</span>
                          <span className="font-bold text-white">{formatVNNumber(config.electricityTotalKwh)} kWh</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>• Tiền điện trước VAT:</span>
                          <span>{formatVND(res.costBeforeVat)}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>• Thuế VAT ({formatVNNumber(config.vatPercentage)}%):</span>
                          <span>{formatVND(res.vatAmount)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-amber-300 text-sm pt-2 border-t border-amber-500/20">
                          <span>👉 Tổng cộng tiền điện:</span>
                          <span>{formatVND(res.totalCost)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PHÂN BỔ DIỆN TÍCH & SỐ NGÀY Ở (MEMBERS) */}
      {/* ========================================================================= */}
      {activeTab === 'members' && report && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Users className="text-primary" size={20} /> Phân Bổ Diện Tích Phòng & Số Ngày Ở
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Trưởng nhóm nhập diện tích phòng riêng của từng người. Diện tích phòng khách / dùng chung sẽ tự động chia đều.
              </p>
            </div>
            <button
              onClick={() => handleSaveAllocations(allocations)}
              className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs md:text-sm hover:bg-primary/90 transition-all flex items-center gap-2 shrink-0"
            >
              <Check size={16} /> Lưu Phân Bổ
            </button>
          </div>

          {/* Auto Shared Area Calculation Banner */}
          <div className="glass p-5 rounded-3xl border border-blue-500/20 bg-blue-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-blue-300 flex items-center gap-2">
                <Sparkles size={16} /> Hệ Thống Tự Động Tính Diện Tích Phòng Khách & Dùng Chung
              </h4>
              <span className="text-[11px] bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full font-mono">
                100% Căn Hộ
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
                <span className="text-gray-400 block">Tổng diện tích căn hộ:</span>
                <span className="font-bold text-white text-sm">{formatVNNumber(config.totalAreaM2)} m²</span>
              </div>
              <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
                <span className="text-gray-400 block">Tổng diện tích riêng:</span>
                <span className="font-bold text-purple-300 text-sm">{formatVNNumber(report.totalPrivateArea, 1)} m²</span>
              </div>
              <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
                <span className="text-gray-400 block">Phòng khách / Dùng chung tự động:</span>
                <span className="font-bold text-blue-300 text-sm">{formatVNNumber(report.autoLivingRoomM2, 1)} m²</span>
              </div>
              <div className="bg-black/30 p-3 rounded-2xl border border-white/5">
                <span className="text-gray-400 block">Mỗi người nhận thêm:</span>
                <span className="font-bold text-emerald-300 text-sm">+{formatVNNumber(report.sharedLivingRoomPerMember, 1)} m²</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {allocations.map((alloc, idx) => {
              const memberBreakdown = report.breakdowns.find(b => b.userId === alloc.userId);
              const areaPercent = memberBreakdown && config.totalAreaM2 > 0 ? (memberBreakdown.allocatedAreaM2 / config.totalAreaM2) * 100 : 0;
              return (
                <div key={alloc.userId} className="glass p-5 md:p-6 rounded-3xl border border-white/10 space-y-4 relative">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-white">
                        {alloc.avatarUrl ? <img src={alloc.avatarUrl} alt="" className="w-full h-full object-cover rounded-xl" /> : alloc.memberName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">{alloc.memberName}</h4>
                        <span className="text-xs text-gray-400 font-mono">Thành viên #{idx + 1}</span>
                      </div>
                    </div>

                    {memberBreakdown && (
                      <div className="text-right">
                        <span className="text-[11px] text-gray-400 block">Diện tích quy đổi:</span>
                        <span className="text-sm font-black text-emerald-400 font-mono">
                          {formatVNNumber(memberBreakdown.allocatedAreaM2, 1)} m² ({formatVNNumber(areaPercent, 1)}%)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-gray-400 mb-1">P. Ngủ riêng (m²)</label>
                      <FormattedNumberInput
                        value={alloc.bedroomM2}
                        onChange={val => {
                          setAllocations(allocations.map(a => a.userId === alloc.userId ? { ...a, bedroomM2: val } : a));
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">W.C riêng/nhóm (m²)</label>
                      <FormattedNumberInput
                        value={alloc.bathroomM2}
                        onChange={val => {
                          setAllocations(allocations.map(a => a.userId === alloc.userId ? { ...a, bathroomM2: val } : a));
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-blue-300 font-semibold mb-1">P. Khách tự động</label>
                      <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2 text-blue-300 font-bold text-center">
                        +{formatVNNumber(report.sharedLivingRoomPerMember, 1)} m²
                      </div>
                    </div>

                    <div>
                      <label className="block text-emerald-400 font-semibold mb-1">Số ngày ở tháng này</label>
                      <FormattedNumberInput
                        value={alloc.activeDaysInMonth}
                        onChange={val => {
                          setAllocations(allocations.map(a => a.userId === alloc.userId ? { ...a, activeDaysInMonth: val } : a));
                        }}
                        className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Số xe máy/ô tô</label>
                      <FormattedNumberInput
                        value={alloc.vehiclesCount}
                        onChange={val => {
                          setAllocations(allocations.map(a => a.userId === alloc.userId ? { ...a, vehiclesCount: val } : a));
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1">Số kWh riêng (Optional)</label>
                      <FormattedNumberInput
                        value={alloc.customElectricityKwh}
                        onChange={val => {
                          setAllocations(allocations.map(a => a.userId === alloc.userId ? { ...a, customElectricityKwh: val } : a));
                        }}
                        placeholder="Không dùng"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: THIẾT BỊ ĐIỆN ĐẶC THÙ (APPLIANCES) */}
      {/* ========================================================================= */}
      {activeTab === 'appliances' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <Zap className="text-amber-400" size={20} /> Quản Lý Thiết Bị Điện Đặc Thù
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Khai báo các thiết bị điện dùng riêng/dùng nhóm (như máy lạnh phòng riêng, PC Gaming, v.v.) và gán thành viên chịu chi phí.
              </p>
            </div>

            <button
              onClick={openAddApplianceModal}
              className="px-4 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs md:text-sm hover:bg-amber-400 transition-all flex items-center gap-2 shrink-0 shadow-lg active:scale-95"
            >
              <Plus size={16} /> Thêm Thiết Bị
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appliances.length === 0 ? (
              <div className="col-span-full p-8 text-center glass rounded-3xl border border-white/10 text-gray-400">
                Chưa có thiết bị điện đặc thù nào. Nhấn "Thêm Thiết Bị" để khai báo máy lạnh hoặc thiết bị công suất lớn.
              </div>
            ) : (
              appliances.map(app => {
                const assignedMembers = defaultMemberList.filter(m => app.assignedUserIds.includes(m.userId));
                return (
                  <div key={app.id} className="glass p-5 rounded-3xl border border-white/10 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-base flex items-center gap-2">
                          <Tv size={18} className="text-amber-400" /> {app.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditApplianceModal(app)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 transition-colors"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteAppliance(app.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-gray-300 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Số kWh tiêu thụ:</span>
                          <span className="font-bold text-amber-300 font-mono">{formatVNNumber(app.kwhConsumed)} kWh</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/10">
                        <span className="text-xs text-gray-400 font-semibold block mb-2">Thành viên sử dụng thiết bị này:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {assignedMembers.length === 0 ? (
                            <span className="text-xs text-red-400 italic">Chưa gán ai (tiền điện bị bỏ qua)</span>
                          ) : (
                            assignedMembers.map(m => (
                              <span key={m.userId} className="text-xs font-semibold px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30 flex items-center gap-1">
                                <CheckCircle2 size={12} /> {m.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: THÊM / SỬA THIẾT BỊ ĐIỆN ĐẶC THÙ */}
      {/* ========================================================================= */}
      {isApplianceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="glass p-6 md:p-8 rounded-3xl border border-white/10 max-w-md w-full space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="text-amber-400" size={20} />
              {editingApplianceId ? 'Chỉnh Sửa Thiết Bị Điện' : 'Khai Báo Thiết Bị Điện Mới'}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Tên thiết bị</label>
              <input
                type="text"
                placeholder="Ví dụ: Máy lạnh Phòng 1, PC Gaming..."
                value={applianceName}
                onChange={e => setApplianceName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Số kWh điện tiêu thụ trong tháng</label>
              <FormattedNumberInput
                value={applianceKwh}
                onChange={val => setApplianceKwh(val)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Gán thành viên trong nhóm sử dụng thiết bị này:
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {defaultMemberList.map(m => {
                  const isAssigned = applianceUsers.includes(m.userId);
                  return (
                    <button
                      type="button"
                      key={m.userId}
                      onClick={() => {
                        if (isAssigned) {
                          setApplianceUsers(applianceUsers.filter(id => id !== m.userId));
                        } else {
                          setApplianceUsers([...applianceUsers, m.userId]);
                        }
                      }}
                      className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${
                        isAssigned
                          ? 'bg-amber-500/20 border-amber-500/50 text-white'
                          : 'bg-black/30 border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span>{m.name}</span>
                      {isAssigned && <Check size={16} className="text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsApplianceModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveApplianceModal}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-lg"
              >
                Lưu Thiết Bị
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
