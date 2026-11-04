/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Clock,
  Wrench,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  PackageMinus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { subscribeWorkOrders, subscribeInventory } from '../lib/firestoreService';
import { WorkOrder, InventoryItem } from '../types';
import { isAdmin, isStaff, isResident } from '../lib/permissions';

interface DashboardPageProps {
  onNavigateTab: (tab: string, extra?: { workOrderId?: string }) => void;
  onOpenNewTicketModal: () => void;
  onOpenResidentWithdrawModal?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateTab,
  onOpenNewTicketModal,
  onOpenResidentWithdrawModal,
}) => {
  const { userProfile, activeProperty, activePropertyId } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePropertyId) return;
    setLoading(true);

    const unsubOrders = subscribeWorkOrders(activePropertyId, userProfile, (orders) => {
      setWorkOrders(orders);
      setLoading(false);
    });

    const unsubInventory = subscribeInventory(activePropertyId, (items) => {
      setInventoryItems(items);
    });

    return () => {
      unsubOrders();
      unsubInventory();
    };
  }, [activePropertyId, userProfile]);

  // Statistics calculation
  const totalOrders = workOrders.length;
  const pendingOrders = workOrders.filter((w) => w.status === 'pending');
  const inProgressOrders = workOrders.filter((w) => w.status === 'in_progress' || w.status === 'accepted' || w.status === 'waiting_parts');
  const externalOrders = workOrders.filter((w) => w.status === 'external_contractor');
  const completedOrders = workOrders.filter((w) => w.status === 'completed');
  const completionRate = totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 100) : 100;

  // Inventory stats
  const lowStockItems = inventoryItems.filter((i) => i.quantity <= i.minQuantity);
  const outOfStockItems = inventoryItems.filter((i) => i.quantity === 0);

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">ฉุกเฉิน</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">เร่งด่วน</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">ปานกลาง</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">ทั่วไป</span>;
    }
  };

  const getStatusBadge = (status: string) => {
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
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold mb-3 border border-white/10">
              <Building className="w-3.5 h-3.5" />
              {activeProperty ? `[${activeProperty.code}] ${activeProperty.name}` : 'กำลังโหลด...'}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              สวัสดี, {userProfile?.displayName || 'ผู้ใช้งาน'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              {isAdmin(userProfile)
                ? 'ยินดีต้อนรับสู่แผงควบคุมระบบแจ้งซ่อมและคลังวัสดุ สามารถติดตามสถานะงานซ่อม เบิกวัสดุ และดูรายงานได้แบบเรียลไทม์'
                : isStaff(userProfile)
                ? 'ตรวจรับงานซ่อม บันทึกผลการตรวจเช็ค และเบิกอะไหล่สำหรับใบแจ้งซ่อมได้ที่นี่'
                : 'แจ้งปัญหาความเสียหายของห้องพักหรือส่วนกลาง และติดตามความคืบหน้าของช่างได้อย่างสะดวก'}
            </p>
          </div>

          {/* Quick Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenNewTicketModal}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              แจ้งซ่อมใหม่
            </button>

            {isResident(userProfile) && activeProperty?.residentSelfWithdrawEnabled && onOpenResidentWithdrawModal && (
              <button
                onClick={onOpenResidentWithdrawModal}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-indigo-100 bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2"
              >
                <PackageMinus className="w-4 h-4 text-emerald-400" />
                เบิกวัสดุของใช้
              </button>
            )}

            {(isAdmin(userProfile) || isStaff(userProfile)) && (
              <button
                onClick={() => onNavigateTab('inventory')}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-indigo-100 bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2"
              >
                <Boxes className="w-4 h-4 text-amber-400" />
                จัดการคลัง
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Card */}
        <div
          onClick={() => onNavigateTab('work-orders')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">รอช่างรับงาน</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {pendingOrders.length}
            </span>
            <span className="text-xs text-slate-400">ใบงาน</span>
          </div>
          {pendingOrders.length > 0 && (
            <div className="mt-2 text-[11px] font-medium text-blue-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
              มีงานใหม่รอจัดสรร
            </div>
          )}
        </div>

        {/* In Progress Card */}
        <div
          onClick={() => onNavigateTab('work-orders')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">กำลังดำเนินการ</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {inProgressOrders.length}
            </span>
            <span className="text-xs text-slate-400">ใบงาน</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            รวมรออะไหล่ & ซ่อมอยู่
          </div>
        </div>

        {/* External Contractor Card */}
        <div
          onClick={() => onNavigateTab('work-orders')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ส่งช่างภายนอก</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ExternalLink className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {externalOrders.length}
            </span>
            <span className="text-xs text-slate-400">ใบงาน</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            ช่างศูนย์หรือผู้รับเหมา
          </div>
        </div>

        {/* Low Stock / Inventory Alert Card */}
        <div
          onClick={() => onNavigateTab('inventory')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">พัสดุใกล้หมด / หมด</span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${
                outOfStockItems.length > 0
                  ? 'bg-rose-50 text-rose-600'
                  : lowStockItems.length > 0
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {lowStockItems.length}
            </span>
            <span className="text-xs text-slate-400">รายการ</span>
          </div>
          <div className="mt-2 text-[11px] font-medium text-slate-500">
            {outOfStockItems.length > 0 ? (
              <span className="text-rose-600 font-bold">หมดสต็อก {outOfStockItems.length} รายการ</span>
            ) : (
              'ต่ำกว่าเกณฑ์ขั้นต่ำ'
            )}
          </div>
        </div>
      </div>

      {/* Main Content 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Work Orders */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">รายการแจ้งซ่อมล่าสุด</h3>
              <p className="text-xs text-slate-500">
                {isResident(userProfile) ? 'ใบแจ้งซ่อมของคุณ' : 'ใบแจ้งซ่อมประจำหอพัก'}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('work-orders')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              ดูทั้งหมด ({workOrders.length}) <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {workOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-300" />
              <p className="text-sm font-medium">ยังไม่มีรายการแจ้งซ่อมในหอพักนี้</p>
              <button
                onClick={onOpenNewTicketModal}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusCircle className="w-3.5 h-3.5" /> แจ้งซ่อมรายการแรก
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {workOrders.slice(0, 5).map((wo) => (
                <div
                  key={wo.id}
                  onClick={() => onNavigateTab('work-orders', { workOrderId: wo.id })}
                  className="py-3.5 hover:bg-slate-50/80 px-2 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {wo.id}
                      </span>
                      {getUrgencyBadge(wo.urgency)}
                      <span className="text-xs text-slate-500 truncate">
                        {wo.building ? `${wo.building} ` : ''}{wo.floor && wo.floor !== '-' ? `ชั้น ${wo.floor} ` : ''}ห้อง {wo.room}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {wo.description || wo.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      ผู้แจ้ง: {wo.requesterName} • {new Date(wo.createdAt).toLocaleDateString('th-TH')}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    {getStatusBadge(wo.status)}
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Low Stock Warnings & Quota Info */}
        <div className="space-y-6">
          {/* Low Stock Warning Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">พัสดุใกล้หมดสต็อก</h3>
              </div>
              <button
                onClick={() => onNavigateTab('inventory')}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                ดูคลัง
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-80" />
                ปริมาณพัสดุทุกรายการอยู่ในเกณฑ์ปกติ
              </div>
            ) : (
              <div className="space-y-2.5">
                {lowStockItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-800 truncate">{item.name}</div>
                      <div className="text-slate-400 text-[10px] font-mono">{item.itemCode}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-bold ${item.quantity === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                        {item.quantity} {item.unit}
                      </div>
                      <div className="text-[10px] text-slate-400">เกณฑ์ขั้นต่ำ: {item.minQuantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spark Plan & Retention Info */}
          <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-3xl p-5 border border-indigo-100/80 text-xs text-slate-600 space-y-2">
            <div className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              การจัดการข้อมูล & โควต้าฟรี
            </div>
            <p className="leading-relaxed text-[11px]">
              ระบบถูกออกแบบสำหรับ <strong>Firebase Spark Plan</strong> ใช้งานฟรี 100% ไม่ผูกบัตรเครดิต
              รูปภาพถูกบีบอัดไม่เกิน 150 KB/รูป และระบบมีกลไกลบข้อมูลใบแจ้งซ่อมเก่าอัตโนมัติเมื่อครบ 365 วันผ่าน GitHub Actions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function Building(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}
