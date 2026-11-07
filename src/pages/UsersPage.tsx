/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  User,
  Search,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  X,
  Lock,
  Building2,
  Phone,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  fetchUsersList,
  subscribeUsersList,
  saveUserProfile,
  deleteUserProfile,
} from '../lib/firestoreService';
import { UserProfile, UserRole } from '../types';
import { validateUserCreation } from '../lib/validation';

export const UsersPage: React.FC = () => {
  const { userProfile, properties, activePropertyId } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // New User Modal State - Fields exactly per user specification:
  // 1. ชื่อ - นามสกุล *
  // 2. รหัสผ่านเริ่มต้น *
  // 3. เบอร์โทรศัพท์ติดต่อ
  // 4. ระดับสิทธิ์ (บทบาท) *
  // 5. หอพักที่อนุญาตให้เข้าถึง *
  // 6. สถานะการใช้งาน
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('resident');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([activePropertyId || '']);
  const [isCreating, setIsCreating] = useState(false);

  // Edit User Modal State
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('resident');
  const [editPassword, setEditPassword] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSelectedPropertyIds, setEditSelectedPropertyIds] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Delete User Modal State
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = async () => {
    try {
      const list = await fetchUsersList();
      setUsers(list);
    } catch (err) {
      console.error('Failed to load users from Firestore:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeUsersList((list) => {
      setUsers(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter((u) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        u.displayName?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        (u.username && u.username.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (roleFilter !== 'all' && u.role !== roleFilter) {
      return false;
    }

    return true;
  });

  const togglePropertySelection = (propId: string) => {
    if (selectedPropertyIds.includes(propId)) {
      setSelectedPropertyIds(selectedPropertyIds.filter((id) => id !== propId));
    } else {
      setSelectedPropertyIds([...selectedPropertyIds, propId]);
    }
  };

  const toggleEditPropertySelection = (propId: string) => {
    if (editSelectedPropertyIds.includes(propId)) {
      setEditSelectedPropertyIds(editSelectedPropertyIds.filter((id) => id !== propId));
    } else {
      setEditSelectedPropertyIds([...editSelectedPropertyIds, propId]);
    }
  };

  // -----------------------------------------------------------
  // CREATE USER (บันทึกข้อมูลตามข้อกำหนดลงฐานข้อมูล Firestore โดยตรง)
  // -----------------------------------------------------------
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanDisplayName = newDisplayName.trim();
    const cleanPassword = newPassword.trim();
    const cleanPhone = newPhone.trim();

    const allPropertyIds = properties.map((p) => p.id);
    const effectivePropertyIds =
      (newRole === 'staff' || newRole === 'admin')
        ? (allPropertyIds.length > 0 ? allPropertyIds : selectedPropertyIds)
        : selectedPropertyIds;

    // 1. Validation checks
    const val = validateUserCreation({
      displayName: cleanDisplayName,
      password: cleanPassword,
      phone: cleanPhone,
      role: newRole,
      propertyIds: effectivePropertyIds,
    });

    if (!val.isValid) {
      showToast('error', 'ข้อมูลไม่ถูกต้อง', Object.values(val.errors)[0]);
      return;
    }

    // Check duplicate full name in database
    const duplicateUser = users.find(
      (u) => u.displayName?.trim().toLowerCase() === cleanDisplayName.toLowerCase()
    );
    if (duplicateUser) {
      showToast(
        'error',
        'ชื่อ - นามสกุลนี้มีอยู่ในระบบแล้ว',
        `ชื่อ "${cleanDisplayName}" มีอยู่ในฐานข้อมูลแล้ว กรุณาตรวจสอบ`
      );
      return;
    }

    setIsCreating(true);

    try {
      const createdUid = `user-${Date.now()}`;
      // Internal username for compatibility derived from uid or name
      const generatedUsername = `user_${Date.now().toString().slice(-6)}`;

      const newProfile: UserProfile = {
        uid: createdUid,
        displayName: cleanDisplayName,
        password: cleanPassword,
        phone: cleanPhone || '',
        role: newRole,
        propertyIds: effectivePropertyIds,
        isActive: true,
        username: generatedUsername,
        createdAt: new Date().toISOString(),
      };

      // Save directly to Firestore database
      await saveUserProfile(newProfile);

      // Instant optimistic UI update
      setUsers((prev) => [newProfile, ...prev.filter((u) => u.uid !== newProfile.uid)]);
      showToast(
        'success',
        'เพิ่มผู้ใช้ลงฐานข้อมูลสำเร็จ',
        `บันทึก "${newProfile.displayName}" เรียบร้อยแล้ว`
      );

      setIsAddUserModalOpen(false);
      resetUserForm();
      await loadUsers();
    } catch (err: unknown) {
      console.error(err);
      showToast('error', 'สร้างบัญชีไม่สำเร็จ', err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsCreating(false);
    }
  };

  const resetUserForm = () => {
    setNewDisplayName('');
    setNewPassword('');
    setNewPhone('');
    setNewRole('resident');
    setSelectedPropertyIds([activePropertyId || '']);
  };

  // -----------------------------------------------------------
  // EDIT USER (แก้ไขข้อมูลผู้ใช้งานลงฐานข้อมูล Firestore โดยตรง)
  // -----------------------------------------------------------
  const handleOpenEdit = (target: UserProfile) => {
    setEditingUser(target);
    setEditDisplayName(target.displayName || '');
    setEditRole(target.role);
    setEditPassword(''); // Blank indicates keep current password
    if (target.role === 'staff' || target.role === 'admin') {
      setEditSelectedPropertyIds(properties.map((p) => p.id));
    } else {
      setEditSelectedPropertyIds(target.propertyIds || []);
    }
    setEditPhone(target.phone || '');
    setEditIsActive(target.isActive !== false);
    setIsEditUserModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const cleanDisplayName = editDisplayName.trim();
    if (cleanDisplayName.length < 2) {
      showToast('error', 'ข้อมูลไม่ถูกต้อง', 'กรุณาระบุชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร');
      return;
    }

    const allPropertyIds = properties.map((p) => p.id);
    const effectivePropertyIds =
      (editRole === 'staff' || editRole === 'admin')
        ? (allPropertyIds.length > 0 ? allPropertyIds : editSelectedPropertyIds)
        : editSelectedPropertyIds;

    if (effectivePropertyIds.length === 0) {
      showToast('error', 'กรุณาเลือกหอพักอย่างน้อย 1 แห่งที่อนุญาตให้เข้าถึง');
      return;
    }

    // Check duplicate full name excluding self
    const duplicate = users.find(
      (u) =>
        u.uid !== editingUser.uid &&
        u.displayName?.trim().toLowerCase() === cleanDisplayName.toLowerCase()
    );
    if (duplicate) {
      showToast(
        'error',
        'ชื่อ - นามสกุลนี้มีอยู่ในระบบแล้ว',
        `ชื่อ "${cleanDisplayName}" ถูกใช้งานโดยบัญชีอื่นแล้ว`
      );
      return;
    }

    setIsEditing(true);

    try {
      const updatedUser: UserProfile = {
        ...editingUser,
        displayName: cleanDisplayName,
        role: editRole,
        propertyIds: effectivePropertyIds,
        phone: editPhone.trim() || '',
        isActive: editIsActive,
        updatedAt: new Date().toISOString(),
      };

      if (editPassword.trim()) {
        updatedUser.password = editPassword.trim();
      }

      await saveUserProfile(updatedUser);

      setUsers((prev) => prev.map((u) => (u.uid === updatedUser.uid ? updatedUser : u)));
      showToast('success', 'แก้ไขข้อมูลสำเร็จ', `อัปเดตข้อมูล ${updatedUser.displayName} ในฐานข้อมูลแล้ว`);
      setIsEditUserModalOpen(false);
      setEditingUser(null);
      await loadUsers();
    } catch (err: unknown) {
      console.error('Save edit user error:', err);
      showToast('error', 'แก้ไขข้อมูลไม่สำเร็จ', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsEditing(false);
    }
  };

  // -----------------------------------------------------------
  // DELETE USER (ลบข้อมูลผู้ใช้งานออกจาก Firestore โดยตรง)
  // -----------------------------------------------------------
  const handleOpenDelete = (target: UserProfile) => {
    if (target.uid === userProfile?.uid) {
      showToast('error', 'ไม่สามารถลบบัญชีตนเองได้', 'คุณกำลังเข้าสู่ระบบด้วยบัญชีนี้อยู่');
      return;
    }
    setUserToDelete(target);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      await deleteUserProfile(userToDelete.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== userToDelete.uid));
      showToast('success', 'ลบผู้ใช้งานสำเร็จ', `ลบข้อมูลผู้ใช้ "${userToDelete.displayName}" ออกจากฐานข้อมูลเรียบร้อยแล้ว`);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      await loadUsers();
    } catch (err: unknown) {
      console.error('Delete user error:', err);
      showToast('error', 'ลบผู้ใช้งานไม่สำเร็จ', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: 'ผู้ดูแลระบบ',
          bg: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: <Shield className="w-3.5 h-3.5 text-rose-600" />,
        };
      case 'staff':
        return {
          label: 'ช่างซ่อม / เจ้าหน้าที่',
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <UserCheck className="w-3.5 h-3.5 text-amber-600" />,
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            จัดการบัญชีผู้ใช้งาน (User Management)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ข้อมูลผู้ใช้งานจัดเก็บตามชื่อ-นามสกุลจริงและผูกกับ Firebase Cloud Firestore โดยตรง
          </p>
        </div>

        <button
          onClick={() => {
            resetUserForm();
            setIsAddUserModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          เพิ่มผู้ใช้งานใหม่
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ - นามสกุลจริง หรือเบอร์โทรศัพท์..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-xs py-2.5 px-3 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
        >
          <option value="all">บทบาท: ทั้งหมด</option>
          <option value="admin">ผู้ดูแลระบบ (Admin)</option>
          <option value="staff">ช่างซ่อม / เจ้าหน้าที่ (Staff)</option>
          <option value="resident">ผู้ใช้งาน (User)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <span className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin inline-block mb-2" />
            <p className="text-xs font-medium">กำลังโหลดข้อมูลผู้ใช้จาก Cloud Firestore...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-300" />
            <p className="text-sm font-medium">ไม่พบผู้ใช้งานในฐานข้อมูล</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4">ชื่อ - นามสกุล</th>
                  <th className="p-4">ระดับสิทธิ์ (บทบาท)</th>
                  <th className="p-4">หอพักที่อนุญาตให้เข้าถึง</th>
                  <th className="p-4">เบอร์โทรศัพท์ติดต่อ</th>
                  <th className="p-4 text-center">สถานะการใช้งาน</th>
                  <th className="p-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredUsers.map((u) => {
                  const assignedPropCodes = properties
                    .filter((p) => u.propertyIds?.includes(p.id))
                    .map((p) => `[${p.code}] ${p.name}`);

                  const isSelf = u.uid === userProfile?.uid;
                  const badge = getRoleBadge(u.role);

                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                          {u.displayName}
                          {isSelf && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                              บัญชีของคุณ
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {u.role === 'staff' || u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200/80">
                              <Building2 className="w-3 h-3 text-indigo-500" />
                              เข้าถึงทุกหอพัก ({properties.length} แห่ง)
                            </span>
                          ) : assignedPropCodes.length > 0 ? (
                            assignedPropCodes.map((label, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold"
                              >
                                {label}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-slate-600">
                        {u.phone ? (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {u.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> ใช้งาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> ระงับการใช้งาน
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            title="แก้ไขข้อมูล"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => handleOpenDelete(u)}
                              title="ลบผู้ใช้งาน"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* ADD USER MODAL - Form strictly follows user specifications: */}
      {/* 1. ชื่อ - นามสกุล *                                      */}
      {/* 2. รหัสผ่านเริ่มต้น *                                     */}
      {/* 3. เบอร์โทรศัพท์ติดต่อ                                      */}
      {/* 4. ระดับสิทธิ์ (บทบาท) *                                  */}
      {/* 5. หอพักที่อนุญาตให้เข้าถึง *                             */}
      {/* 6. สถานะการใช้งาน                                         */}
      {/* ----------------------------------------------------------- */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                เพิ่มผู้ใช้งานใหม่
              </h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Field 1: ชื่อ - นามสกุล * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ - นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="เช่น สมพร อิ่มใจ"
                  required
                  autoFocus
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Field 2: รหัสผ่านเริ่มต้น * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสผ่านเริ่มต้น <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="กำหนดรหัสผ่านอย่างน้อย 4 ตัวอักษร"
                    required
                    minLength={4}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Field 3: เบอร์โทรศัพท์ติดต่อ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="เช่น 081-234-5678"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Field 4: ระดับสิทธิ์ (บทบาท) * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ระดับสิทธิ์ (บทบาท) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="resident">ผู้ใช้งาน (User)</option>
                  <option value="staff">ช่างซ่อม / เจ้าหน้าที่ (Staff)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>

              {/* Field 5: หอพักที่อนุญาตให้เข้าถึง * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หอพักที่อนุญาตให้เข้าถึง <span className="text-rose-500">*</span>
                </label>
                {(newRole === 'staff' || newRole === 'admin') ? (
                  <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 text-xs text-indigo-900 flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-indigo-950">
                        ได้รับสิทธิ์อนุญาตให้เข้าถึงทุกหอพักในระบบ ({properties.length} หอพัก)
                      </div>
                      <div className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                        บทบาท{newRole === 'admin' ? 'ผู้ดูแลระบบ' : 'ช่างซ่อม / เจ้าหน้าที่'} มีสิทธิ์ตรวจดูและจัดการข้อมูลได้ทุกหอพักโดยอัตโนมัติ
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50 max-h-36 overflow-y-auto">
                    {properties.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={selectedPropertyIds.includes(p.id)}
                          onChange={() => togglePropertySelection(p.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>[{p.code}] {p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  disabled={isCreating}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isCreating ? 'กำลังบันทึกลงฐานข้อมูล...' : 'บันทึกผู้ใช้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* EDIT USER MODAL                                             */}
      {/* ----------------------------------------------------------- */}
      {isEditUserModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                แก้ไขข้อมูลผู้ใช้งาน
              </h3>
              <button
                onClick={() => setIsEditUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Field 1: ชื่อ - นามสกุล * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ - นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Field 2: รหัสผ่านใหม่ (หากต้องการเปลี่ยน) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสผ่านใหม่ (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="เว้นว่างไว้หากใช้รหัสผ่านเดิม"
                    minLength={4}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Field 3: เบอร์โทรศัพท์ติดต่อ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="เช่น 081-xxx-xxxx"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Field 4: ระดับสิทธิ์ (บทบาท) * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ระดับสิทธิ์ (บทบาท) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
                >
                  <option value="resident">ผู้ใช้งาน (User)</option>
                  <option value="staff">ช่างซ่อม / เจ้าหน้าที่ (Staff)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>

              {/* Field 5: หอพักที่อนุญาตให้เข้าถึง * */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หอพักที่อนุญาตให้เข้าถึง <span className="text-rose-500">*</span>
                </label>
                {(editRole === 'staff' || editRole === 'admin') ? (
                  <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/70 text-xs text-indigo-900 flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-indigo-950">
                        ได้รับสิทธิ์อนุญาตให้เข้าถึงทุกหอพักในระบบ ({properties.length} หอพัก)
                      </div>
                      <div className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                        บทบาท{editRole === 'admin' ? 'ผู้ดูแลระบบ' : 'ช่างซ่อม / เจ้าหน้าที่'} มีสิทธิ์ตรวจดูและจัดการข้อมูลได้ทุกหอพักโดยอัตโนมัติ
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50 max-h-36 overflow-y-auto">
                    {properties.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={editSelectedPropertyIds.includes(p.id)}
                          onChange={() => toggleEditPropertySelection(p.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>[{p.code}] {p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Field 6: สถานะการใช้งาน */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สถานะการใช้งาน
                </label>
                <select
                  value={editIsActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditIsActive(e.target.value === 'active')}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium"
                >
                  <option value="active">ปกติ (ใช้งานได้)</option>
                  <option value="inactive">ระงับการใช้งาน</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditUserModalOpen(false)}
                  disabled={isEditing}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isEditing ? 'กำลังบันทึกการแก้ไข...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* DELETE CONFIRM MODAL                                        */}
      {/* ----------------------------------------------------------- */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="ยืนยันการลบผู้ใช้งาน"
        message={`คุณต้องการลบผู้ใช้งาน "${userToDelete?.displayName}" หรือไม่? ข้อมูลผู้ใช้นี้จะถูกลบออกจากฐานข้อมูล Cloud Firestore อย่างถาวร`}
        confirmText="ลบผู้ใช้งาน"
        cancelText="ยกเลิก"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
      />
    </div>
  );
};
