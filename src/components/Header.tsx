/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu, Flame, Building } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { isFirebaseConfigured } from '../lib/firebase';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onOpenFirebaseSetup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onOpenFirebaseSetup,
}) => {
  const { activeProperty } = useAuth();
  const configured = isFirebaseConfigured();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 no-print">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Active property */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="เปิดเมนู"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate max-w-[200px] sm:max-w-md">
                {activeProperty ? activeProperty.name : 'DormCare'}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                ระบบบริหารจัดการหอพักและคลังวัสดุ
              </p>
            </div>
          </div>
        </div>

        {/* Right: Firebase status */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenFirebaseSetup}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              configured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">
              {configured ? 'Firebase: เชื่อมต่อแล้ว' : 'ตั้งค่า Firebase'}
            </span>
            <span className="sm:hidden">{configured ? 'Online' : 'Setup'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

