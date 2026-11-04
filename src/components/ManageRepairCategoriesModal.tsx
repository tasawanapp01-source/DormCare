/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Tag,
  FolderPlus,
  AlertCircle,
} from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';
import {
  subscribeRepairCategories,
  createRepairCategory,
  updateRepairCategory,
  deleteRepairCategory,
  resetRepairCategoriesToDefault,
} from '../lib/firestoreService';
import { RepairCategory } from '../types';

interface ManageRepairCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory?: (categoryName: string) => void;
}

export const ManageRepairCategoriesModal: React.FC<ManageRepairCategoriesModalProps> = ({
  isOpen,
  onClose,
  onSelectCategory,
}) => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<RepairCategory[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<RepairCategory | null>(null);

  // Reset modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeRepairCategories((cats) => {
      setCategories(cats);
    });
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) {
      showToast('error', 'กรุณากรอกชื่อหมวดหมู่');
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      showToast('error', 'ชื่อหมวดหมู่นี้มีอยู่ในระบบแล้ว');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createRepairCategory(clean);
      setNewCatName('');
      showToast('success', 'เพิ่มหมวดหมู่สำเร็จ', `เพิ่ม "${clean}" เรียบร้อยแล้ว`);
      if (onSelectCategory) {
        onSelectCategory(created.name);
      }
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาดในการเพิ่มหมวดหมู่', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (cat: RepairCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (catId: string) => {
    const clean = editingName.trim();
    if (!clean) {
      showToast('error', 'ชื่อหมวดหมู่ต้องไม่เว้นว่าง');
      return;
    }

    // Check duplicate among other categories
    if (categories.some((c) => c.id !== catId && c.name.toLowerCase() === clean.toLowerCase())) {
      showToast('error', 'ชื่อหมวดหมู่นี้ซ้ำกับรายการอื่น');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateRepairCategory(catId, clean);
      showToast('success', 'แก้ไขหมวดหมู่สำเร็จ', `เปลี่ยนชื่อเป็น "${clean}" เรียบร้อยแล้ว`);
      setEditingId(null);
      setEditingName('');
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาดในการแก้ไข', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (cat: RepairCategory) => {
    setCategoryToDelete(cat);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteRepairCategory(categoryToDelete.id);
      showToast('info', 'ลบหมวดหมู่สำเร็จ', `นำหมวดหมู่ "${categoryToDelete.name}" ออกจากระบบแล้ว`);
      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาดในการลบ', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsSubmitting(true);
    try {
      await resetRepairCategoriesToDefault();
      showToast('success', 'รีเซ็ตสำเร็จ', 'คืนค่าหมวดหมู่งานซ่อมมาตรฐานของระบบแล้ว');
      setIsResetModalOpen(false);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-600" />
              จัดการหมวดหมู่งานซ่อม (Repair Categories)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              เพิ่ม ลบ และแก้ไขหมวดหมู่งานซ่อมตามที่ต้องการ
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Category Form */}
        <div className="py-4 border-b border-slate-100 shrink-0">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            เพิ่มหมวดหมู่งานซ่อมใหม่
          </label>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="เช่น ระบบกลอนประตูดิจิทัล, งานสุขาภิบาล..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !newCatName.trim()}
              className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่
            </button>
          </form>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 min-h-48">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 mb-1">
            <span>รายการหมวดหมู่ทั้งหมด ({categories.length})</span>
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="text-[11px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> คืนค่าเริ่มต้น
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              ยังไม่มีหมวดหมู่งานซ่อมในระบบ กรุณาเพิ่มหมวดหมู่ใหม่
            </div>
          ) : (
            <div className="space-y-1.5">
              {categories.map((cat) => {
                const isEditing = editingId === cat.id;

                if (isEditing) {
                  return (
                    <div
                      key={cat.id}
                      className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200 flex items-center gap-2 text-xs"
                    >
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(cat.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="flex-1 p-1.5 text-xs rounded-lg border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat.id)}
                        disabled={isSubmitting || !editingName.trim()}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                        title="บันทึกการแก้ไข"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
                        title="ยกเลิก"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 flex items-center justify-between text-xs transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Tag className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="แก้ไขชื่อหมวดหมู่"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(cat)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="ลบหมวดหมู่"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            เสร็จสิ้น / ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="ยืนยันการลบหมวดหมู่งานซ่อม"
        message={`คุณต้องการลบหมวดหมู่ "${categoryToDelete?.name}" ออกจากระบบหรือไม่?`}
        confirmText="ยืนยันลบหมวดหมู่"
        cancelText="ยกเลิก"
        isDestructive={true}
        isLoading={isSubmitting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCategoryToDelete(null);
        }}
      />

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="คืนค่าหมวดหมู่งานซ่อมเริ่มต้น"
        message="คุณต้องการคืนค่าหมวดหมู่งานซ่อมเป็นค่าเริ่มต้นมาตรฐานของระบบหรือไม่?"
        confirmText="คืนค่าเริ่มต้น"
        cancelText="ยกเลิก"
        isLoading={isSubmitting}
        onConfirm={handleConfirmReset}
        onClose={() => setIsResetModalOpen(false)}
      />
    </div>
  );
};
