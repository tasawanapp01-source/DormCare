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
  Power,
  X,
  Lock,
  Building2,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  fetchUsersList,
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

  // New User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('resident');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([activePropertyId || '']);
  const [newBuilding, setNewBuilding] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit User Modal State
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('resident');
  const [editPassword, setEditPassword] = useState('');
  const [editSelectedPropertyIds, setEditSelectedPropertyIds] = useState<string[]>([]);
  const [editBuilding, setEditBuilding] = useState('');
  const [editFloor, setEditFloor] = useState('');
  const [editRoomId, setEditRoomId] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Delete User Modal State
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [activePropertyId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await fetchUsersList();
      setUsers(list);
    } catch (err) {
      console.error('Failed to load users from Firestore:', err);
      showToast('error', 'โหลดข้อมูลล้มเหลว', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (u.username && u.username.toLowerCase().includes(q)) ||
        u.displayName.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.roomId && u.roomId.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q));
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
  // CREATE USER (บันทึกลงฐานข้อมูล Firestore โดยตรง)
  // -----------------------------------------------------------
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = newUsername.trim().toLowerCase();
    const effectiveEmail = newEmail.trim() ? newEmail.trim() : `${cleanUsername}@dormcare.app`;

    const allPropertyIds = properties.map((p) => p.id);
    const effectivePropertyIds = (newRole === 'staff' || newRole === 'admin')
      ? (allPropertyIds.length > 0 ? allPropertyIds : selectedPropertyIds)
      : selectedPropertyIds;

    // 1. Validation checks
    const val = validateUserCreation({
      username: cleanUsername,
      email: newEmail.trim() || undefined,
      password: newPassword,
      displayName: newDisplayName.trim(),
      role: newRole,
      propertyIds: effectivePropertyIds,
    });

    if (!val.isValid) {
      showToast('error', 'ข้อมูลไม่ถูกต้อง', Object.values(val.errors)[0]);
      return;
    }

    // Check duplicate username in database
    const duplicateUser = users.find(
      (u) => u.username && u.username.toLowerCase() === cleanUsername
    );
    if (duplicateUser) {
      showToast('error', 'ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว', `ชื่อผู้ใช้ "${cleanUsername}" ถูกใช้งานไปแล้ว กรุณาใช้ชื่ออื่น`);
      return;
    }

    if (newEmail.trim()) {
      const duplicateEmail = users.find(
        (u) => u.email && u.email.toLowerCase() === newEmail.trim().toLowerCase()
      );
      if (duplicateEmail) {
        showToast('error', 'อีเมลนี้มีอยู่ในระบบแล้ว', `อีเมล "${newEmail.trim()}" ถูกใช้งานไปแล้ว`);
        return;
      }
    }

    if (newRole === 'resident' && !newRoomId.trim()) {
      showToast('error', 'กรุณาระบุเลขห้อง', 'ผู้พักอาศัยต้องระบุเลขห้องพัก');
      return;
    }

    setIsCreating(true);

    try {
      const createdUid = `user-${Date.now()}`;

      const newProfile: UserProfile = {
        uid: createdUid,
        username: cleanUsername,
        email: effectiveEmail,
        displayName: newDisplayName.trim(),
        role: newRole,
        propertyIds: effectivePropertyIds,
        phone: newPhone.trim() || '',
        password: newPassword.trim(),
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      if (newRole === 'resident') {
        if (newRoomId.trim()) newProfile.roomId = newRoomId.trim();
        if (newBuilding.trim()) newProfile.building = newBuilding.trim();
        if (newFloor.trim()) newProfile.floor = newFloor.trim();
      }

      // Save directly to Firestore database
      await saveUserProfile(newProfile);

      // Instant optimistic UI update
      setUsers((prev) => [newProfile, ...prev.filter((u) => u.uid !== newProfile.uid)]);
      showToast(
        'success',
        'เพิ่มผู้ใช้ลงฐานข้อมูลสำเร็จ',
        `ชื่อผู้ใช้ "${newProfile.username}" (${newProfile.displayName}) บันทึกเรียบร้อยแล้ว`
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
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    setNewDisplayName('');
    setNewRoomId('');
    setNewBuilding('');
    setNewFloor('');
    setNewPhone('');
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
    setEditBuilding(target.building || '');
    setEditFloor(target.floor || '');
    setEditRoomId(target.roomId || '');
    setEditPhone(target.phone || '');
    setEditIsActive(target.isActive !== false);
    setIsEditUserModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editDisplayName.trim()) {
      showToast('error', 'กรุณาระบุชื่อ-นามสกุล');
      return;
    }

    const allPropertyIds = properties.map((p) => p.id);
    const effectivePropertyIds = (editRole === 'staff' || editRole === 'admin')
      ? (allPropertyIds.length > 0 ? allPropertyIds : editSelectedPropertyIds)
      : editSelectedPropertyIds;

    if (editRole === 'resident' && effectivePropertyIds.length === 0) {
      showToast('error', 'กรุณาเลือกหอพักอย่างน้อย 1 แห่ง');
      return;
    }

    if (editPassword.trim() && editPassword.trim().length < 6) {
      showToast('error', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (editRole === 'resident' && !editRoomId.trim()) {
      showToast('error', 'กรุณาระบุเลขห้องพักสำหรับผู้พักอาศัย');
      return;
    }

    setIsEditing(true);

    try {
      const updatedUser: UserProfile = {
        ...editingUser,
        displayName: editDisplayName.trim(),
        role: editRole,
        propertyIds: effectivePropertyIds,
        phone: editPhone.trim(),
        isActive: editIsActive,
      };

      if (editPassword.trim()) {
        updatedUser.password = editPassword.trim();
      }

      if (editRole === 'resident') {
        if (editRoomId.trim()) updatedUser.roomId = editRoomId.trim();
        if (editBuilding.trim()) updatedUser.building = editBuilding.trim();
        if (editFloor.trim()) updatedUser.floor = editFloor.trim();
      } else {
        delete updatedUser.roomId;
        delete updatedUser.building;
        delete updatedUser.floor;
      }

      // Save changes directly to Firestore
      await saveUserProfile(updatedUser);

      // Optimistic state update
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

  // -----------------------------------------------------------
  // TOGGLE ACTIVE STATUS
  // -----------------------------------------------------------
  const handleToggleActive = async (targetUser: UserProfile) => {
    if (targetUser.uid === userProfile?.uid) {
      showToast('error', 'ไม่สามารถระงับบัญชีตนเองได้', 'คุณกำลังเข้าสู่ระบบด้วยบัญชีนี้อยู่');
      return;
    }

    const updated: UserProfile = {
      ...targetUser,
      isActive: !targetUser.isActive,
    };

    // Optimistic UI update
    setUsers((prev) => prev.map((u) => (u.uid === updated.uid ? updated : u)));

    try {
      await saveUserProfile(updated);
      showToast(
        'info',
        updated.isActive ? 'เปิดใช้งานบัญชีแล้ว' : 'ระงับการใช้งานบัญชีแล้ว',
        targetUser.displayName
      );
    } catch (err: unknown) {
      setUsers((prev) => prev.map((u) => (u.uid === targetUser.uid ? targetUser : u)));
      showToast('error', 'เกิดข้อผิดพลาด', err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            จัดการบัญชีผู้ใช้งาน (User Management)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ข้อมูลสมาชิกทั้งหมดถูกจัดเก็บและจัดการบนฐานข้อมูล Firebase โดยตรง
          </p>
        </div>

        <button
          onClick={() => setIsAddUserModalOpen(true)}
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
            placeholder="ค้นหาชื่อ, ชื่อผู้ใช้, ห้องพัก หรือเบอร์โทรศัพท์..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-xs py-2.5 px-3 rounded-xl border border-slate-300 bg-white"
        >
          <option value="all">บทบาท: ทั้งหมด</option>
          <option value="admin">ผู้ดูแลระบบ (Admin)</option>
          <option value="staff">ช่างซ่อม (Staff)</option>
          <option value="resident">ผู้พักอาศัย (Resident)</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <span className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin inline-block mb-2" />
            <p className="text-xs font-medium">กำลังโหลดข้อมูลผู้ใช้จากฐานข้อมูล...</p>
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
                  <th className="p-4">ชื่อผู้ใช้งาน (Username)</th>
                  <th className="p-4">บทบาท (Role)</th>
                  <th className="p-4">หอพักที่ดูแล / ห้องพัก</th>
                  <th className="p-4">เบอร์โทร</th>
                  <th className="p-4 text-center">สถานะ</th>
                  <th className="p-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredUsers.map((u) => {
                  const assignedPropCodes = properties
                    .filter((p) => u.propertyIds?.includes(p.id))
                    .map((p) => p.code);

                  const isSelf = u.uid === userProfile?.uid;

                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {u.displayName}
                          {isSelf && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                              บัญชีของคุณ
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">UID: {u.uid.slice(0, 12)}...</div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded w-fit text-xs border border-indigo-100">
                          @{u.username || 'user'}
                        </div>
                        {u.email && !u.email.endsWith('@dormcare.app') && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{u.email}</div>
                        )}
                      </td>
                      <td className="p-4">
                        {u.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <Shield className="w-3 h-3" /> ผู้ดูแลระบบ
                          </span>
                        )}
                        {u.role === 'staff' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <UserCheck className="w-3 h-3" /> ช่างซ่อม / เจ้าหน้าที่
                          </span>
                        )}
                        {u.role === 'resident' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <User className="w-3 h-3" /> ผู้พักอาศัย
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {u.role === 'staff' || u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200/80">
                              <Building2 className="w-3 h-3 text-indigo-500" />
                              เข้าถึงทุกหอพัก ({properties.length} แห่ง)
                            </span>
                          ) : (
                            assignedPropCodes.map((code) => (
                              <span
                                key={code}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold"
                              >
                                {code}
                              </span>
                            ))
                          )}
                          {u.role === 'resident' && u.roomId && (
                            <span className="text-slate-600 font-normal">
                              (ห้อง {u.roomId})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{u.phone || '-'}</td>
                      <td className="p-4 text-center">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" /> ปกติ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                            <XCircle className="w-3.5 h-3.5" /> ระงับใช้งาน
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            title="แก้ไขข้อมูลผู้ใช้"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            แก้ไข
                          </button>

                          {/* Toggle Active button */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf}
                            title={u.isActive ? 'ระงับการใช้งาน' : 'เปิดใช้งาน'}
                            className={`p-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              u.isActive
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(u)}
                            disabled={isSelf}
                            title="ลบผู้ใช้งาน"
                            className="inline-flex items-center p-1.5 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
      {/* ADD USER MODAL */}
      {/* ----------------------------------------------------------- */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
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
            <p className="text-xs text-slate-500 mb-4">
              ข้อมูลจะถูกบันทึกลงในฐานข้อมูล Firestore โดยตรง
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="เช่น tech_somchai, room301"
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">ใช้สำหรับเข้าสู่ระบบ (เฉพาะภาษาอังกฤษ/ตัวเลข)</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสผ่านเริ่มต้น <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    required
                    minLength={6}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อีเมล (ระบุหรือไม่ก็ได้)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="เว้นว่างได้"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 text-slate-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    บทบาทผู้ใช้งาน <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="resident">ผู้พักอาศัย (Resident)</option>
                    <option value="staff">ช่างซ่อม / เจ้าหน้าที่ (Staff)</option>
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>
              </div>

              {/* Multi-Property Assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หอพักที่อนุญาตให้เข้าถึง <span className="text-rose-500">*</span>
                </label>
                {(newRole === 'staff' || newRole === 'admin') ? (
                  <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-xs text-indigo-900 flex items-start gap-2.5">
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
                  <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50 max-h-32 overflow-y-auto">
                    {properties.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
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

              {/* If Resident: Room info */}
              {newRole === 'resident' && (
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขห้องพัก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value)}
                    placeholder="เช่น 301 หรือ 204"
                    required
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="081-xxx-xxxx"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
      {/* EDIT USER MODAL */}
      {/* ----------------------------------------------------------- */}
      {isEditUserModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้ใช้งาน (Username)
                  </label>
                  <input
                    type="text"
                    value={editingUser.username}
                    disabled
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-100 font-mono text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">ชื่อผู้ใช้งานไม่สามารถเปลี่ยนแปลงได้</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสผ่านใหม่ (หากต้องการเปลี่ยน)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="เว้นว่างไว้หากไม่เปลี่ยน"
                      minLength={6}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ - นามสกุล <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    บทบาทผู้ใช้งาน <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="resident">ผู้พักอาศัย (Resident)</option>
                    <option value="staff">ช่างซ่อม / เจ้าหน้าที่ (Staff)</option>
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>
              </div>

              {/* Multi-Property Assignment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หอพักที่อนุญาตให้เข้าถึง <span className="text-rose-500">*</span>
                </label>
                {(editRole === 'staff' || editRole === 'admin') ? (
                  <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-xs text-indigo-900 flex items-start gap-2.5">
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
                  <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50 max-h-32 overflow-y-auto">
                    {properties.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
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

              {/* If Resident: Room info */}
              {editRole === 'resident' && (
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขห้องพัก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editRoomId}
                    onChange={(e) => setEditRoomId(e.target.value)}
                    placeholder="เช่น 301 หรือ 204"
                    required
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ติดต่อ
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="081-xxx-xxxx"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    สถานะการใช้งาน
                  </label>
                  <select
                    value={editIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditIsActive(e.target.value === 'active')}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="active">ปกติ (Active)</option>
                    <option value="inactive">ระงับการใช้งาน (Suspended)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
      {/* DELETE CONFIRM MODAL */}
      {/* ----------------------------------------------------------- */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="ยืนยันการลบผู้ใช้งาน"
        message={`คุณต้องการลบผู้ใช้งาน "${userToDelete?.displayName}" (@${userToDelete?.username}) หรือไม่? ข้อมูลผู้ใช้นี้จะถูกลบออกจากฐานข้อมูลอย่างถาวร`}
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
