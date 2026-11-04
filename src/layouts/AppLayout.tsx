/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { FirebaseSetupModal } from '../components/FirebaseSetupModal';

interface AppLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onSelectTab,
  children,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isFirebaseSetupOpen, setIsFirebaseSetupOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Prompt',sans-serif]">
      {/* Sidebar navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1">
        {/* Top Header */}
        <Header
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenFirebaseSetup={() => setIsFirebaseSetupOpen(true)}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-4 px-6 border-t border-slate-200 text-center text-xs text-slate-400 no-print">
          DormCare — ระบบบริหารงานแจ้งซ่อมและคลังวัสดุสำหรับหอพัก (พัฒนาด้วย React + TypeScript + Firebase Spark Plan ฟรี 100%)
        </footer>
      </div>

      {/* Firebase Setup & Health Check Modal */}
      <FirebaseSetupModal
        isOpen={isFirebaseSetupOpen}
        onClose={() => setIsFirebaseSetupOpen(false)}
      />
    </div>
  );
};
