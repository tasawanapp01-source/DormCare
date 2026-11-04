/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, PackageMinus, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from './Toast';
import { withdrawInventoryItemAtomic } from '../lib/firestoreService';
import { InventoryItem } from '../types';

interface ResidentWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
}

export const ResidentWithdrawModal: React.FC<ResidentWithdrawModalProps> = ({
  isOpen,
  onClose,
  inventoryItems,
}) => {
  const { userProfile, activeProperty } = useAuth();
  const { showToast } = useToast();

  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [room, setRoom] = useState(userProfile?.roomId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Filter available items with stock > 0
  const availableItems = inventoryItems.filter((i) => i.quantity > 0 && i.isActive);
  const selectedItem = availableItems.find((i) => i.id === itemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !activeProperty) return;

    if (!selectedItem) {
      showToast('error', 'กรุณาเลือกวัสดุ', 'โปรดเลือกรายการที่ต้องการเบิก');
      return;
    }

    if (quantity <= 0 || quantity > selectedItem.quantity) {
      showToast('error', 'จำนวนไม่ถูกต้อง', `สต็อกคงเหลือ ${selectedItem.quantity} ${selectedItem.unit}`);
      return;
    }

    if (!reason.trim()) {
      showToast('error', 'กรุณาระบุเหตุผล', 'ระบุวัตถุประสงค์ในการเบิกของใช้');
      return;
    }

    setIsSubmitting(true);
    try {
      await withdrawInventoryItemAtomic({
        propertyId: activeProperty.id,
        itemId: selectedItem.id,
        quantity,
        ticketId: null, // Strictly null for resident self-withdrawal
        reason: reason.trim(),
        type: 'withdraw_resident',
        requesterUid: userProfile.uid,
        requesterName: userProfile.displayName,
        requesterRoom: room || userProfile.roomId || 'ส่วนกลาง',
        user: userProfile,
      });

      showToast(
        'success',
        'เบิกวัสดุสำเร็จ',
        `เบิก ${selectedItem.name} จำนวน ${quantity} ${selectedItem.unit} เรียบร้อยแล้ว`
      );
      onClose();
      setItemId('');
      setQuantity(1);
      setReason('');
    } catch (err: unknown) {
      showToast('error', 'ไม่สามารถทำรายการได้', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <PackageMinus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">เบิกวัสดุของใช้จำเป็น</h3>
              <p className="text-xs text-slate-500">สำหรับผู้พักอาศัย (ไม่ต้องมีใบแจ้งซ่อม)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              เลือกรายการของใช้ <span className="text-rose-500">*</span>
            </label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              required
              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- เลือกรายการพัสดุ --</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (เหลือ {item.quantity} {item.unit})
                </option>
              ))}
            </select>
            {selectedItem && (
              <div className="mt-1.5 text-[11px] text-slate-500 flex justify-between">
                <span>หมวดหมู่: {selectedItem.category}</span>
                <span>ที่เก็บ: {selectedItem.location || 'คลังกลาง'}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                จำนวนที่ต้องการ <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={selectedItem ? selectedItem.quantity : 99}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                required
                className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ห้องพักผู้เบิก
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="เช่น 301"
                required
                className="w-full text-sm p-2.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              เหตุผลหรือวัตถุประสงค์ในการเบิก <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น เบิกถุงขยะทำความสะอาดห้องพักต้นเดือน"
              required
              className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              ทุกการเบิกจะถูกบันทึกประวัติพร้อมชื่อผู้เบิก วันเวลา และห้องพัก
              โดยระบบจะตัดสต็อกทันทีแบบตรวจสอบความถูกต้องอัตโนมัติ
            </span>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedItem}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? 'กำลังตัดสต็อก...' : 'ยืนยันการเบิกวัสดุ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
