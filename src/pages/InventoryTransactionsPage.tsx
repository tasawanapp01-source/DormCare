/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  PackageMinus,
  Calendar,
  Building,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { fetchTransactions } from '../lib/firestoreService';
import { InventoryTransaction, InventoryTransactionType } from '../types';

export const InventoryTransactionsPage: React.FC = () => {
  const { activePropertyId, activeProperty } = useAuth();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (!activePropertyId) return;
    setLoading(true);
    fetchTransactions(activePropertyId).then((txs) => {
      setTransactions(txs);
      setLoading(false);
    });
  }, [activePropertyId]);

  const filtered = transactions.filter((tx) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        tx.itemCode.toLowerCase().includes(q) ||
        tx.itemName.toLowerCase().includes(q) ||
        tx.reason.toLowerCase().includes(q) ||
        tx.performedByName.toLowerCase().includes(q) ||
        (tx.ticketId && tx.ticketId.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (typeFilter !== 'all' && tx.type !== typeFilter) {
      return false;
    }

    return true;
  });

  const getTypeBadge = (type: InventoryTransactionType) => {
    switch (type) {
      case 'receive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <ArrowDownLeft className="w-3 h-3" /> รับเข้าคลัง
          </span>
        );
      case 'withdraw_work_order':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            <ArrowUpRight className="w-3 h-3" /> ช่างเบิกในใบงาน
          </span>
        );
      case 'withdraw_resident':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
            <PackageMinus className="w-3 h-3" /> ผู้พักเบิกเอง
          </span>
        );
      case 'adjustment':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
            <SlidersHorizontal className="w-3 h-3" /> ปรับปรุงยอด
          </span>
        );
      case 'return':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
            คืนวัสดุ
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-indigo-600" />
          ประวัติการเบิก-รับวัสดุ (Inventory Transactions)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          บันทึกตรวจสอบ (Audit Trail) การเคลื่อนไหวของพัสดุและอะไหล่ทุกรายการในหอพัก [{activeProperty?.code}]
        </p>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาตามรหัสพัสดุ, ชื่อ, เหตุผล, เลขที่ใบงาน หรือชื่อผู้ทำรายการ..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs py-2.5 px-3 rounded-xl border border-slate-300 bg-white"
        >
          <option value="all">ประเภทรายการ: ทั้งหมด</option>
          <option value="receive">รับเข้าคลัง</option>
          <option value="withdraw_work_order">ช่างเบิกในใบงาน</option>
          <option value="withdraw_resident">ผู้พักอาศัยเบิกไม่มีใบงาน</option>
          <option value="adjustment">ปรับปรุงยอด</option>
        </select>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <History className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-300" />
            <p className="text-sm font-medium">ไม่พบประวัติการเคลื่อนไหวพัสดุ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">วัน-เวลา</th>
                  <th className="p-4">ประเภท</th>
                  <th className="p-4">รหัสพัสดุ</th>
                  <th className="p-4">ชื่อรายการ</th>
                  <th className="p-4 text-right">จำนวน</th>
                  <th className="p-4 text-right">ก่อน &gt; หลัง</th>
                  <th className="p-4 text-right">มูลค่ารวม</th>
                  <th className="p-4">ใบงานที่อ้างอิง</th>
                  <th className="p-4">เหตุผล / ผู้ทำรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 text-slate-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-4">{getTypeBadge(tx.type)}</td>
                    <td className="p-4 font-mono font-bold text-slate-700">{tx.itemCode}</td>
                    <td className="p-4 font-semibold text-slate-900">{tx.itemName}</td>
                    <td className="p-4 text-right font-extrabold text-sm">
                      {tx.type === 'receive' || tx.type === 'return' ? (
                        <span className="text-emerald-600">+{tx.quantity}</span>
                      ) : (
                        <span className="text-rose-600">-{tx.quantity}</span>
                      )}
                    </td>
                    <td className="p-4 text-right text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {tx.previousQuantity} &rarr; <strong className="text-slate-800">{tx.newQuantity}</strong>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      {tx.totalValue ? `฿${tx.totalValue.toLocaleString()}` : '-'}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {tx.ticketId ? (
                        <span className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold">
                          {tx.ticketId}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">- (ไม่มีใบงาน)</span>
                      )}
                    </td>
                    <td className="p-4 max-w-xs">
                      <div className="text-slate-800 truncate font-normal">{tx.reason}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        โดย {tx.performedByName} {tx.requesterRoom ? `(${tx.requesterRoom})` : ''}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
