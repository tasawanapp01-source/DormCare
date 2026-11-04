/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Building,
  User,
  Phone,
  Calendar,
  ExternalLink,
  Boxes,
  PlusCircle,
  FileText,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  subscribeWorkOrders,
  updateWorkOrderStatus,
  withdrawInventoryItemAtomic,
  subscribeInventory,
  getCategoryDisplayName,
} from '../lib/firestoreService';
import {
  WorkOrder,
  TicketStatus,
  InventoryItem,
  ExternalContractorDetail,
} from '../types';
import { canChangeWorkOrderStatus, canCloseWorkOrder, isStaff, isAdmin } from '../lib/permissions';

interface WorkOrderDetailPageProps {
  workOrderId: string;
  onBack: () => void;
}

export const WorkOrderDetailPage: React.FC<WorkOrderDetailPageProps> = ({
  workOrderId,
  onBack,
}) => {
  const { userProfile, activeProperty, activePropertyId } = useAuth();
  const { showToast } = useToast();

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Inspection & Action form inputs
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('');

  // Modals state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isContractorModalOpen, setIsContractorModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Material withdrawal form
  const [withdrawItemId, setWithdrawItemId] = useState('');
  const [withdrawQuantity, setWithdrawQuantity] = useState(1);
  const [withdrawReason, setWithdrawReason] = useState('');

  // Contractor form
  const [contractorName, setContractorName] = useState('');
  const [contractorDetail, setContractorDetail] = useState('');
  const [contractorReason, setContractorReason] = useState('');
  const [contractorDate, setContractorDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractorCost, setContractorCost] = useState(0);
  const [contractorPhone, setContractorPhone] = useState('');
  const [contractorOutcome, setContractorOutcome] = useState('');

  // Subscribe to work order
  useEffect(() => {
    if (!activePropertyId) return;
    const unsub = subscribeWorkOrders(activePropertyId, userProfile, (orders) => {
      const found = orders.find((o) => o.id === workOrderId);
      if (found) {
        setWorkOrder(found);
        setInspectionNotes(found.inspectionNotes || '');
        setActionTaken(found.actionTaken || '');
        if (found.externalContractor) {
          setContractorName(found.externalContractor.contractorName || '');
          setContractorDetail(found.externalContractor.detail || '');
          setContractorReason(found.externalContractor.reason || '');
          setContractorDate(found.externalContractor.sentDate || '');
          setContractorCost(found.externalContractor.cost || 0);
          setContractorOutcome(found.externalContractor.outcome || '');
          setContractorPhone(found.externalContractor.contactPhone || '');
        }
      }
    });

    const unsubInv = subscribeInventory(activePropertyId, (items) => {
      setInventoryItems(items);
    });

    return () => {
      unsub();
      unsubInv();
    };
  }, [activePropertyId, workOrderId, userProfile]);

  if (!workOrder) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
        <h3 className="text-base font-bold text-slate-800">กำลังโหลดข้อมูลใบแจ้งซ่อม...</h3>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
        >
          กลับหน้ารายการ
        </button>
      </div>
    );
  }

  const canEdit = canChangeWorkOrderStatus(userProfile, workOrder);

  // Status handlers
  const handleAcceptTicket = async () => {
    if (!userProfile) return;
    setIsUpdating(true);
    try {
      await updateWorkOrderStatus(workOrder, 'accepted', 'ช่างกดรับงานและเข้าตรวจสอบ', userProfile, {
        technicianUid: userProfile.uid,
        technicianName: userProfile.displayName,
      });
      showToast('success', 'รับงานสำเร็จ', 'ระบบบันทึกช่างผู้รับผิดชอบเรียบร้อย');
    } catch (err: unknown) {
      showToast('error', 'ไม่สามารถเปลี่ยนสถานะได้', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartRepair = async () => {
    if (!userProfile) return;
    setIsUpdating(true);
    try {
      await updateWorkOrderStatus(workOrder, 'in_progress', 'ช่างเริ่มดำเนินการซ่อมแซม', userProfile, {
        inspectionNotes: inspectionNotes.trim(),
        actionTaken: actionTaken.trim(),
      });
      showToast('success', 'อัปเดตสถานะสำเร็จ', 'กำลังดำเนินการซ่อมแซม');
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!userProfile) return;
    setIsUpdating(true);
    try {
      await updateWorkOrderStatus(workOrder, workOrder.status, 'บันทึกความคืบหน้าการตรวจซ่อม', userProfile, {
        inspectionNotes: inspectionNotes.trim(),
        actionTaken: actionTaken.trim(),
      });
      showToast('success', 'บันทึกผลการตรวจสอบสำเร็จ');
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveExternalContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    if (!contractorName.trim() || !contractorDetail.trim()) {
      showToast('error', 'ข้อมูลไม่ครบ', 'กรุณาระบุชื่อผู้รับเหมาและรายละเอียด');
      return;
    }

    setIsUpdating(true);
    try {
      const contractorData: ExternalContractorDetail = {
        contractorName: contractorName.trim(),
        detail: contractorDetail.trim(),
        reason: contractorReason.trim(),
        sentDate: contractorDate,
        cost: Number(contractorCost) || 0,
        outcome: contractorOutcome.trim(),
        contactPhone: contractorPhone.trim(),
        updatedAt: new Date().toISOString(),
      };

      await updateWorkOrderStatus(workOrder, 'external_contractor', `ส่งงานให้ผู้รับเหมาภายนอก: ${contractorName}`, userProfile, {
        externalContractor: contractorData,
      });

      showToast('success', 'บันทึกการส่งช่างภายนอกสำเร็จ');
      setIsContractorModalOpen(false);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Atomic Material Withdrawal
  const handleConfirmWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !activeProperty) return;

    const selectedItem = inventoryItems.find((i) => i.id === withdrawItemId);
    if (!selectedItem) {
      showToast('error', 'เลือกพัสดุ', 'กรุณาเลือกรายการวัสดุที่ต้องการเบิก');
      return;
    }

    if (withdrawQuantity <= 0 || withdrawQuantity > selectedItem.quantity) {
      showToast('error', 'ยอดคงเหลือไม่พอ', `มีสต็อกเพียง ${selectedItem.quantity} ${selectedItem.unit}`);
      return;
    }

    setIsUpdating(true);
    try {
      await withdrawInventoryItemAtomic({
        propertyId: activeProperty.id,
        itemId: selectedItem.id,
        quantity: withdrawQuantity,
        ticketId: workOrder.id,
        workOrder,
        reason: withdrawReason || `เบิกใช้ในใบงาน ${workOrder.id}`,
        type: 'withdraw_work_order',
        user: userProfile,
      });

      showToast('success', 'เบิกวัสดุสำเร็จและตัดสต็อกทันที', `${selectedItem.name} จำนวน ${withdrawQuantity} ${selectedItem.unit}`);
      setIsWithdrawModalOpen(false);
      setWithdrawItemId('');
      setWithdrawQuantity(1);
      setWithdrawReason('');
    } catch (err: unknown) {
      showToast('error', 'การเบิกล้มเหลว', err instanceof Error ? err.message : 'สต็อกไม่พอหรือเกิดข้อผิดพลาด');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!userProfile) return;
    const check = canCloseWorkOrder(userProfile, {
      ...workOrder,
      inspectionNotes,
      actionTaken,
    });

    if (!check.allowed) {
      showToast('error', 'ไม่สามารถปิดงานได้', check.reason);
      setIsCloseModalOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      await updateWorkOrderStatus(workOrder, 'completed', 'ตรวจรับงานซ่อมแซมเสร็จสมบูรณ์ ปิดงาน', userProfile, {
        status: 'completed',
        inspectionNotes: inspectionNotes.trim(),
        actionTaken: actionTaken.trim(),
        closedAt: new Date().toISOString(),
        closedByUid: userProfile.uid,
        closedByName: userProfile.displayName,
      });

      showToast('success', 'ปิดงานซ่อมแซมเสร็จสิ้น', `ใบงาน ${workOrder.id} ได้รับการปิดเรียบร้อย`);
      setIsCloseModalOpen(false);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelTicket = async () => {
    if (!userProfile) return;
    setIsUpdating(true);
    try {
      await updateWorkOrderStatus(workOrder, 'cancelled', 'ยกเลิกใบแจ้งซ่อม', userProfile, {
        status: 'cancelled',
      });
      showToast('info', 'ยกเลิกใบแจ้งซ่อมแล้ว');
      setIsCancelModalOpen(false);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsUpdating(false);
    }
  };

  const totalMaterialCost = (workOrder.materialsUsed || []).reduce(
    (sum, m) => sum + (m.unitPrice || 0) * m.quantity,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top back button & Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" /> กลับหน้ารายการ
        </button>

        <div className="flex items-center gap-2">
          {workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && canEdit && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="text-xs font-medium text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors"
            >
              ยกเลิกใบงาน
            </button>
          )}
        </div>
      </div>

      {/* Main Ticket Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        {/* Header with Ticket ID & Badges */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <span className="text-sm font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                {workOrder.id}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                หมวด: {getCategoryDisplayName(workOrder.category)}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                ความเร่งด่วน: {workOrder.urgency}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {workOrder.description || workOrder.title}
            </h1>
          </div>

          <div className="text-right shrink-0">
            <span
              className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold ${
                workOrder.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : workOrder.status === 'pending'
                  ? 'bg-blue-100 text-blue-800'
                  : workOrder.status === 'external_contractor'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              สถานะ: {workOrder.status.toUpperCase()}
            </span>
            <div className="text-[11px] text-slate-400 mt-1">
              สร้างเมื่อ: {new Date(workOrder.createdAt).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Location & Requester Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs">
          <div>
            <div className="text-slate-400 font-semibold mb-0.5">สถานที่เกิดเหตุ</div>
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-indigo-500" />
              {workOrder.building ? `${workOrder.building} ` : ''}ห้อง {workOrder.room}
              {workOrder.floor && workOrder.floor !== '-' ? ` (ชั้น ${workOrder.floor})` : ''}
            </div>
          </div>
          <div>
            <div className="text-slate-400 font-semibold mb-0.5">ผู้แจ้งปัญหา</div>
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              {workOrder.requesterName}
            </div>
          </div>
          <div>
            <div className="text-slate-400 font-semibold mb-0.5">เบอร์ติดต่อ</div>
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-indigo-500" />
              {workOrder.requesterPhone || '-'}
            </div>
          </div>
          <div>
            <div className="text-slate-400 font-semibold mb-0.5">ช่างผู้รับผิดชอบ</div>
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-indigo-500" />
              {workOrder.technicianName || 'ยังไม่มีช่างรับงาน'}
            </div>
          </div>
        </div>

        {/* Description & Attached Images */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              รายละเอียดอาการชำรุด
            </h3>
            <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-200/80 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {workOrder.description}
            </div>
          </div>

          {/* Attached Images */}
          {workOrder.images && workOrder.images.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                รูปภาพประกอบจากผู้แจ้ง ({workOrder.images.length} รูป)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {workOrder.images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-2xs group cursor-pointer bg-slate-100"
                  >
                    <img
                      src={img}
                      alt={`Issue attachment ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                      คลิกเพื่อดูภาพขยาย
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Technician Workflow Section (Staff & Admin only) */}
        {canEdit && (
          <div className="p-6 rounded-3xl bg-indigo-50/40 border border-indigo-100 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                การดำเนินการของช่าง (Technician Operations)
              </h3>
              <div className="flex items-center gap-2">
                {workOrder.status === 'pending' && (
                  <button
                    type="button"
                    onClick={handleAcceptTicket}
                    disabled={isUpdating}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                  >
                    กดรับงานใบนี้
                  </button>
                )}
                {workOrder.status === 'accepted' && (
                  <button
                    type="button"
                    onClick={handleStartRepair}
                    disabled={isUpdating}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors"
                  >
                    เริ่มลงมือซ่อม
                  </button>
                )}
                {workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsWithdrawModalOpen(true)}
                      className="px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Boxes className="w-3.5 h-3.5" /> เบิกพัสดุในงานนี้
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsContractorModalOpen(true)}
                      className="px-3 py-2 text-xs font-semibold text-orange-800 bg-orange-100 hover:bg-orange-200 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> ส่งช่างภายนอก
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCloseModalOpen(true)}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> ปิดงานซ่อม
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inspection & Action input fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  บันทึกผลการตรวจสอบหน้างาน
                </label>
                <textarea
                  rows={2}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="ระบุสาเหตุที่ชำรุด เช่น ท่ออุดตันจากคราบสบู่, สายไฟขาดใน..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียดการดำเนินงาน / วิธีแก้ไข
                </label>
                <textarea
                  rows={2}
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="ระบุสิ่งที่ช่างทำ เช่น ทำการเปลี่ยนสายชำระชุดใหม่ พันเกลียว และทดสอบแรงดันน้ำ..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isUpdating}
                className="px-4 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl"
              >
                บันทึกความคืบหน้า
              </button>
            </div>
          </div>
        )}

        {/* Materials Used in This Ticket */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-600" />
              รายการพัสดุและอะไหล่ที่เบิกใช้ (ตัดสต็อกแล้ว)
            </h3>
            {totalMaterialCost > 0 && (
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                มูลค่าวัสดุรวม: {totalMaterialCost.toLocaleString()} บาท
              </span>
            )}
          </div>

          {!workOrder.materialsUsed || workOrder.materialsUsed.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-400 text-center">
              ยังไม่มีการเบิกวัสดุในใบแจ้งซ่อมนี้
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <tr>
                    <th className="p-3">รหัสพัสดุ</th>
                    <th className="p-3">ชื่อรายการ</th>
                    <th className="p-3 text-right">จำนวนที่ใช้</th>
                    <th className="p-3 text-right">ราคา/หน่วย</th>
                    <th className="p-3 text-right">รวมเงิน</th>
                    <th className="p-3">ผู้เบิก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {workOrder.materialsUsed.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-medium text-slate-600">{m.itemCode}</td>
                      <td className="p-3 font-medium">{m.itemName}</td>
                      <td className="p-3 text-right font-bold">
                        {m.quantity} {m.unit}
                      </td>
                      <td className="p-3 text-right text-slate-500">
                        {m.unitPrice ? `${m.unitPrice.toLocaleString()} ฿` : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {m.unitPrice ? `${(m.unitPrice * m.quantity).toLocaleString()} ฿` : '-'}
                      </td>
                      <td className="p-3 text-slate-500">{m.withdrawnByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* External Contractor Details Card (If sent) */}
        {workOrder.externalContractor && (
          <div className="p-5 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-orange-950 flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-orange-600" />
                รายละเอียดการส่งผู้รับเหมา / ช่างภายนอก
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
                ส่งงานเมื่อ {workOrder.externalContractor.sentDate}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500">ชื่อผู้รับเหมา:</span>
                <div className="font-bold text-slate-900">{workOrder.externalContractor.contractorName}</div>
              </div>
              <div>
                <span className="text-slate-500">ค่าใช้จ่ายประมาณการ:</span>
                <div className="font-bold text-slate-900">
                  {workOrder.externalContractor.cost ? `${workOrder.externalContractor.cost.toLocaleString()} บาท` : 'รอประเมิน'}
                </div>
              </div>
              <div>
                <span className="text-slate-500">เบอร์ติดต่อ:</span>
                <div className="font-bold text-slate-900">{workOrder.externalContractor.contactPhone || '-'}</div>
              </div>
            </div>

            <div className="text-xs space-y-1">
              <div>
                <span className="font-semibold text-slate-700">สาเหตุที่ส่งงานภายนอก:</span>{' '}
                <span className="text-slate-800">{workOrder.externalContractor.reason}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">รายละเอียดงาน:</span>{' '}
                <span className="text-slate-800">{workOrder.externalContractor.detail}</span>
              </div>
              {workOrder.externalContractor.outcome && (
                <div>
                  <span className="font-semibold text-slate-700">ผลการดำเนินงาน:</span>{' '}
                  <span className="text-emerald-700 font-medium">{workOrder.externalContractor.outcome}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completion summary if completed */}
        {workOrder.status === 'completed' && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="font-bold">งานซ่อมเสร็จสิ้นสมบูรณ์</span>
                <div className="text-[11px] text-emerald-700">
                  ปิดงานโดย {workOrder.closedByName || 'เจ้าหน้าที่'} เมื่อ{' '}
                  {workOrder.closedAt ? new Date(workOrder.closedAt).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Material Withdrawal Modal (Atomic Stock deduction) */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-600" />
              เบิกพัสดุสำหรับใบแจ้งซ่อมนี้
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ระบบจะหักยอดสต็อกแบบ Real-time Atomic Transaction และลงบันทึกในใบงาน {workOrder.id}
            </p>

            <form onSubmit={handleConfirmWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลือกรายการพัสดุ <span className="text-rose-500">*</span>
                </label>
                <select
                  value={withdrawItemId}
                  onChange={(e) => setWithdrawItemId(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- กรุณาเลือกรายการ --</option>
                  {inventoryItems
                    .filter((item) => item.quantity > 0)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        [{item.itemCode}] {item.name} (คงเหลือ: {item.quantity} {item.unit})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนที่ต้องการเบิก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={withdrawQuantity}
                  onChange={(e) => setWithdrawQuantity(parseInt(e.target.value) || 1)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เหตุผล / จุดติดตั้ง
                </label>
                <input
                  type="text"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder={`ใช้ซ่อมในห้อง ${workOrder.room}`}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs"
                >
                  {isUpdating ? 'กำลังตัดสต็อก...' : 'ยืนยันการเบิกพัสดุ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* External Contractor Modal */}
      {isContractorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-orange-600" />
              ส่งงานต่อให้ช่าง / ผู้รับเหมาภายนอก
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              บันทึกรายละเอียดสำหรับงานที่ต้องการเครื่องมือพิเศษหรือประกันศูนย์
            </p>

            <form onSubmit={handleSaveExternalContractor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อผู้รับเหมา / ศูนย์บริการ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  placeholder="เช่น หจก. เย็นใจแอร์เซอร์วิส"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สาเหตุที่ต้องส่งภายนอก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={contractorReason}
                  onChange={(e) => setContractorReason(e.target.value)}
                  placeholder="เช่น ต้องเชื่อมระบบท่อแวคคั่ม, เครื่องมือช่างหอพักไม่เพียงพอ"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รายละเอียดงานที่ให้ผู้รับเหมาทำ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={contractorDetail}
                  onChange={(e) => setContractorDetail(e.target.value)}
                  placeholder="ระบุเนื้องาน เช่น เปลี่ยนคอมเพรสเซอร์แอร์..."
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    วันที่ส่งงาน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={contractorDate}
                    onChange={(e) => setContractorDate(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ประมาณการค่าใช้จ่าย (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={contractorCost}
                    onChange={(e) => setContractorCost(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรติดต่อผู้รับเหมา
                </label>
                <input
                  type="tel"
                  value={contractorPhone}
                  onChange={(e) => setContractorPhone(e.target.value)}
                  placeholder="เช่น 081-999-8888"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผลการดำเนินงาน / นัดหมาย
                </label>
                <input
                  type="text"
                  value={contractorOutcome}
                  onChange={(e) => setContractorOutcome(e.target.value)}
                  placeholder="เช่น ช่างจะเข้าดำเนินการวันพุธที่ 28 เวลา 10:00 น."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsContractorModalOpen(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs"
                >
                  บันทึกส่งช่างภายนอก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Ticket Confirmation Modal */}
      <ConfirmModal
        isOpen={isCloseModalOpen}
        title="ยืนยันการปิดงานซ่อมแซม"
        message={`คุณต้องการยืนยันว่างานซ่อมแซมใบงาน ${workOrder.id} ได้รับการตรวจสอบและซ่อมแซมเสร็จสิ้นสมบูรณ์แล้วหรือไม่?`}
        confirmText="ยืนยันปิดงาน"
        cancelText="กลับไปแก้ไข"
        isLoading={isUpdating}
        onConfirm={handleCloseTicket}
        onClose={() => setIsCloseModalOpen(false)}
      />

      {/* Cancel Ticket Modal */}
      <ConfirmModal
        isOpen={isCancelModalOpen}
        title="ยืนยันการยกเลิกใบแจ้งซ่อม"
        message={`คุณต้องการยกเลิกใบแจ้งซ่อม ${workOrder.id} หรือไม่? รายการที่ยกเลิกจะไม่สามารถกลับมาดำเนินการต่อได้`}
        confirmText="ยกเลิกใบงาน"
        cancelText="ย้อนกลับ"
        isDestructive={true}
        isLoading={isUpdating}
        onConfirm={handleCancelTicket}
        onClose={() => setIsCancelModalOpen(false)}
      />

      {/* Image Lightbox View */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-zoom-out"
        >
          <img
            src={selectedImage}
            alt="Expanded view"
            className="max-w-4xl max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
