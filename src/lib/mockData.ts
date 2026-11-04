/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Property, UserProfile, WorkOrder, InventoryItem, InventoryTransaction } from '../types';

/**
 * DEFAULT SYSTEM DATA (ข้อมูลระบบหลัก - ไม่มีข้อมูลตัวอย่าง)
 * Zero Mock Data Policy: ไม่มีการใส่ข้อมูลใบแจ้งซ่อมจำลอง, พัสดุจำลอง หรือประวัติทำรายการจำลอง
 */
export const DEFAULT_SYSTEM_PROPERTY: Property = {
  id: 'prop-main-01',
  code: 'DORM-01',
  name: 'หอพักหลัก (Main Dormitory)',
  residentSelfWithdrawEnabled: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Initial system properties (เฉพาะหอพักระบบจริง ไม่มีหอพักตัวอย่าง)
export const INITIAL_PROPERTIES: Property[] = [DEFAULT_SYSTEM_PROPERTY];

// Initial Users: เริ่มต้นเป็นระบบว่างเปล่า (ผู้ดูแลระบบหลักจะถูกกำหนดผ่าน DEFAULT_PRIMARY_ADMIN)
export const INITIAL_USERS: UserProfile[] = [];

// Clean System: ห้ามให้ข้อมูลตัวอย่าง (Zero Sample / Mock Work Orders)
export const INITIAL_WORK_ORDERS: WorkOrder[] = [];

// Clean System: ห้ามให้ข้อมูลตัวอย่าง (Zero Sample / Mock Inventory Items)
export const INITIAL_INVENTORY: InventoryItem[] = [];

// Clean System: ห้ามให้ข้อมูลตัวอย่าง (Zero Sample / Mock Transactions)
export const INITIAL_TRANSACTIONS: InventoryTransaction[] = [];
