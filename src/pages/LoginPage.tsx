/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  Lock,
  User,
  AlertCircle,
  Flame,
  CheckCircle2,
  Shield,
  Users,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  LogIn,
  KeyRound,
  Building2,
  Phone,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { isFirebaseConfigured, auth } from '../lib/firebase';
import { subscribeUsersList, fetchProperties } from '../lib/firestoreService';
import { UserProfile, UserRole, Property } from '../types';
import { sendPasswordResetEmail } from 'firebase/auth';

interface LoginPageProps {
  onOpenFirebaseSetup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onOpenFirebaseSetup }) => {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<'all' | UserRole>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot Password modal
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const configured = isFirebaseConfigured();

  // Load real properties and users directly from Cloud Firestore in real time
  useEffect(() => {
    fetchProperties().then(setProperties).catch(() => {});

    setLoadingUsers(true);
    const unsubscribe = subscribeUsersList((fetchedUsers) => {
      setUsers(fetchedUsers);
      setLoadingUsers(false);

      // Default select admin if nothing selected yet
      if (!selectedUser && fetchedUsers.length > 0) {
        const primaryAdmin =
          fetchedUsers.find((u) => u.role === 'admin') || fetchedUsers[0];
        if (primaryAdmin) {
          setSelectedUser(primaryAdmin);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // When a user is selected, automatically focus on the password field
  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setErrorMsg(null);
    setPassword('');
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  };

  // Filter users by selected role and search query
  const filteredUsers = users.filter((u) => {
    if (selectedRole !== 'all' && u.role !== selectedRole) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        u.displayName?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        (u.username && u.username.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Calculate count per role (Roles: admin, staff, resident = ผู้ใช้งาน)
  const roleCounts = {
    all: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    staff: users.filter((u) => u.role === 'staff').length,
    resident: users.filter((u) => u.role === 'resident').length,
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetIdentifier = manualMode ? manualIdentifier.trim() : (selectedUser?.displayName || selectedUser?.uid || '');
    const cleanPass = password.trim();

    if (!targetIdentifier) {
      setErrorMsg(manualMode ? 'กรุณากรอกชื่อ - นามสกุลจริง' : 'กรุณาเลือกผู้ใช้งานจากรายการตามบทบาท');
      return;
    }

    if (!cleanPass) {
      setErrorMsg('กรุณากรอกรหัสผ่านยืนยันตัวตน');
      passwordInputRef.current?.focus();
      return;
    }

    setIsLoggingIn(true);

    try {
      await login(targetIdentifier, cleanPass);
      showToast('success', 'เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับสู่ระบบ DormCare`);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const msg = err instanceof Error ? err.message : 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
      setErrorMsg(msg);
      showToast('error', 'เข้าสู่ระบบไม่สำเร็จ', msg);
    } finally {
      setIsLoggingIn(false);
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

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: 'ผู้ดูแลระบบ',
          bg: 'bg-indigo-100 text-indigo-700 border-indigo-200',
          icon: <Shield className="w-3.5 h-3.5 text-indigo-600" />,
        };
      case 'staff':
        return {
          label: 'ช่าง / เจ้าหน้าที่',
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <Wrench className="w-3.5 h-3.5 text-amber-600" />,
        };
      case 'resident':
        return {
          label: 'ผู้ใช้งาน',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: <User className="w-3.5 h-3.5 text-emerald-600" />,
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xl shadow-indigo-500/30 mb-3">
            <Wrench className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            DormCare
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            ระบบบริหารงานแจ้งซ่อมและคลังวัสดุหอพัก
          </p>
        </div>

        {/* Login Main Card */}
        <div className="bg-white/95 backdrop-blur-md shadow-2xl rounded-3xl border border-slate-100 overflow-hidden">
          {/* Top Card Bar */}
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <LogIn className="w-4 h-4 text-indigo-600" />
                เข้าสู่ระบบ
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกผู้ใช้งานตามบทบาทจากฐานข้อมูลจริง แล้วกรอกรหัสผ่านเพื่อเข้าสู่ระบบ
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setManualMode(!manualMode);
                setErrorMsg(null);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
            >
              {manualMode ? '← เลือกผู้ใช้ตามบทบาท' : 'พิมพ์ชื่อจริงเอง'}
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="font-semibold leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {!manualMode ? (
              <div>
                {/* STEP 1: ROLE SELECTION TABS */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      เลือกบทบาทผู้ใช้งาน
                    </label>
                    <span className="text-[11px] text-slate-400">
                      ทั้งหมด {users.length} บัญชี
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Role: All */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('all')}
                      className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        selectedRole === 'all'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>ทั้งหมด</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        selectedRole === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {roleCounts.all}
                      </span>
                    </button>

                    {/* Role: Admin */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('admin')}
                      className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        selectedRole === 'admin'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30'
                          : 'bg-indigo-50/60 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100/60'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>ผู้ดูแลระบบ</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        selectedRole === 'admin' ? 'bg-indigo-800 text-white' : 'bg-indigo-200/80 text-indigo-800'
                      }`}>
                        {roleCounts.admin}
                      </span>
                    </button>

                    {/* Role: Staff */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('staff')}
                      className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        selectedRole === 'staff'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/30'
                          : 'bg-amber-50/60 text-amber-800 border-amber-200/80 hover:bg-amber-100/60'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>ช่าง/เจ้าหน้าที่</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        selectedRole === 'staff' ? 'bg-amber-800 text-white' : 'bg-amber-200/80 text-amber-800'
                      }`}>
                        {roleCounts.staff}
                      </span>
                    </button>

                    {/* Role: User (เปลี่ยนจาก ผู้พักอาศัย เป็น ผู้ใช้งาน) */}
                    <button
                      type="button"
                      onClick={() => setSelectedRole('resident')}
                      className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                        selectedRole === 'resident'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30'
                          : 'bg-emerald-50/60 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/60'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>ผู้ใช้งาน</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        selectedRole === 'resident' ? 'bg-emerald-800 text-white' : 'bg-emerald-200/80 text-emerald-800'
                      }`}>
                        {roleCounts.resident}
                      </span>
                    </button>
                  </div>
                </div>

                {/* STEP 2: USER SELECTION FROM FIRESTORE (ใช้ชื่อ-นามสกุลจริง) */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      เลือกบัญชีผู้ใช้งาน
                    </label>

                    {/* Search box */}
                    <div className="relative w-44 sm:w-56">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อ-นามสกุล, เบอร์โทร..."
                        className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1.5 pointer-events-none" />
                    </div>
                  </div>

                  {loadingUsers ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
                      <p className="text-xs text-slate-600 font-medium">กำลังโหลดรายชื่อผู้ใช้จาก Firebase Cloud Firestore...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500">
                      <User className="w-6 h-6 text-slate-400 mx-auto mb-1.5 opacity-60" />
                      {searchQuery ? 'ไม่พบผู้ใช้ที่ตรงกับคำค้นหา' : 'ยังไม่มีผู้ใช้ในบทบาทนี้ในฐานข้อมูล'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {filteredUsers.map((user) => {
                        const isSelected = selectedUser?.uid === user.uid;
                        const badge = getRoleBadge(user.role);
                        const assignedProps = properties.filter((p) => user.propertyIds?.includes(p.id));

                        return (
                          <div
                            key={user.uid}
                            onClick={() => handleSelectUser(user)}
                            className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 relative ${
                              isSelected
                                ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70'
                            }`}
                          >
                            {/* Role Avatar */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${badge.bg}`}>
                              {badge.icon}
                            </div>

                            {/* Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {user.displayName}
                                </span>
                                {isSelected && (
                                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 ml-auto" />
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.bg}`}>
                                  {badge.label}
                                </span>
                                {user.phone && (
                                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
                                    <Phone className="w-2.5 h-2.5 text-slate-400" />
                                    {user.phone}
                                  </span>
                                )}
                              </div>

                              {assignedProps.length > 0 && (
                                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 truncate">
                                  <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">
                                    {assignedProps.map((p) => p.code).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* STEP 3: PASSWORD CONFIRMATION */}
                <form onSubmit={handleLogin} className="mt-5 pt-5 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      กรอกรหัสผ่านเพื่อเข้าสู่ระบบ
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(true)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>

                  {selectedUser ? (
                    <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                          {selectedUser.displayName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            เข้าสู่ระบบในนาม: {selectedUser.displayName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            ระดับสิทธิ์: {getRoleBadge(selectedUser.role).label}
                            {selectedUser.phone ? ` • โทร: ${selectedUser.phone}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        พร้อมยืนยันรหัสผ่าน
                      </span>
                    </div>
                  ) : (
                    <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>กรุณาคลิกเลือกผู้ใช้งานจากรายการด้านบนก่อนกรอกรหัสผ่าน</span>
                    </div>
                  )}

                  <div className="relative mb-4">
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={selectedUser ? `กรอกรหัสผ่านของ "${selectedUser.displayName}"` : 'กรอกรหัสผ่านเพื่อเข้าใช้งาน'}
                      disabled={!selectedUser}
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn || !selectedUser}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoggingIn && (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {isLoggingIn ? 'กำลังตรวจสอบรหัสผ่านกับ Cloud Firestore...' : 'ยืนยันรหัสผ่านและเข้าสู่ระบบ'}
                  </button>
                </form>
              </div>
            ) : (
              /* MANUAL NAME/PASSWORD FORM (พิมพ์ชื่อ-นามสกุลจริง) */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ - นามสกุลจริง (หรือชื่อผู้ใช้งาน)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualIdentifier}
                      onChange={(e) => setManualIdentifier(e.target.value)}
                      placeholder="เช่น ผู้ดูแลระบบหลัก (Admin) หรือชื่อของคุณ"
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
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="ระบุรหัสผ่าน"
                      required
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full mt-3 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoggingIn && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isLoggingIn ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">รีเซ็ตรหัสผ่าน</h3>
            <p className="text-xs text-slate-600 mb-4">
              กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
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
