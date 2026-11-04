/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserProfile, WorkOrder, Property } from '../types';

export function isAdmin(user: UserProfile | null): boolean {
  return Boolean(user && user.role === 'admin' && user.isActive);
}

export function isStaff(user: UserProfile | null): boolean {
  return Boolean(user && (user.role === 'staff' || user.role === 'admin') && user.isActive);
}

export function isResident(user: UserProfile | null): boolean {
  return Boolean(user && user.role === 'resident' && user.isActive);
}

export function canAccessProperty(user: UserProfile | null, propertyId: string): boolean {
  if (!user || !user.isActive) return false;
  if (user.role === 'admin' || user.role === 'staff') {
    // Admin and Technician/Staff (ช่างซ่อม/เจ้าหน้าที่) have access to all dormitories
    return true;
  }
  return user.propertyIds.includes(propertyId);
}

export function canViewWorkOrder(user: UserProfile | null, workOrder: WorkOrder): boolean {
  if (!user || !user.isActive) return false;
  if (!canAccessProperty(user, workOrder.propertyId)) return false;

  if (user.role === 'admin' || user.role === 'staff') {
    return true;
  }

  // Resident can only view their own tickets
  return user.role === 'resident' && workOrder.requesterUid === user.uid;
}

export function canChangeWorkOrderStatus(user: UserProfile | null, workOrder: WorkOrder): boolean {
  if (!user || !user.isActive) return false;
  if (!canAccessProperty(user, workOrder.propertyId)) return false;
  return user.role === 'admin' || user.role === 'staff';
}

export function canCloseWorkOrder(user: UserProfile | null, workOrder: WorkOrder): { allowed: boolean; reason?: string } {
  if (!user || !user.isActive) {
    return { allowed: false, reason: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' };
  }
  if (!canChangeWorkOrderStatus(user, workOrder)) {
    return { allowed: false, reason: 'เฉพาะช่างหรือผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ปิดงาน' };
  }

  // Must have inspection notes or action taken
  if (!workOrder.actionTaken && !workOrder.inspectionNotes) {
    return { allowed: false, reason: 'ต้องบันทึกผลการตรวจสอบหรือการดำเนินงานก่อนปิดงาน' };
  }

  // If sent to external contractor, must have contractor details filled
  if (workOrder.status === 'external_contractor') {
    if (!workOrder.externalContractor?.contractorName || !workOrder.externalContractor?.outcome) {
      return { allowed: false, reason: 'ต้องระบุผลการดำเนินงานของผู้รับเหมาภายนอกก่อนปิดงาน' };
    }
  }

  return { allowed: true };
}

export function canResidentSelfWithdraw(user: UserProfile | null, property: Property | null): boolean {
  if (!user || !user.isActive || !property) return false;
  if (!canAccessProperty(user, property.id)) return false;

  if (user.role === 'admin') return true;
  if (user.role === 'resident' && property.residentSelfWithdrawEnabled) return true;

  return false;
}
