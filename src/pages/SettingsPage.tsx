/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Flame,
  Clock,
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Server,
  Database,
  ExternalLink,
  FolderPlus,
  Tag,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { isFirebaseConfigured, getActiveFirebaseConfig } from '../lib/firebase';
import { fetchTransactions, subscribeRepairCategories } from '../lib/firestoreService';
import { RepairCategory } from '../types';
import { ManageRepairCategoriesModal } from '../components/ManageRepairCategoriesModal';

export const SettingsPage: React.FC = () => {
  const { activeProperty, activePropertyId } = useAuth();
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [categories, setCategories] = useState<RepairCategory[]>([]);
  const [isManageCatOpen, setIsManageCatOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeRepairCategories((cats) => {
      setCategories(cats);
    });
    return () => unsub();
  }, []);

  const configured = isFirebaseConfigured();
  const config = getActiveFirebaseConfig();

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const txs = await fetchTransactions(activePropertyId);
      const backupData = {
        exportedAt: new Date().toISOString(),
        system: 'DormCare Dormitory Maintenance & Inventory System',
        property: activeProperty,
        transactions: txs,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dormcare-backup-${activeProperty?.code || 'all'}-${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('success', 'ดาวน์โหลดไฟล์สำรองข้อมูลสำเร็จ', 'บันทึกเป็นไฟล์ JSON เรียบร้อย');
    } catch (err: unknown) {
      showToast('error', 'การสำรองข้อมูลล้มเหลว', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          การตั้งค่าระบบและนโยบายข้อมูล (System Settings & Policy)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          ตรวจสอบความปลอดภัย นโยบายจัดเก็บข้อมูล และการสำรองข้อมูลภายใต้ข้อกำหนดฟรี 100%
        </p>
      </div>

      {/* Connection & Quota Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">การเชื่อมต่อ Firebase</h3>
              <p className="text-xs text-slate-500">Spark Plan (No Credit Card Required)</p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              configured
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {configured ? 'เชื่อมต่อฐานข้อมูลจริง' : 'โหมดทดลองใช้งาน (Sandbox Demo)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="text-slate-400 font-semibold mb-1">Project ID</div>
            <div className="font-mono font-bold text-slate-800">
              {config?.projectId || 'ยังไม่ได้กำหนด (Sandbox)'}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="text-slate-400 font-semibold mb-1">Auth Domain</div>
            <div className="font-mono font-bold text-slate-800">
              {config?.authDomain || 'dormcare.internal'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-2">
          <div className="font-bold flex items-center gap-1.5 text-blue-950">
            <Info className="w-4 h-4 text-blue-600" /> นโยบายโควต้าและการควบคุมงบประมาณ:
          </div>
          <p className="leading-relaxed">
            ระบบไม่มีการเรียกใช้บริการที่ต้องเปิด Billing หรือผูกบัตรเครดิตใดๆ ทั้งสิ้น
            โดยทำงานภายในขอบเขต Firestore Spark Plan ฟรี (50,000 Reads / วัน, 20,000 Writes / วัน)
            และจำกัดขนาดรูปภาพไม่เกิน 150 KB ต่อรูป เพื่อให้อยู่ภายใต้เพดานเอกสาร 1 MiB อย่างเคร่งครัด
          </p>
        </div>
      </div>

      {/* 365-Day Retention Policy Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              นโยบายการลบข้อมูลเก่าอัตโนมัติเมื่อครบ 365 วัน (Data Retention)
            </h3>
            <p className="text-xs text-slate-500">
              รักษาขนาดฐานข้อมูลให้อยู่ในโควต้าฟรีตลอดอายุการใช้งาน
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            ระบบกำหนดนโยบายลบข้อมูลใบแจ้งซ่อม (Work Orders) และบันทึกการเคลื่อนไหวพัสดุ (Transactions)
            ที่มีอายุครบ <strong>365 วัน</strong> นับจากวันที่สร้างเอกสาร (<code>createdAt</code>)
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-slate-700">
            <div className="font-bold text-slate-900">หลักเกณฑ์การทำงานของ Script ลบข้อมูล:</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>ลบเอกสารและรูปภาพพร้อมกัน:</strong> รูปภาพถูกบีบอัดและฝังในเอกสาร
                เมื่อเอกสารถูกลบ รูปภาพจะถูกทำลายอย่างสมบูรณ์ทันที
              </li>
              <li>
                <strong>ลบ Subcollections:</strong> ทำการลบคอลเลกชันย่อย <code>events</code> ก่อนลบเอกสารหลัก
              </li>
              <li>
                <strong>ปลอดภัย ไม่ลบข้อมูลหลัก:</strong> ข้อมูลบัญชีผู้ใช้, ข้อมูลหอพัก, ห้องพัก
                และยอดพัสดุคงเหลือปัจจุบันจะไม่ถูกลบเด็ดขาด
              </li>
              <li>
                <strong>รันอัตโนมัติฟรี:</strong> สั่งรันทุกเที่ยงคืนผ่าน <strong>GitHub Actions Workflow</strong>{' '}
                โดยไม่ต้องเสียค่าใช้จ่าย Cloud Functions หรือเซิร์ฟเวอร์ใดๆ
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Repair Categories Management Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">หมวดหมู่งานซ่อม (Repair Categories)</h3>
              <p className="text-xs text-slate-500">
                เพิ่ม ลบ และแก้ไขหมวดหมู่งานซ่อมของระบบได้ตามต้องการ ({categories.length} หมวดหมู่)
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsManageCatOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            จัดการหมวดหมู่งานซ่อม
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {categories.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium"
            >
              <Tag className="w-3 h-3 text-indigo-500" />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* Manual Backup Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">การสำรองข้อมูล (Manual Backup)</h3>
              <p className="text-xs text-slate-500">ส่งออกข้อมูลเป็นไฟล์ JSON ไว้ในเครื่องของคุณ</p>
            </div>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'กำลังส่งออก...' : 'ส่งออกข้อมูล (Export JSON)'}
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          แนะนำให้ผู้ดูแลระบบดาวน์โหลดไฟล์สำรองข้อมูลเป็นประจำทุกเดือน เพื่อเก็บเป็นประวัติการทำงานถาวร
          ก่อนที่ระบบล้างข้อมูลอัตโนมัติจะลบข้อมูลเก่าที่มีอายุเกิน 365 วัน
        </p>
      </div>

      {/* Modal จัดการหมวดหมู่งานซ่อม */}
      <ManageRepairCategoriesModal
        isOpen={isManageCatOpen}
        onClose={() => setIsManageCatOpen(false)}
      />
    </div>
  );
};
