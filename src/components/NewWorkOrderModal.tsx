/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Sparkles,
  FolderPlus,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from './Toast';
import { createWorkOrder, subscribeRepairCategories } from '../lib/firestoreService';
import { compressImage, MAX_IMAGES_PER_TICKET, MAX_IMAGE_SIZE_KB } from '../lib/imageCompression';
import { validateWorkOrderInput } from '../lib/validation';
import { TicketCategory, TicketUrgency, RepairCategory } from '../types';
import { ManageRepairCategoriesModal } from './ManageRepairCategoriesModal';

interface NewWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (ticketId: string) => void;
}

export const NewWorkOrderModal: React.FC<NewWorkOrderModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { userProfile, activeProperty } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<RepairCategory[]>([]);
  const [category, setCategory] = useState<string>('ระบบประปา / สุขภัณฑ์ / ท่อตัน');
  const [urgency, setUrgency] = useState<TicketUrgency>('medium');
  const [building, setBuilding] = useState(userProfile?.building || '-');
  const [room, setRoom] = useState(userProfile?.roomId || '');
  const [description, setDescription] = useState('');
  const [requesterName, setRequesterName] = useState(userProfile?.displayName || '');
  const [requesterPhone, setRequesterPhone] = useState(userProfile?.phone || '');

  const [images, setImages] = useState<Array<{ dataUrl: string; sizeKb: number }>>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isManageCatOpen, setIsManageCatOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeRepairCategories((cats) => {
      setCategories(cats);
      if (cats.length > 0 && !category) {
        setCategory(cats[0].name);
      }
    });
    return () => unsub();
  }, [category]);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES_PER_TICKET) {
      showToast('error', 'จำนวนรูปเกินกำหนด', `สามารถแนบรูปภาพได้ไม่เกิน ${MAX_IMAGES_PER_TICKET} รูปเท่านั้น`);
      return;
    }

    setIsCompressing(true);
    try {
      const newImages = [...images];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await compressImage(file);
        newImages.push({
          dataUrl: res.dataUrl,
          sizeKb: res.sizeKb,
        });
      }
      setImages(newImages);
      showToast('success', 'บีบอัดรูปภาพสำเร็จ', `รูปถูกบีบอัดให้อยู่ในงบพื้นที่จัดเก็บฟรี (< 150 KB)`);
    } catch (err: unknown) {
      showToast('error', 'เกิดข้อผิดพลาดในการประมวลผลรูป', err instanceof Error ? err.message : 'รูปภาพไม่ถูกต้อง');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProperty || !userProfile) {
      showToast('error', 'ไม่สามารถบันทึกได้', 'กรุณาเลือกหอพักก่อนทำรายการ');
      return;
    }

    const val = validateWorkOrderInput({
      category,
      building,
      room,
      description,
      urgency,
      imagesCount: images.length,
    });

    if (!val.isValid) {
      setFormErrors(val.errors);
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณาตรวจสอบข้อมูลในฟอร์มอีกครั้ง');
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);

    try {
      const trimmedDescription = description.trim();
      const ticketId = await createWorkOrder({
        propertyId: activeProperty.id,
        building,
        floor: '', // ลบ ชั้น ออกจากฟอร์ม
        room,
        requesterUid: userProfile.uid,
        requesterName: requesterName || userProfile.displayName,
        requesterPhone: requesterPhone || '-',
        title: trimmedDescription, // นำ รายละเอียดอาการชำรุด ไปแทนหัวข้อการแจ้งซ่อม
        category,
        description: trimmedDescription,
        urgency,
        images: images.map((img) => img.dataUrl),
        status: 'pending',
        materialsUsed: [],
      });

      showToast('success', 'บันทึกการแจ้งซ่อมสำเร็จ', `เลขที่ใบงาน: ${ticketId}`);
      if (onCreated) onCreated(ticketId);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      showToast('error', 'เกิดข้อผิดพลาดในการบันทึก', err instanceof Error ? err.message : 'ไม่สามารถเขียนข้อมูล Firestore ได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">แจ้งซ่อมใหม่ (New Maintenance Request)</h2>
              <p className="text-xs text-slate-500">
                หอพัก: [{activeProperty?.code}] {activeProperty?.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* รายละเอียดอาการชำรุด (นำมาแทนที่หัวข้อการแจ้งซ่อมเดิม) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รายละเอียดอาการชำรุด <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ระบุจุดที่ชำรุด อาการผิดปกติ หรือปัญหาที่พบ เช่น ก๊อกน้ำอ่างล้างหน้ารั่ว, หลอดไฟห้องนอนดับ, แอร์มีน้ำหยด..."
                required
                className="w-full text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {formErrors.description && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.description}</p>
              )}
            </div>

            {/* Category & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    หมวดหมู่งานซ่อม <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsManageCatOpen(true)}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    title="เพิ่ม ลบ แก้ไขหมวดหมู่งานซ่อม"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> จัดการหมวดหมู่
                  </button>
                </div>
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__manage__') {
                      setIsManageCatOpen(true);
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="__manage__">+ จัดการ / เพิ่มหมวดหมู่งานซ่อม...</option>
                </select>
                {formErrors.category && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.category}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ระดับความเร่งด่วน <span className="text-rose-500">*</span>
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as TicketUrgency)}
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">ทั่วไป (3 - 5 วัน)</option>
                  <option value="medium">ปานกลาง (1 - 2 วัน)</option>
                  <option value="high">เร่งด่วน (ภายใน 24 ชม.)</option>
                  <option value="emergency">ฉุกเฉิน (ทันที เช่น ไฟช็อต/ท่อแตกน้ำท่วม)</option>
                </select>
              </div>
            </div>

            {/* เลขที่ห้อง / จุดที่เกิดปัญหา (ลบ ชั้น / รายละเอียดเพิ่มเติม ออกแล้ว) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เลขที่ห้อง / จุดที่เกิดปัญหา <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="เช่น 204 หรือ โถงทางเดินชั้น 2"
                required
                className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {formErrors.room && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.room}</p>
              )}
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อผู้แจ้ง
                </label>
                <input
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  required
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <input
                  type="tel"
                  value={requesterPhone}
                  onChange={(e) => setRequesterPhone(e.target.value)}
                  placeholder="เช่น 081-234-5678"
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            {/* Image Upload with Client-Side Compression */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  รูปภาพประกอบ (สูงสุด {MAX_IMAGES_PER_TICKET} รูป)
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  โควต้าฟรี: บีบอัดอัตโนมัติ &le; {MAX_IMAGE_SIZE_KB} KB/รูป
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative rounded-2xl border border-slate-200 overflow-hidden group aspect-video bg-slate-100">
                    <img src={img.dataUrl} alt={`Attached ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-xs font-mono">
                      {img.sizeKb} KB
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {images.length < MAX_IMAGES_PER_TICKET && (
                  <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl aspect-video flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-indigo-50/30">
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 mb-1" />
                    <span className="text-xs font-medium text-slate-600">
                      {isCompressing ? 'กำลังบีบอัดภาพ...' : '+ เพิ่มรูปถ่าย'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">JPEG หรือ WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isCompressing}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {formErrors.images && (
                <p className="text-xs text-rose-500 mt-1">{formErrors.images}</p>
              )}
            </div>

            {/* Notice */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-[11px] flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                เมื่อแจ้งซ่อมแล้ว ช่างประจำหอพักจะได้รับการแจ้งเตือนและมองเห็นรายการทันทีผ่านระบบ Real-time
              </span>
            </div>

            {/* Submit Actions */}
            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressing}
                className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                ส่งใบแจ้งซ่อม
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal จัดการหมวดหมู่งานซ่อม */}
      <ManageRepairCategoriesModal
        isOpen={isManageCatOpen}
        onClose={() => setIsManageCatOpen(false)}
        onSelectCategory={(catName) => setCategory(catName)}
      />
    </>
  );
};
