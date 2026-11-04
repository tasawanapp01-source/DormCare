/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Wrench,
  Lock,
  User,
  AlertCircle,
  Flame,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { isFirebaseConfigured } from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface LoginPageProps {
  onOpenFirebaseSetup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onOpenFirebaseSetup }) => {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const configured = isFirebaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUser = usernameInput.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setIsLoading(true);

    try {
      await login(cleanUser, cleanPass);
      showToast('success', 'เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับสู่ระบบ DormCare');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      setErrorMsg(msg);
      showToast('error', 'เข้าสู่ระบบไม่สำเร็จ', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    if (!configured || !auth) {
      showToast('info', 'ระบบยังไม่ได้เชื่อมต่อ Auth Mail Service', 'กรุณาติดต่อผู้ดูแลระบบ');
      setIsForgotPasswordOpen(false);
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      showToast('success', 'ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว', 'กรุณาตรวจสอบอีเมลในกล่องจดหมายหรือสแปม');
      setIsForgotPasswordOpen(false);
      setResetEmail('');
    } catch (err: unknown) {
      showToast('error', 'ไม่สามารถส่งลิงก์ได้', err instanceof Error ? err.message : 'กรุณาตรวจสอบอีเมล');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xl shadow-indigo-500/30 mb-4">
            <Wrench className="w-8 h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            DormCare
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            ระบบบริหารงานแจ้งซ่อมและคลังวัสดุหอพัก
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-white/95 backdrop-blur-md py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-100">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">เข้าสู่ระบบ</h3>
              <p className="text-xs text-slate-500 mt-0.5">กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน</p>
            </div>
            <button
              type="button"
              onClick={onOpenFirebaseSetup}
              title="สถานะการเชื่อมต่อฐานข้อมูล"
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors ${
                configured
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Flame className="w-3 h-3" />
              {configured ? 'Firebase เชื่อมต่อแล้ว' : 'ตั้งค่า Firebase'}
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="ระบุชื่อผู้ใช้งาน"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  รหัสผ่าน (Password)
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="ระบุรหัสผ่าน"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">รีเซ็ตรหัสผ่าน</h3>
            <p className="text-xs text-slate-600 mb-4">
              กรอกอีเมลที่คุณลงทะเบียนไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังกล่องจดหมาย
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {isResetting ? 'กำลังส่ง...' : 'ส่งลิงก์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
