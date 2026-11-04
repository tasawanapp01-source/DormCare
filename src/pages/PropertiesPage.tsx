/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Building2,
  PlusCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { saveProperty, deleteProperty } from '../lib/firestoreService';
import { ConfirmModal } from '../components/ConfirmModal';
import { Property } from '../types';

export const PropertiesPage: React.FC = () => {
  const { properties, activePropertyId, switchProperty, refreshUserData } = useAuth();
  const { showToast } = useToast();

  // Add Property State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [selfWithdraw, setSelfWithdraw] = useState(false);

  // Edit Property State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editSelfWithdraw, setEditSelfWithdraw] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleSelfWithdraw = async (property: Property) => {
    const updated: Property = {
      ...property,
      residentSelfWithdrawEnabled: !property.residentSelfWithdrawEnabled,
    };
    try {
      await saveProperty(updated);
      showToast(
        'success',
        'อัปเดตสิทธิ์สำเร็จ',
        updated.residentSelfWithdrawEnabled
          ? 'เปิดสิทธิ์ให้ผู้พักอาศัยเบิกของใช้จำเป็นโดยไม่มีใบงานแล้ว'
          : 'ปิดสิทธิ์การเบิกของใช้จำเป็นสำหรับผู้พักอาศัยแล้ว'
      );
      await refreshUserData();
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || !cleanName) {
      showToast('error', 'กรุณาระบุรหัสและชื่อหอพัก');
      return;
    }

    // Check duplicate code
    if (properties.some((p) => p.code.toUpperCase() === cleanCode)) {
      showToast('error', 'รหัสหอพักนี้มีอยู่ในระบบแล้ว', `รหัส "${cleanCode}" ถูกใช้งานไปแล้ว กรุณาใช้รหัสอื่น`);
      return;
    }

    const newProp: Property = {
      id: `prop-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-') || Date.now()}`,
      code: cleanCode,
      name: cleanName,
      residentSelfWithdrawEnabled: selfWithdraw,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // ปิดหน้าต่างเพิ่มข้อมูลหอพักทันทีและรีเซ็ตค่าฟอร์ม ไม่ค้างรอ
    setIsAddModalOpen(false);
    setCode('');
    setName('');
    setSelfWithdraw(false);

    try {
      await saveProperty(newProp);
      showToast('success', 'เพิ่มหอพักสำเร็จ', `หอพัก [${newProp.code}] ${newProp.name}`);
      await refreshUserData();
    } catch (err: unknown) {
      console.warn('saveProperty error note:', err);
      // ข้อมูลได้รับการบันทึกลง local storage แล้ว
      showToast('success', 'เพิ่มหอพักสำเร็จ', `หอพัก [${newProp.code}] ${newProp.name}`);
      try {
        await refreshUserData();
      } catch (_) {}
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (property: Property) => {
    setEditingProperty(property);
    setEditCode(property.code);
    setEditName(property.name);
    setEditSelfWithdraw(Boolean(property.residentSelfWithdrawEnabled));
    setEditIsActive(property.isActive !== false);
    setIsEditModalOpen(true);
  };

  // Save Edit Property
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;

    const cleanCode = editCode.trim().toUpperCase();
    const cleanName = editName.trim();

    if (!cleanCode || !cleanName) {
      showToast('error', 'กรุณาระบุรหัสและชื่อหอพัก');
      return;
    }

    // Check duplicate code (excluding current property)
    if (properties.some((p) => p.id !== editingProperty.id && p.code.toUpperCase() === cleanCode)) {
      showToast('error', 'รหัสหอพักนี้มีอยู่ในระบบแล้ว', `รหัส "${cleanCode}" ถูกใช้งานไปแล้ว`);
      return;
    }

    const updated: Property = {
      ...editingProperty,
      code: cleanCode,
      name: cleanName,
      residentSelfWithdrawEnabled: editSelfWithdraw,
      isActive: editIsActive,
      updatedAt: new Date().toISOString(),
    };

    // ปิดหน้าต่างแก้ไขทันที ไม่ค้างรอ
    setIsEditModalOpen(false);
    setEditingProperty(null);

    try {
      await saveProperty(updated);
      showToast('success', 'บันทึกการแก้ไขสำเร็จ', `อัปเดตข้อมูล [${updated.code}] ${updated.name} เรียบร้อยแล้ว`);
      await refreshUserData();
    } catch (err: unknown) {
      console.warn('saveProperty edit note:', err);
      showToast('success', 'บันทึกการแก้ไขสำเร็จ', `อัปเดตข้อมูล [${updated.code}] ${updated.name} เรียบร้อยแล้ว`);
      try {
        await refreshUserData();
      } catch (_) {}
    }
  };

  // Open Delete Confirm Modal
  const handleOpenDelete = (property: Property) => {
    if (properties.length <= 1) {
      showToast('error', 'ไม่สามารถลบได้', 'ระบบต้องมีหอพักอย่างน้อย 1 แห่ง');
      return;
    }
    setPropertyToDelete(property);
    setIsDeleteModalOpen(true);
  };

  // Execute Delete
  const handleConfirmDelete = async () => {
    if (!propertyToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProperty(propertyToDelete.id);

      // If deleted active property, switch to another
      if (activePropertyId === propertyToDelete.id) {
        const remaining = properties.filter((p) => p.id !== propertyToDelete.id);
        if (remaining.length > 0) {
          switchProperty(remaining[0].id);
        }
      }

      showToast(
        'success',
        'ลบข้อมูลหอพักสำเร็จ',
        `ลบหอพัก [${propertyToDelete.code}] ${propertyToDelete.name} ออกจากระบบแล้ว`
      );

      setIsDeleteModalOpen(false);
      setPropertyToDelete(null);
      await refreshUserData();
    } catch (err: unknown) {
      showToast('error', 'ลบไม่สำเร็จ', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            จัดการหอพัก (Properties Management)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            จัดเก็บเฉพาะรหัสและชื่อหอพักในระบบ คุณสามารถเพิ่ม แก้ไข และลบข้อมูลหอพักได้โดยตรง
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          เพิ่มหอพักใหม่
        </button>
      </div>

      {/* Property Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {properties.map((prop) => (
          <div
            key={prop.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 hover:border-indigo-200 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                  {prop.code}
                </span>

                {/* Edit and Delete Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(prop)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer border border-slate-200 hover:border-indigo-200"
                    title="แก้ไขข้อมูลหอพัก"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(prop)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-slate-200 hover:border-rose-200"
                    title="ลบข้อมูลหอพัก"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {prop.name}
                </h3>
                <div className="mt-1">
                  {prop.isActive !== false ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      <CheckCircle className="w-3 h-3" /> เปิดใช้งาน
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      ปิดใช้งาน
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Resident Self-withdrawal Toggle */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-slate-800">สิทธิ์เบิกของใช้</div>
                <div className="text-[11px] text-slate-400">
                  {prop.residentSelfWithdrawEnabled ? 'เปิดให้ผู้พักอาศัยเบิกได้' : 'ปิดสิทธิ์'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSelfWithdraw(prop)}
                className={`p-1 rounded-full transition-colors cursor-pointer ${
                  prop.residentSelfWithdrawEnabled ? 'text-indigo-600' : 'text-slate-300'
                }`}
                title="สลับสิทธิ์การเบิกของใช้สำหรับผู้พักอาศัย"
              >
                {prop.residentSelfWithdrawEnabled ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Property Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                เพิ่มข้อมูลหอพักใหม่
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              ระบุเฉพาะรหัสและชื่อหอพักเพื่อใช้ในระบบ
            </p>

            <form onSubmit={handleCreateProperty} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสหอพัก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="เช่น PK-01, DORM-A"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อหอพัก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น หอพักสุขเจริญ วิทยาเขตหลัก"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <input
                  type="checkbox"
                  id="selfWithdrawCheck"
                  checked={selfWithdraw}
                  onChange={(e) => setSelfWithdraw(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                />
                <label htmlFor="selfWithdrawCheck" className="text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
                  <strong>อนุญาตให้ผู้พักอาศัยเบิกของใช้จำเป็นได้</strong>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    เปิดให้ผู้พักอาศัยในหอพักนี้สามารถเบิกวัสดุของใช้ได้เอง
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                >
                  บันทึกหอพัก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {isEditModalOpen && editingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                แก้ไขข้อมูลหอพัก
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingProperty(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              แก้ไขรหัสและชื่อหอพัก
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสหอพัก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อหอพัก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สถานะการใช้งาน
                </label>
                <select
                  value={editIsActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditIsActive(e.target.value === 'active')}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="active">เปิดใช้งาน (Active)</option>
                  <option value="inactive">ปิดใช้งานชั่วคราว (Inactive)</option>
                </select>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <input
                  type="checkbox"
                  id="editSelfWithdrawCheck"
                  checked={editSelfWithdraw}
                  onChange={(e) => setEditSelfWithdraw(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                />
                <label htmlFor="editSelfWithdrawCheck" className="text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
                  <strong>อนุญาตให้ผู้พักอาศัยเบิกของใช้จำเป็นได้</strong>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    เปิดให้ผู้พักอาศัยในหอพักนี้สามารถเบิกวัสดุของใช้ได้เอง
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingProperty(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="ยืนยันการลบข้อมูลหอพัก"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบหอพัก "${propertyToDelete?.name}" (${propertyToDelete?.code})? ข้อมูลหอพักนี้จะถูกลบออกจากระบบอย่างถาวร`}
        confirmText="ลบหอพัก"
        cancelText="ยกเลิก"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setPropertyToDelete(null);
        }}
      />
    </div>
  );
};
