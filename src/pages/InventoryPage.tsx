/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  PlusCircle,
  PackagePlus,
  SlidersHorizontal,
  AlertTriangle,
  PackageMinus,
  History,
  FolderPlus,
  Trash2,
  X,
  Plus,
  Tag,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  subscribeInventory,
  receiveInventoryItem,
  adjustInventoryItem,
  createInventoryItem,
  deleteInventoryItem,
  getStoredCategories,
  saveStoredCategories,
  DEFAULT_INVENTORY_CATEGORIES,
} from '../lib/firestoreService';
import { InventoryItem } from '../types';
import { isAdmin, isStaff, isResident, canResidentSelfWithdraw } from '../lib/permissions';
import { ResidentWithdrawModal } from '../components/ResidentWithdrawModal';

interface InventoryPageProps {
  onNavigateTransactions: () => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ onNavigateTransactions }) => {
  const { userProfile, activeProperty, activePropertyId } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  // Categories state (default: งานประปา, งานไฟฟ้า + custom categories)
  const [customCategories, setCustomCategories] = useState<string[]>(() => getStoredCategories());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  // Add Item Modal
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('งานประปา');
  const [isAddingNewCatInline, setIsAddingNewCatInline] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('ชิ้น');
  const [newItemQuantity, setNewItemQuantity] = useState(10);
  const [newItemMinQuantity, setNewItemMinQuantity] = useState(5);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState(0);
  const [newItemLocation, setNewItemLocation] = useState('');

  // Modals for Actions
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isResidentWithdrawOpen, setIsResidentWithdrawOpen] = useState(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState<InventoryItem | null>(null);

  // Delete Item Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Receive Form
  const [receiveQuantity, setReceiveQuantity] = useState(1);
  const [receivePrice, setReceivePrice] = useState(0);
  const [receiveReason, setReceiveReason] = useState('');

  // Adjust Form
  const [adjustNewQuantity, setAdjustNewQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!activePropertyId) return;
    setLoading(true);

    const unsubscribe = subscribeInventory(activePropertyId, (inv) => {
      setItems(inv);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activePropertyId]);

  // Combined categories list (Guaranteed to include งานประปา, งานไฟฟ้า, plus custom, plus from items)
  const allCategories = Array.from(
    new Set([...DEFAULT_INVENTORY_CATEGORIES, ...customCategories, ...items.map((i) => i.category)])
  ).filter(Boolean);

  const filteredItems = items.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.name.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (categoryFilter !== 'all' && item.category !== categoryFilter) {
      return false;
    }

    if (stockStatusFilter === 'low' && item.quantity > item.minQuantity) {
      return false;
    }
    if (stockStatusFilter === 'out' && item.quantity > 0) {
      return false;
    }

    return true;
  });

  // KPI Calculations
  const totalItemsCount = items.length;
  const lowStockCount = items.filter((i) => i.quantity <= i.minQuantity && i.quantity > 0).length;
  const outOfStockCount = items.filter((i) => i.quantity === 0).length;

  // ----------------------------------------------------
  // Category Management Handlers
  // ----------------------------------------------------
  const handleAddCategory = (catName: string) => {
    const clean = catName.trim();
    if (!clean) {
      showToast('error', 'กรุณาระบุชื่อหมวดหมู่');
      return;
    }
    if (allCategories.includes(clean)) {
      showToast('error', 'หมวดหมู่นี้มีอยู่ในระบบแล้ว');
      return;
    }

    const updated = [...customCategories, clean];
    setCustomCategories(updated);
    saveStoredCategories(updated);
    setNewCatInput('');
    showToast('success', 'เพิ่มหมวดหมู่สำเร็จ', `เพิ่มหมวดหมู่ "${clean}" แล้ว`);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    if (DEFAULT_INVENTORY_CATEGORIES.includes(catToDelete)) {
      showToast('error', 'ไม่สามารถลบหมวดหมู่เริ่มต้นได้', `"${catToDelete}" เป็นหมวดหมู่มาตรฐานของระบบ`);
      return;
    }

    const updated = customCategories.filter((c) => c !== catToDelete);
    setCustomCategories(updated);
    saveStoredCategories(updated);
    showToast('info', 'ลบหมวดหมู่สำเร็จ', `นำหมวดหมู่ "${catToDelete}" ออกแล้ว`);
  };

  // ----------------------------------------------------
  // Add New Item Handlers
  // ----------------------------------------------------
  const handleOpenAddItem = () => {
    // Generate suggested code based on category count
    const prefix = newItemCategory.includes('ประปา')
      ? 'MAT-PL'
      : newItemCategory.includes('ไฟฟ้า')
      ? 'MAT-EL'
      : 'MAT-GEN';
    const nextNum = String(items.length + 1).padStart(3, '0');
    setNewItemCode(`${prefix}-${nextNum}`);
    setNewItemName('');
    setNewItemCategory(allCategories[0] || 'งานประปา');
    setIsAddingNewCatInline(false);
    setInlineCatName('');
    setNewItemUnit('ชิ้น');
    setNewItemQuantity(10);
    setNewItemMinQuantity(5);
    setNewItemUnitPrice(0);
    setNewItemLocation('');
    setIsAddItemModalOpen(true);
  };

  const handleSaveInlineCategory = () => {
    const clean = inlineCatName.trim();
    if (!clean) return;
    if (!allCategories.includes(clean)) {
      const updated = [...customCategories, clean];
      setCustomCategories(updated);
      saveStoredCategories(updated);
    }
    setNewItemCategory(clean);
    setIsAddingNewCatInline(false);
    setInlineCatName('');
    showToast('success', 'เพิ่มหมวดหมู่แล้ว', `เลือกหมวดหมู่ "${clean}"`);
  };

  const handleSubmitAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProperty || !userProfile) {
      showToast('error', 'กรุณาเลือกหอพักก่อนทำรายการ');
      return;
    }

    const cleanCode = newItemCode.trim().toUpperCase();
    const cleanName = newItemName.trim();
    const cleanCategory = isAddingNewCatInline && inlineCatName.trim() ? inlineCatName.trim() : newItemCategory;

    if (!cleanCode || !cleanName) {
      showToast('error', 'กรุณาระบุรหัสและชื่อวัสดุ');
      return;
    }

    // Check duplicate item code in same property
    if (items.some((i) => i.itemCode.toUpperCase() === cleanCode)) {
      showToast('error', 'รหัสพัสดุนี้มีอยู่แล้วในหอพักนี้', `รหัส "${cleanCode}" ถูกใช้งานแล้ว`);
      return;
    }

    // Save category if it's new
    if (cleanCategory && !allCategories.includes(cleanCategory)) {
      const nextCats = [...customCategories, cleanCategory];
      setCustomCategories(nextCats);
      saveStoredCategories(nextCats);
    }

    // Close modal immediately
    setIsAddItemModalOpen(false);

    try {
      await createInventoryItem({
        item: {
          propertyId: activeProperty.id,
          itemCode: cleanCode,
          name: cleanName,
          category: cleanCategory,
          unit: newItemUnit.trim() || 'ชิ้น',
          quantity: Math.max(0, Number(newItemQuantity) || 0),
          minQuantity: Math.max(0, Number(newItemMinQuantity) || 0),
          unitPrice: Math.max(0, Number(newItemUnitPrice) || 0),
          location: newItemLocation.trim() || 'คลังพัสดุกลาง',
          isActive: true,
        },
        user: userProfile,
      });

      showToast('success', 'เพิ่มรายการวัสดุสำเร็จ', `[${cleanCode}] ${cleanName} เพิ่มลงคลังเรียบร้อยแล้ว`);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาดในการบันทึก', err instanceof Error ? err.message : 'Error');
    }
  };

  // ----------------------------------------------------
  // Delete Item Handlers
  // ----------------------------------------------------
  const handleOpenDeleteItem = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    try {
      await deleteInventoryItem(itemToDelete.id);
      showToast('success', 'ลบรายการพัสดุสำเร็จ', `นำ [${itemToDelete.itemCode}] ${itemToDelete.name} ออกจากระบบแล้ว`);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err: unknown) {
      showToast('error', 'ลบไม่สำเร็จ', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // ----------------------------------------------------
  // Stock Receive & Adjust Handlers
  // ----------------------------------------------------
  const handleOpenReceive = (item: InventoryItem) => {
    setSelectedItemForAction(item);
    setReceiveQuantity(10);
    setReceivePrice(item.unitPrice || 0);
    setReceiveReason('รับพัสดุเข้าคลังประจำงวด');
    setIsReceiveModalOpen(true);
  };

  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedItemForAction(item);
    setAdjustNewQuantity(item.quantity);
    setAdjustReason('ตรวจนับพัสดุจริงประจำสัปดาห์');
    setIsAdjustModalOpen(true);
  };

  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction || !userProfile || !activeProperty) return;

    if (receiveQuantity <= 0) {
      showToast('error', 'จำนวนต้องมากกว่า 0');
      return;
    }

    setIsSubmitting(true);
    try {
      await receiveInventoryItem({
        propertyId: activeProperty.id,
        itemId: selectedItemForAction.id,
        quantity: receiveQuantity,
        unitPrice: receivePrice,
        reason: receiveReason.trim(),
        user: userProfile,
      });

      showToast('success', 'บันทึกการรับพัสดุสำเร็จ', `เพิ่ม ${selectedItemForAction.name} จำนวน ${receiveQuantity} ${selectedItemForAction.unit}`);
      setIsReceiveModalOpen(false);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction || !userProfile || !activeProperty) return;

    if (adjustNewQuantity < 0) {
      showToast('error', 'จำนวนคงเหลือต้องไม่ติดลบ');
      return;
    }

    setIsSubmitting(true);
    try {
      await adjustInventoryItem({
        propertyId: activeProperty.id,
        itemId: selectedItemForAction.id,
        newQuantity: adjustNewQuantity,
        reason: adjustReason.trim(),
        user: userProfile,
      });

      showToast('success', 'ปรับปรุงยอดตรวจนับสำเร็จ', `ปรับยอด ${selectedItemForAction.name} เป็น ${adjustNewQuantity} ${selectedItemForAction.unit}`);
      setIsAdjustModalOpen(false);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-indigo-600" />
            คลังวัสดุและอะไหล่ (Inventory Management)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            จัดการรายการวัสดุ เพิ่มหมวดหมู่งานซ่อม และควบคุมยอดสต็อกอย่างแม่นยำ
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(isAdmin(userProfile) || isStaff(userProfile)) && (
            <>
              <button
                onClick={handleOpenAddItem}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                เพิ่มรายการวัสดุ
              </button>

              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-2xs transition-all cursor-pointer"
                title="จัดการหมวดหมู่วัสดุ"
              >
                <FolderPlus className="w-4 h-4 text-indigo-600" />
                จัดการหมวดหมู่
              </button>
            </>
          )}

          {canResidentSelfWithdraw(userProfile, activeProperty) && (
            <button
              onClick={() => setIsResidentWithdrawOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-xs transition-all"
            >
              <PackageMinus className="w-4 h-4" />
              เบิกวัสดุของใช้
            </button>
          )}

          {(isAdmin(userProfile) || isStaff(userProfile)) && (
            <button
              onClick={onNavigateTransactions}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl shadow-2xs transition-all"
            >
              <History className="w-4 h-4 text-slate-500" />
              ประวัติเบิก-รับ
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">จำนวนรายการพัสดุ</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalItemsCount} รายการ</div>
          <div className="text-[11px] text-slate-400 mt-1">
            ใน {allCategories.length} หมวดหมู่งานซ่อม
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">พัสดุใกล้หมด (Alert)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{lowStockCount} รายการ</div>
          <div className="text-[11px] text-slate-400 mt-1">ต่ำกว่าเกณฑ์ขั้นต่ำที่กำหนด</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">หมดสต็อก (Out)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600">{outOfStockCount} รายการ</div>
          <div className="text-[11px] text-slate-400 mt-1">ต้องสั่งซื้อเข้าคลังเร่งด่วน</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อพัสดุ, รหัสสินค้า, ตำแหน่งจัดเก็บ..."
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs py-2.5 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">หมวดหมู่: ทั้งหมด ({allCategories.length})</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="text-xs py-2.5 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">สถานะสต็อก: ทั้งหมด</option>
              <option value="low">ใกล้หมดสต็อก</option>
              <option value="out">หมดสต็อก</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Boxes className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-300" />
            <p className="text-sm font-medium">ไม่พบรายการพัสดุตรงตามเงื่อนไข</p>
            {(isAdmin(userProfile) || isStaff(userProfile)) && (
              <button
                onClick={handleOpenAddItem}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                คลิกเพื่อเพิ่มรายการวัสดุแรก
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">รหัสพัสดุ</th>
                  <th className="p-4">ชื่อวัสดุ / อะไหล่</th>
                  <th className="p-4">หมวดหมู่</th>
                  <th className="p-4">ตำแหน่งจัดเก็บ</th>
                  <th className="p-4 text-right">ยอดคงเหลือ</th>
                  <th className="p-4 text-right">เกณฑ์ขั้นต่ำ</th>
                  <th className="p-4 text-right">ราคา/หน่วย</th>
                  <th className="p-4 text-center">สถานะ</th>
                  {(isAdmin(userProfile) || isStaff(userProfile)) && (
                    <th className="p-4 text-right">การจัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredItems.map((item) => {
                  const isOut = item.quantity === 0;
                  const isLow = item.quantity <= item.minQuantity && !isOut;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-700">
                        {item.itemCode}
                      </td>
                      <td className="p-4 font-semibold text-slate-900">
                        {item.name}
                      </td>
                      <td className="p-4 text-slate-500">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {item.category}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500">{item.location || '-'}</td>
                      <td className="p-4 text-right font-extrabold text-sm">
                        <span className={isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="p-4 text-right text-slate-500">
                        {item.minQuantity} {item.unit}
                      </td>
                      <td className="p-4 text-right text-slate-700">
                        ฿{(item.unitPrice || 0).toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        {isOut ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            หมดสต็อก
                          </span>
                        ) : isLow ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            ใกล้หมด
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            ปกติ
                          </span>
                        )}
                      </td>

                      {(isAdmin(userProfile) || isStaff(userProfile)) && (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenReceive(item)}
                              title="รับพัสดุเข้าคลัง"
                              className="px-2.5 py-1.5 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <PackagePlus className="w-3.5 h-3.5" /> รับเข้า
                            </button>
                            {isAdmin(userProfile) && (
                              <button
                                type="button"
                                onClick={() => handleOpenAdjust(item)}
                                title="ปรับปรุงยอดตรวจนับ"
                                className="px-2.5 py-1.5 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" /> ปรับยอด
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteItem(item)}
                              title="ลบรายการพัสดุ"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* MODAL: เพิ่มรายการวัสดุใหม่ (Add Inventory Item)     */}
      {/* ==================================================== */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                เพิ่มรายการวัสดุและอะไหล่ใหม่
              </h3>
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              กำหนดรหัส ชื่อ หมวดหมู่งานซ่อม และยอดตั้งต้นของวัสดุ
            </p>

            <form onSubmit={handleSubmitAddItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสพัสดุ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                    placeholder="เช่น MAT-PL-001"
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อวัสดุ / อะไหล่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="เช่น ก๊อกน้ำอ่างล้างหน้า, หลอดไฟ LED 9W"
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Category selector with quick add */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    หมวดหมู่งานซ่อม <span className="text-rose-500">*</span>
                  </label>
                  {!isAddingNewCatInline && (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCatInline(true)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> เพิ่มหมวดหมู่ใหม่
                    </button>
                  )}
                </div>

                {isAddingNewCatInline ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inlineCatName}
                      onChange={(e) => setInlineCatName(e.target.value)}
                      placeholder="พิมพ์ชื่อหมวดหมู่ใหม่ เช่น งานแอร์, งานสี"
                      className="flex-1 text-xs p-2.5 rounded-xl border border-indigo-300 bg-indigo-50/40 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveInlineCategory}
                      className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                    >
                      บันทึก
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewCatInline(false);
                        setInlineCatName('');
                      }}
                      className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <select
                    value={newItemCategory}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsAddingNewCatInline(true);
                      } else {
                        setNewItemCategory(e.target.value);
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__add_new__">+ เพิ่มหมวดหมู่ใหม่...</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    หน่วยนับ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="ชิ้น, หลอด, ชุด"
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จำนวนเริ่มต้น <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 0)}
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    จุดเตือนขั้นต่ำ
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newItemMinQuantity}
                    onChange={(e) => setNewItemMinQuantity(parseInt(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ราคา/หน่วย (฿)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItemUnitPrice}
                    onChange={(e) => setNewItemUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ตำแหน่งจัดเก็บในคลัง
                </label>
                <input
                  type="text"
                  value={newItemLocation}
                  onChange={(e) => setNewItemLocation(e.target.value)}
                  placeholder="เช่น ตู้ A ชั้น 2, ชั้นวางหน้าห้องช่าง"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                >
                  บันทึกรายการวัสดุ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: จัดการหมวดหมู่วัสดุ (Manage Categories)       */}
      {/* ==================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-600" />
                จัดการหมวดหมู่วัสดุและอะไหล่
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              กำหนดหมวดหมู่งานซ่อม (เริ่มต้น: งานประปา, งานไฟฟ้า และเพิ่มหมวดหมู่ใหม่ได้ตามต้องการ)
            </p>

            {/* Quick add category input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                เพิ่มหมวดหมู่ใหม่
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="เช่น งานเครื่องปรับอากาศ, งานสี"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory(newCatInput);
                    }
                  }}
                  className="flex-1 text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddCategory(newCatInput)}
                  className="inline-flex items-center gap-1 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> เพิ่ม
                </button>
              </div>
            </div>

            {/* Categories List */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                รายการหมวดหมู่ทั้งหมดในระบบ ({allCategories.length})
              </label>
              <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-slate-50 border border-slate-200/80">
                {allCategories.map((cat) => {
                  const isDefault = DEFAULT_INVENTORY_CATEGORIES.includes(cat);
                  const countInCat = items.filter((i) => i.category === cat).length;

                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/70 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-semibold text-slate-800">{cat}</span>
                        {isDefault && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            เริ่มต้น
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          ({countInCat} รายการ)
                        </span>
                      </div>

                      {!isDefault && countInCat === 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบหมวดหมู่นี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: Receive Stock Modal                           */}
      {/* ==================================================== */}
      {isReceiveModalOpen && selectedItemForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-indigo-600" />
              รับพัสดุเข้าคลัง
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              [{selectedItemForAction.itemCode}] {selectedItemForAction.name} (คงเหลือปัจจุบัน: {selectedItemForAction.quantity} {selectedItemForAction.unit})
            </p>

            <form onSubmit={handleSubmitReceive} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  จำนวนที่รับเข้า ({selectedItemForAction.unit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={receiveQuantity}
                  onChange={(e) => setReceiveQuantity(parseInt(e.target.value) || 1)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ราคาต่อหน่วย (บาท)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={receivePrice}
                  onChange={(e) => setReceivePrice(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  แหล่งที่มา / เลขที่ใบสั่งซื้อ / เหตุผล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={receiveReason}
                  onChange={(e) => setReceiveReason(e.target.value)}
                  placeholder="เช่น ใบสั่งซื้อ PO-2026-015, ซื้อเพิ่มประจำงวด"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรับเข้าคลัง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: Adjust Stock Modal                            */}
      {/* ==================================================== */}
      {isAdjustModalOpen && selectedItemForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-amber-600" />
              ปรับปรุงยอดตรวจนับจริง
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              [{selectedItemForAction.itemCode}] {selectedItemForAction.name} (ยอดในระบบปัจจุบัน: {selectedItemForAction.quantity} {selectedItemForAction.unit})
            </p>

            <form onSubmit={handleSubmitAdjust} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ยอดคงเหลือจริงที่ตรวจนับได้ ({selectedItemForAction.unit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustNewQuantity}
                  onChange={(e) => setAdjustNewQuantity(parseInt(e.target.value) || 0)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เหตุผลในการปรับยอด <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="เช่น ปรับลดยอดพัสดุชำรุดเสียหาย, ตรวจนับสต็อกประจำเดือน"
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs"
                >
                  {isSubmitting ? 'กำลังปรับยอด...' : 'ยืนยันปรับปรุงยอด'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="ยืนยันการลบรายการวัสดุ"
        message={`คุณต้องการลบรายการพัสดุ "[${itemToDelete?.itemCode}] ${itemToDelete?.name}" ออกจากระบบใช่หรือไม่?`}
        confirmText="ลบรายการ"
        cancelText="ยกเลิก"
        isDestructive={true}
        isLoading={isDeletingItem}
        onConfirm={handleConfirmDeleteItem}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
      />

      {/* Resident Self Withdraw Modal */}
      <ResidentWithdrawModal
        isOpen={isResidentWithdrawOpen}
        onClose={() => setIsResidentWithdrawOpen(false)}
        inventoryItems={items}
      />
    </div>
  );
};
