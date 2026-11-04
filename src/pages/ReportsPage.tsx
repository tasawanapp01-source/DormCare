/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  Boxes,
  PieChart,
  Coins,
  FileText,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { subscribeWorkOrders, fetchTransactions, subscribeInventory, getCategoryDisplayName } from '../lib/firestoreService';
import { WorkOrder, InventoryTransaction, InventoryItem } from '../types';

export const ReportsPage: React.FC = () => {
  const { userProfile, activeProperty, activePropertyId } = useAuth();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  // Date Range filter (Default to current month)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [reportType, setReportType] = useState<'monthly' | 'weekly' | 'custom'>('monthly');

  useEffect(() => {
    if (!activePropertyId) return;

    const unsubOrders = subscribeWorkOrders(activePropertyId, null, (orders) => {
      setWorkOrders(orders);
    });

    const unsubInv = subscribeInventory(activePropertyId, (inv) => {
      setInventoryItems(inv);
    });

    fetchTransactions(activePropertyId).then((txs) => {
      setTransactions(txs);
    });

    return () => {
      unsubOrders();
      unsubInv();
    };
  }, [activePropertyId]);

  // Handle preset range buttons
  const setRangeThisMonth = () => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    setStartDate(start);
    setEndDate(today);
    setReportType('monthly');
  };

  const setRangeThisWeek = () => {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff)).toISOString().split('T')[0];
    setStartDate(startOfWeek);
    setEndDate(today);
    setReportType('weekly');
  };

  // Filter data within date range
  const filteredOrders = workOrders.filter((wo) => {
    const created = wo.createdAt.substring(0, 10);
    return created >= startDate && created <= endDate;
  });

  const filteredTransactions = transactions.filter((tx) => {
    const created = tx.createdAt.substring(0, 10);
    return created >= startDate && created <= endDate;
  });

  // Calculate statistics
  const totalTickets = filteredOrders.length;
  const completedTickets = filteredOrders.filter((w) => w.status === 'completed').length;
  const inProgressTickets = filteredOrders.filter(
    (w) => w.status === 'in_progress' || w.status === 'accepted' || w.status === 'waiting_parts'
  ).length;
  const externalTickets = filteredOrders.filter((w) => w.status === 'external_contractor').length;
  const cancelledTickets = filteredOrders.filter((w) => w.status === 'cancelled').length;
  const completionRate = totalTickets > 0 ? Math.round((completedTickets / totalTickets) * 100) : 100;

  // Breakdown by Category
  const categoryCounts: Record<string, number> = {};
  filteredOrders.forEach((w) => {
    const catName = getCategoryDisplayName(w.category);
    categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
  });

  // Breakdown by Urgency
  const urgencyCounts: Record<string, number> = {};
  filteredOrders.forEach((w) => {
    urgencyCounts[w.urgency] = (urgencyCounts[w.urgency] || 0) + 1;
  });

  // Breakdown by Technician
  const techCounts: Record<string, number> = {};
  filteredOrders.forEach((w) => {
    const name = w.technicianName || 'ยังไม่กำหนดช่าง';
    techCounts[name] = (techCounts[name] || 0) + 1;
  });

  // Material consumption
  const workOrderWithdrawals = filteredTransactions.filter((t) => t.type === 'withdraw_work_order');
  const residentWithdrawals = filteredTransactions.filter((t) => t.type === 'withdraw_resident');
  const totalWithdrawnValue = [...workOrderWithdrawals, ...residentWithdrawals].reduce(
    (sum, t) => sum + (t.totalValue || 0),
    0
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header and Print action (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            รายงานสรุปงานซ่อมและคลังวัสดุ
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            สรุปข้อมูลสถิติใบงานซ่อม อะไหล่ที่ใช้ และการประเมินค่าใช้จ่ายพร้อมพิมพ์ / บันทึกเป็น PDF
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-md transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          พิมพ์รายงาน / บันทึกเป็น PDF
        </button>
      </div>

      {/* Date Range Selector (Hidden in Print) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={setRangeThisMonth}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              reportType === 'monthly'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            รายเดือน (เดือนนี้)
          </button>
          <button
            type="button"
            onClick={setRangeThisWeek}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              reportType === 'weekly'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            รายสัปดาห์ (สัปดาห์นี้)
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">ตั้งแต่วันที่:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setReportType('custom');
            }}
            className="p-2 rounded-xl border border-slate-300 bg-slate-50"
          />
          <span className="text-slate-500 font-medium">ถึง:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setReportType('custom');
            }}
            className="p-2 rounded-xl border border-slate-300 bg-slate-50"
          />
        </div>
      </div>

      {/* Printable Report Body */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs space-y-8 print:p-0 print:border-none print:shadow-none">
        {/* Printable Official Header */}
        <div className="border-b-2 border-slate-900 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-950 uppercase tracking-tight">
                รายงานผลการบริหารงานแจ้งซ่อมและคลังพัสดุ
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                หอพัก: [{activeProperty?.code}] {activeProperty?.name}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>
                <strong>ช่วงเวลาข้อมูล:</strong> {startDate} ถึง {endDate}
              </div>
              <div>
                <strong>วันที่พิมพ์:</strong>{' '}
                {new Date().toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div>
                <strong>ผู้จัดทำ:</strong> {userProfile?.displayName} ({userProfile?.role})
              </div>
            </div>
          </div>
        </div>

        {/* High-level KPI Summary Boxes */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            1. สรุปภาพรวมการแจ้งซ่อม (Work Orders Overview)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-2xl font-extrabold text-slate-900">{totalTickets}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">งานทั้งหมด</div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-2xl font-extrabold text-emerald-700">{completedTickets}</div>
              <div className="text-xs font-semibold text-emerald-800 mt-1">ซ่อมเสร็จ ({completionRate}%)</div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-2xl font-extrabold text-amber-700">{inProgressTickets}</div>
              <div className="text-xs font-semibold text-amber-800 mt-1">กำลังดำเนินการ</div>
            </div>
            <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200">
              <div className="text-2xl font-extrabold text-orange-700">{externalTickets}</div>
              <div className="text-xs font-semibold text-orange-800 mt-1">ส่งช่างภายนอก</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-2xl font-extrabold text-slate-600">{cancelledTickets}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">ยกเลิก</div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Tables */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* By Category */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              แยกตามหมวดหมู่งาน
            </h4>
            <div className="space-y-1.5 text-xs">
              {Object.entries(categoryCounts).length === 0 ? (
                <div className="text-slate-400 py-2">ไม่มีข้อมูลงานซ่อม</div>
              ) : (
                Object.entries(categoryCounts).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">{cat}</span>
                    <strong className="text-slate-900">{count} งาน</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* By Urgency */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              แยกตามระดับความเร่งด่วน
            </h4>
            <div className="space-y-1.5 text-xs">
              {Object.entries(urgencyCounts).length === 0 ? (
                <div className="text-slate-400 py-2">ไม่มีข้อมูลงานซ่อม</div>
              ) : (
                Object.entries(urgencyCounts).map(([urg, count]) => (
                  <div key={urg} className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">{urg}</span>
                    <strong className="text-slate-900">{count} งาน</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* By Technician */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              แยกตามช่างผู้รับผิดชอบ
            </h4>
            <div className="space-y-1.5 text-xs">
              {Object.entries(techCounts).length === 0 ? (
                <div className="text-slate-400 py-2">ไม่มีข้อมูลงานซ่อม</div>
              ) : (
                Object.entries(techCounts).map(([name, count]) => (
                  <div key={name} className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">{name}</span>
                    <strong className="text-slate-900">{count} งาน</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 2. Inventory Usage & Valuation Summary */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              2. สรุปการเบิกใช้วัสดุและอะไหล่ (Materials Consumption)
            </h3>
            <div className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
              มูลค่าวัสดุที่เบิกใช้รวม: ฿{totalWithdrawnValue.toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-amber-50/40 text-xs">
              <div className="font-bold text-amber-950 mb-1">
                การเบิกใช้ในใบแจ้งซ่อม (โดยช่างประจำหอ)
              </div>
              <div className="text-lg font-bold text-amber-800">
                {workOrderWithdrawals.length} รายการ
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                มูลค่า: ฿{workOrderWithdrawals.reduce((s, t) => s + (t.totalValue || 0), 0).toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-teal-50/40 text-xs">
              <div className="font-bold text-teal-950 mb-1">
                การเบิกของใช้จำเป็น (โดยผู้พักอาศัยไม่มีใบงาน)
              </div>
              <div className="text-lg font-bold text-teal-800">
                {residentWithdrawals.length} รายการ
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                มูลค่า: ฿{residentWithdrawals.reduce((s, t) => s + (t.totalValue || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Table of Work Orders in period */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                <tr>
                  <th className="p-2.5">เลขที่ใบงาน</th>
                  <th className="p-2.5">สถานที่</th>
                  <th className="p-2.5">หัวข้องาน</th>
                  <th className="p-2.5">ผู้แจ้ง</th>
                  <th className="p-2.5">ช่าง</th>
                  <th className="p-2.5">สถานะ</th>
                  <th className="p-2.5 text-right">ค่าวัสดุ (บาท)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400">
                      ไม่มีรายการแจ้งซ่อมในช่วงเวลาที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((wo) => {
                    const cost = (wo.materialsUsed || []).reduce(
                      (s, m) => s + (m.unitPrice || 0) * m.quantity,
                      0
                    );
                    return (
                      <tr key={wo.id}>
                        <td className="p-2.5 font-mono font-bold text-indigo-900">{wo.id}</td>
                        <td className="p-2.5">{wo.building ? `${wo.building} ` : ''}{wo.floor && wo.floor !== '-' ? `ชั้น ${wo.floor} ` : ''}ห้อง {wo.room}</td>
                        <td className="p-2.5 font-medium">{wo.description || wo.title}</td>
                        <td className="p-2.5 text-slate-600">{wo.requesterName}</td>
                        <td className="p-2.5 text-slate-600">{wo.technicianName || '-'}</td>
                        <td className="p-2.5">{wo.status}</td>
                        <td className="p-2.5 text-right font-bold">
                          {cost > 0 ? cost.toLocaleString() : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signature Line for Print Only */}
        <div className="print-only mt-16 pt-8 border-t border-slate-300">
          <div className="grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="h-14 border-b border-dashed border-slate-400 w-48 mx-auto" />
              <div className="mt-2 font-bold">(...................................................)</div>
              <div className="text-slate-500">เจ้าหน้าที่ผู้จัดทำรายงาน</div>
            </div>
            <div>
              <div className="h-14 border-b border-dashed border-slate-400 w-48 mx-auto" />
              <div className="mt-2 font-bold">(...................................................)</div>
              <div className="text-slate-500">ผู้จัดการ / ผู้ดูแลหอพัก</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
