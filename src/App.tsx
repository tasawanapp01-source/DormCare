/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './lib/authContext';
import { ToastProvider, useToast } from './components/Toast';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage';
import { InventoryPage } from './pages/InventoryPage';
import { InventoryTransactionsPage } from './pages/InventoryTransactionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { SettingsPage } from './pages/SettingsPage';
import { NewWorkOrderModal } from './components/NewWorkOrderModal';
import { ResidentWithdrawModal } from './components/ResidentWithdrawModal';
import { FirebaseSetupModal } from './components/FirebaseSetupModal';
import { isAdmin, isStaff } from './lib/permissions';

function AppContent() {
  const { userProfile, isLoading, activeProperty } = useAuth();
  const { showToast } = useToast();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  // Global Modals
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [isResidentWithdrawOpen, setIsResidentWithdrawOpen] = useState(false);
  const [isFirebaseSetupOpen, setIsFirebaseSetupOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-white font-bold text-sm">กำลังโหลดระบบ DormCare...</div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <LoginPage
        onOpenFirebaseSetup={() => setIsFirebaseSetupOpen(true)}
      />
    );
  }

  const handleNavigateTab = (tab: string, extra?: { workOrderId?: string }) => {
    if (tab === 'users' && !isAdmin(userProfile)) {
      showToast('error', 'ไม่มีสิทธิ์เข้าถึง', 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์จัดการผู้ใช้');
      return;
    }
    if (tab === 'properties' && !isAdmin(userProfile)) {
      showToast('error', 'ไม่มีสิทธิ์เข้าถึง', 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์จัดการหอพัก');
      return;
    }

    if (extra?.workOrderId) {
      setSelectedWorkOrderId(extra.workOrderId);
      setCurrentTab('work-orders');
    } else {
      setSelectedWorkOrderId(null);
      setCurrentTab(tab);
    }
  };

  return (
    <AppLayout
      currentTab={currentTab}
      onSelectTab={(tab) => {
        setSelectedWorkOrderId(null);
        handleNavigateTab(tab);
      }}
    >
      {/* Tab: Dashboard */}
      {currentTab === 'dashboard' && (
        <DashboardPage
          onNavigateTab={handleNavigateTab}
          onOpenNewTicketModal={() => setIsNewTicketModalOpen(true)}
          onOpenResidentWithdrawModal={() => setIsResidentWithdrawOpen(true)}
        />
      )}

      {/* Tab: Work Orders (List or Detail) */}
      {currentTab === 'work-orders' && (
        selectedWorkOrderId ? (
          <WorkOrderDetailPage
            workOrderId={selectedWorkOrderId}
            onBack={() => setSelectedWorkOrderId(null)}
          />
        ) : (
          <WorkOrdersPage
            onSelectWorkOrder={(id) => setSelectedWorkOrderId(id)}
            onOpenNewModal={() => setIsNewTicketModalOpen(true)}
          />
        )
      )}

      {/* Tab: Inventory */}
      {currentTab === 'inventory' && (
        <InventoryPage
          onNavigateTransactions={() => handleNavigateTab('transactions')}
        />
      )}

      {/* Tab: Transactions */}
      {currentTab === 'transactions' && <InventoryTransactionsPage />}

      {/* Tab: Reports */}
      {currentTab === 'reports' && <ReportsPage />}

      {/* Tab: Users (Admin Only) */}
      {currentTab === 'users' && <UsersPage />}

      {/* Tab: Properties (Admin Only) */}
      {currentTab === 'properties' && <PropertiesPage />}

      {/* Tab: Settings */}
      {currentTab === 'settings' && <SettingsPage />}

      {/* Global New Work Order Modal */}
      <NewWorkOrderModal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
        onCreated={(ticketId) => {
          setSelectedWorkOrderId(ticketId);
          setCurrentTab('work-orders');
        }}
      />

      {/* Global Resident Self-Withdraw Modal */}
      <ResidentWithdrawModal
        isOpen={isResidentWithdrawOpen}
        onClose={() => setIsResidentWithdrawOpen(false)}
        inventoryItems={[]}
      />

      {/* Global Firebase Setup Modal */}
      <FirebaseSetupModal
        isOpen={isFirebaseSetupOpen}
        onClose={() => setIsFirebaseSetupOpen(false)}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
