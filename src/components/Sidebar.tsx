/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Wrench,
  LayoutDashboard,
  ClipboardList,
  Boxes,
  FileSpreadsheet,
  Users,
  Building2,
  Settings,
  History,
  LogOut,
  ChevronDown,
  Shield,
  UserCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { isAdmin, isStaff, isResident } from '../lib/permissions';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { userProfile, activeProperty, activePropertyId, properties, switchProperty, logout } = useAuth();

  const handleSelect = (tab: string) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const menuItems = [
    {
      id: 'dashboard',
      label: 'ภาพรวมระบบ',
      icon: LayoutDashboard,
      show: true,
    },
    {
      id: 'work-orders',
      label: 'รายการแจ้งซ่อม',
      icon: ClipboardList,
      show: true,
    },
    {
      id: 'inventory',
      label: isResident(userProfile) ? 'เบิกวัสดุของใช้' : 'คลังวัสดุ & อะไหล่',
      icon: Boxes,
      show: true,
    },
    {
      id: 'transactions',
      label: 'ประวัติการเบิก-รับวัสดุ',
      icon: History,
      show: isStaff(userProfile) || isAdmin(userProfile),
    },
    {
      id: 'reports',
      label: 'รายงาน & สถิติ',
      icon: FileSpreadsheet,
      show: isStaff(userProfile) || isAdmin(userProfile),
    },
    {
      id: 'users',
      label: 'จัดการผู้ใช้งาน',
      icon: Users,
      show: isAdmin(userProfile),
    },
    {
      id: 'properties',
      label: 'จัดการหอพัก',
      icon: Building2,
      show: isAdmin(userProfile),
    },
    {
      id: 'settings',
      label: 'ตั้งค่า & Health Check',
      icon: Settings,
      show: true,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden no-print"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } no-print`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                DormCare <span className="text-[10px] uppercase font-semibold bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded">v1.0</span>
              </div>
              <div className="text-xs text-slate-400">ระบบจัดการแจ้งซ่อม & คลัง</div>
            </div>
          </div>
        </div>

        {/* Property Selector (Multi-property support) */}
        {properties.length > 0 && (
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span>หอพักที่เลือก</span>
              {properties.length > 1 && (
                <span className="text-[10px] text-indigo-400 font-normal">เปลี่ยนได้</span>
              )}
            </div>

            {isAdmin(userProfile) || isStaff(userProfile) || (userProfile && userProfile.propertyIds?.length > 1) ? (
              <div className="relative">
                <select
                  value={activePropertyId}
                  onChange={(e) => switchProperty(e.target.value)}
                  className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8 truncate font-medium"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            ) : (
              <div className="text-xs text-slate-200 font-medium truncate py-1 px-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
                {activeProperty ? `[${activeProperty.code}] ${activeProperty.name}` : 'กำลังโหลด...'}
              </div>
            )}
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
              {userProfile?.displayName ? userProfile.displayName.charAt(0) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {userProfile?.displayName || 'ผู้ใช้งาน'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isAdmin(userProfile) && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/50">
                    <Shield className="w-2.5 h-2.5" /> แอดมิน
                  </span>
                )}
                {userProfile?.role === 'staff' && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/50">
                    <UserCheck className="w-2.5 h-2.5" /> ช่างซ่อม
                  </span>
                )}
                {isResident(userProfile) && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                    <User className="w-2.5 h-2.5" /> ผู้พักห้อง {userProfile?.roomId || '-'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-rose-950/70 hover:text-rose-300 rounded-xl transition-colors border border-slate-700/60"
          >
            <LogOut className="w-3.5 h-3.5" />
            ออกจากระบบ
          </button>
        </div>
      </aside>
    </>
  );
};
