/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  PlusCircle,
  Calendar,
  Building,
  AlertCircle,
  Clock,
  Wrench,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Eye,
  FolderPlus,
  Tag,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { subscribeWorkOrders, subscribeRepairCategories, getCategoryDisplayName } from '../lib/firestoreService';
import { WorkOrder, TicketStatus, TicketUrgency, RepairCategory } from '../types';
import { isResident } from '../lib/permissions';
import { ManageRepairCategoriesModal } from '../components/ManageRepairCategoriesModal';

interface WorkOrdersPageProps {
  onSelectWorkOrder: (workOrderId: string) => void;
  onOpenNewModal: () => void;
}

export const WorkOrdersPage: React.FC<WorkOrdersPageProps> = ({
  onSelectWorkOrder,
  onOpenNewModal,
}) => {
  const { userProfile, activeProperty, activePropertyId } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [repairCategories, setRepairCategories] = useState<RepairCategory[]>([]);
  const [isManageCatOpen, setIsManageCatOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const unsubCats = subscribeRepairCategories((cats) => {
      setRepairCategories(cats);
    });
    return () => unsubCats();
  }, []);

  useEffect(() => {
    if (!activePropertyId) return;
    setLoading(true);

    const unsubscribe = subscribeWorkOrders(activePropertyId, userProfile, (orders) => {
      setWorkOrders(orders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activePropertyId, userProfile]);

  const filteredOrders = workOrders.filter((wo) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const catName = getCategoryDisplayName(wo.category, repairCategories).toLowerCase();
      const match =
        wo.id.toLowerCase().includes(q) ||
        wo.title.toLowerCase().includes(q) ||
        wo.description.toLowerCase().includes(q) ||
        catName.includes(q) ||
        wo.room.toLowerCase().includes(q) ||
        wo.requesterName.toLowerCase().includes(q) ||
        (wo.technicianName && wo.technicianName.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Status
    if (statusFilter !== 'all' && wo.status !== statusFilter) {
      return false;
    }

    // Urgency
    if (urgencyFilter !== 'all' && wo.urgency !== urgencyFilter) {
      return false;
    }

    // Category
    if (categoryFilter !== 'all') {
      const catName = getCategoryDisplayName(wo.category, repairCategories);
      if (catName !== categoryFilter && wo.category !== categoryFilter) {
        return false;
      }
    }

    return true;
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">🚨 ฉุกเฉิน</span>;
      case 'high':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">เร่งด่วน</span>;
      case 'medium':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">ปานกลาง</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">ทั่วไป</span>;
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">รอรับงาน</span>;
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">รับงานแล้ว</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">กำลังซ่อม</span>;
      case 'waiting_parts':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">รออะไหล่</span>;
      case 'external_contractor':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">ส่งช่างนอก</span>;
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">เสร็จสิ้น</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">ยกเลิก</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Action button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            รายการแจ้งซ่อม (Work Orders)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isResident(userProfile)
              ? 'ตรวจสอบสถานะและประวัติการแจ้งซ่อมห้องพักของคุณ'
              : `จัดการและรับงานซ่อมบำรุงประจำ [${activeProperty?.code}] ${activeProperty?.name}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsManageCatOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-2xs transition-all cursor-pointer"
            title="เพิ่ม ลบ แก้ไขหมวดหมู่งานซ่อม"
          >
            <FolderPlus className="w-4 h-4 text-indigo-600" />
            หมวดหมู่งานซ่อม
          </button>

          <button
            onClick={onOpenNewModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            แจ้งซ่อมใหม่
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาตามเลขที่ใบงาน, อาการชำรุด, หมวดหมู่, ห้อง, ผู้แจ้ง, หรือช่าง..."
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Filters: Category & Urgency */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs py-2.5 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">หมวดหมู่: ทั้งหมด</option>
              {repairCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="text-xs py-2.5 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">ความเร่งด่วน: ทั้งหมด</option>
              <option value="emergency">ฉุกเฉิน</option>
              <option value="high">เร่งด่วน</option>
              <option value="medium">ปานกลาง</option>
              <option value="low">ทั่วไป</option>
            </select>
          </div>
        </div>

        {/* Status Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({workOrders.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === 'pending'
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            รอรับงาน ({workOrders.filter((w) => w.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === 'in_progress'
                ? 'bg-amber-600 text-white font-semibold'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            กำลังซ่อม ({workOrders.filter((w) => w.status === 'in_progress').length})
          </button>
          <button
            onClick={() => setStatusFilter('waiting_parts')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === 'waiting_parts'
                ? 'bg-purple-600 text-white font-semibold'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            รออะไหล่ ({workOrders.filter((w) => w.status === 'waiting_parts').length})
          </button>
          <button
            onClick={() => setStatusFilter('external_contractor')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === 'external_contractor'
                ? 'bg-orange-600 text-white font-semibold'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            ส่งช่างนอก ({workOrders.filter((w) => w.status === 'external_contractor').length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            เสร็จสิ้น ({workOrders.filter((w) => w.status === 'completed').length})
          </button>
        </div>
      </div>

      {/* Work Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">ไม่พบรายการแจ้งซ่อม</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'ลองปรับคำค้นหาหรือตัวกรองใหม่อีกครั้ง'
              : 'ยังไม่มีประวัติการแจ้งซ่อมในระบบ'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredOrders.map((wo) => (
            <div
              key={wo.id}
              onClick={() => onSelectWorkOrder(wo.id)}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200/60">
                    {wo.id}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-indigo-50/70 text-indigo-800 border border-indigo-100 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-indigo-500" />
                    {getCategoryDisplayName(wo.category, repairCategories)}
                  </span>
                  {getUrgencyBadge(wo.urgency)}
                  {getStatusBadge(wo.status)}
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    {wo.building ? `${wo.building} ` : ''}{wo.floor && wo.floor !== '-' ? `ชั้น ${wo.floor} ` : ''}ห้อง {wo.room}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                  {wo.description || wo.title}
                </h3>

                {wo.title && wo.description && wo.title !== wo.description && (
                  <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
                    {wo.title}
                  </p>
                )}

                <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                  <span>ผู้แจ้ง: <strong className="text-slate-600">{wo.requesterName}</strong></span>
                  <span>วันที่: {new Date(wo.createdAt).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                  {wo.technicianName && (
                    <span>ช่างผู้ดูแล: <strong className="text-slate-600">{wo.technicianName}</strong></span>
                  )}
                  {wo.images && wo.images.length > 0 && (
                    <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                      มีภาพประกอบ ({wo.images.length})
                    </span>
                  )}
                  {wo.materialsUsed && wo.materialsUsed.length > 0 && (
                    <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                      เบิกพัสดุแล้ว ({wo.materialsUsed.length} รายการ)
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <button
                  type="button"
                  className="px-3.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> รายละเอียด
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal จัดการหมวดหมู่งานซ่อม */}
      <ManageRepairCategoriesModal
        isOpen={isManageCatOpen}
        onClose={() => setIsManageCatOpen(false)}
      />
    </div>
  );
};
