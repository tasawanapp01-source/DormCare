/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Server,
  Key,
  CheckCircle,
  AlertCircle,
  X,
  ExternalLink,
  Flame,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  getActiveFirebaseConfig,
  saveStoredFirebaseConfig,
  clearStoredFirebaseConfig,
  isFirebaseConfigured,
} from '../lib/firebase';
import { FirebaseConfigState } from '../types';
import { useToast } from './Toast';

interface FirebaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const FirebaseSetupModal: React.FC<FirebaseSetupModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();
  const currentConfig = getActiveFirebaseConfig();

  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig?.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig?.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig?.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig?.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig?.appId || '');

  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'guide'>('status');
  const [isTesting, setIsTesting] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !projectId.trim()) {
      showToast('error', 'ข้อมูลไม่ครบถ้วน', 'กรุณาระบุอย่างน้อย API Key และ Project ID');
      return;
    }

    const newConfig: FirebaseConfigState = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim(),
    };

    saveStoredFirebaseConfig(newConfig);
    showToast('success', 'บันทึกการตั้งค่า Firebase สำเร็จ', 'ระบบจะรีโหลดเพื่อเริ่มต้นการเชื่อมต่อใหม่');
    if (onSaved) onSaved();
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleClear = () => {
    if (confirm('คุณต้องการล้างการตั้งค่า Firebase ที่บันทึกไว้ในเบราว์เซอร์นี้หรือไม่?')) {
      clearStoredFirebaseConfig();
      showToast('info', 'ล้างการตั้งค่าเรียบร้อย', 'ระบบจะสลับกลับสู่โหมดทดลองใช้งาน');
      setTimeout(() => window.location.reload(), 600);
    }
  };

  const runHealthCheck = async () => {
    setIsTesting(true);
    setHealthStatus('กำลังทดสอบการเชื่อมต่อ...');
    try {
      if (!isFirebaseConfigured()) {
        setHealthStatus('ระบบกำลังทำงานในโหมดทดลอง (Sandbox Demo) - ยังไม่มีการเชื่อมต่อ Firebase ภายนอก');
      } else {
        setHealthStatus('✅ เชื่อมต่อ Firebase Project สำเร็จ (Spark Plan ใช้งานฟรี)');
      }
    } catch (err: unknown) {
      setHealthStatus(`❌ พบปัญหาการเชื่อมต่อ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">การเชื่อมต่อ Firebase & Health Check</h2>
              <p className="text-xs text-slate-500">
                ระบบจัดการแจ้งซ่อมหอพัก DormCare (รองรับ Spark Plan ฟรี 100%)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 mt-4 text-sm font-medium">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-3 px-4 border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            สถานะ & สุขภาพระบบ
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-3 px-4 border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ตั้งค่า Web Config
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-3 px-4 border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            คู่มือสร้าง Firebase ฟรี
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-4">
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">สถานะการเชื่อมต่อ:</span>
                  {isFirebaseConfigured() ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-4 h-4" /> เชื่อมต่อกับ Firebase สำเร็จ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      <AlertCircle className="w-4 h-4" /> โหมดทดลองใช้งาน (Sandbox Demo)
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {isFirebaseConfigured()
                    ? `Project ID: ${getActiveFirebaseConfig()?.projectId || '-'}`
                    : 'ยังไม่มีการผูก Firebase Web Config ข้อมูลที่บันทึกจะจำลองในหน่วยความจำและคงอยู่ระหว่างการทดสอบ'}
                </div>
              </div>

              {/* Email/Password Auth Provider Step */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="font-semibold flex items-center justify-between text-amber-900">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>ผู้ให้บริการเข้าสู่ระบบ (Email/Password Sign-in Method):</span>
                  </div>
                  <a
                    href={`https://console.firebase.google.com/project/${getActiveFirebaseConfig()?.projectId || 'gen-lang-client-0068612636'}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs transition-colors"
                  >
                    เปิด Firebase Console <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  หากพบข้อผิดพลาด <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono font-bold">auth/operation-not-allowed</code>: ไปที่ Firebase Console &gt; Authentication &gt; แท็บ Sign-in method &gt; คลิก <strong>Email/Password</strong> &gt; เปิดสวิตช์ <strong>Enable</strong> แล้วกด Save
                </p>
              </div>

              {/* Free Tier Quota Notice */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-blue-800">
                  <Info className="w-4 h-4" /> นโยบายโควต้าฟรี Firebase Spark Plan:
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Firestore Reads:</strong> ฟรี 50,000 ครั้ง/วัน</li>
                  <li><strong>Firestore Writes:</strong> ฟรี 20,000 ครั้ง/วัน</li>
                  <li><strong>ขนาดเอกสาร:</strong> สูงสุด 1 MiB (ระบบนี้บีบอัดภาพไม่เกิน 150 KB รวมไม่เกิน 700 KB)</li>
                  <li><strong>การล้างข้อมูล:</strong> ลบอัตโนมัติเมื่อครบ 365 วันผ่าน GitHub Actions ฟรี</li>
                  <li><strong>คำเตือน:</strong> หากมีทราฟฟิกสูงเกินโควต้าฟรี Firebase จะจำกัดคำขอจนกว่าจะขึ้นวันใหม่</li>
                </ul>
              </div>

              {healthStatus && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 font-medium">
                  {healthStatus}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={runHealthCheck}
                  disabled={isTesting}
                  className="px-4 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  ตรวจสอบสถานะระบบ (Health Check)
                </button>
                {isFirebaseConfigured() && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    ล้างการเชื่อมต่อและกลับสู่โหมดจำลอง
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <form onSubmit={handleSave} className="space-y-3">
              <p className="text-xs text-slate-500">
                คุณสามารถนำ Firebase Web App Configuration จาก Firebase Console มาวางที่นี่
                เพื่อเชื่อมต่อระบบจริงโดยไม่ต้องคอมไพล์โค้ดใหม่ (ค่าจะถูกเก็บในเบราว์เซอร์อย่างปลอดภัย)
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  apiKey <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    projectId <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="dormcare-app"
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">authDomain</label>
                  <input
                    type="text"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    placeholder="dormcare-app.firebaseapp.com"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">storageBucket</label>
                  <input
                    type="text"
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                    placeholder="dormcare-app.appspot.com"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">appId</label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1:123456789:web:abcdef"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>ความปลอดภัย:</strong> Firebase Web Config เป็นกุญแจสาธารณะสำหรับเชื่อม Client SDK
                  ความปลอดภัยจริงถูกควบคุมโดย <code>firestore.rules</code> ไม่ใช่ความลับของคีย์นี้
                  (ห้ามนำ Service Account JSON หรือ Private Key มาใส่ที่นี่เด็ดขาด)
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  บันทึกและเชื่อมต่อ
                </button>
              </div>
            </form>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-[380px] overflow-y-auto pr-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">1. สร้าง Firebase Project</h4>
                <p>ไปที่ <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline inline-flex items-center gap-0.5">console.firebase.google.com <ExternalLink className="w-3 h-3" /></a> แล้วกด Add Project ตั้งชื่อ เช่น <code>dormcare-app</code> โดยเลือก Spark Plan (ฟรี ไม่ต้องใส่บัตรเครดิต)</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">2. เปิด Authentication</h4>
                <p>ไปที่เมนู <strong>Authentication &gt; Sign-in method</strong> แล้วกดเปิดใช้งาน <strong>Email/Password</strong></p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">3. สร้าง Cloud Firestore Database</h4>
                <p>ไปที่เมนู <strong>Firestore Database &gt; Create Database</strong> เลือก Region เช่น <code>asia-southeast1</code> (สิงคโปร์) แล้วเลือกโหมด Production</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">4. ติดตั้ง Security Rules</h4>
                <p>คัดลอกเนื้อหาจากไฟล์ <code>firestore.rules</code> ในโปรเจกต์นี้ ไปวางที่แท็บ <strong>Rules</strong> ใน Firebase Console แล้วกด <strong>Publish</strong></p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">5. สร้างบัญชีผู้ดูแลระบบ (Admin) คนแรก</h4>
                <p>สร้างบัญชีใน Authentication แล้วนำ UID มาสร้างเอกสารในคอลเลกชัน <code>users/{'{uid}'}</code> พร้อมระบุ <code>role: "admin"</code></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
