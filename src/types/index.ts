/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'staff' | 'resident';

export interface UserProfile {
  uid: string;
  username: string; // Custom username set by user (e.g. admin, wichai, room301)
  email: string;
  displayName: string;
  role: UserRole;
  propertyIds: string[]; // List of property IDs user has access to
  roomId?: string; // Assigned room for resident
  building?: string; // Assigned building for resident
  floor?: string; // Assigned floor for resident
  phone?: string;
  password?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface BuildingRoomConfig {
  name: string;
  floors: number[];
  rooms: string[];
}

export interface Property {
  id: string;
  code: string; // รหัสหอพัก (เช่น PK-01)
  name: string; // ชื่อหอพัก
  residentSelfWithdrawEnabled?: boolean; // สิทธิ์เบิกของใช้สำหรับผู้พักอาศัย
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RepairCategory {
  id: string;
  name: string;
  isDefault?: boolean;
  createdAt?: string;
}

export type TicketCategory =
  | 'electrical' // ระบบไฟฟ้า
  | 'plumbing' // ระบบประปา/สุขภัณฑ์
  | 'aircon' // เครื่องปรับอากาศ
  | 'furniture' // เฟอร์นิเจอร์/ประตูหน้าต่าง
  | 'appliance' // เครื่องใช้ไฟฟ้าส่วนกลาง
  | 'structural' // โครงสร้าง/ผนัง/ฝ้าเพดาน
  | 'sanitary' // ความสะอาด/ขยะ
  | 'other' // อื่นๆ
  | string;

export type TicketUrgency =
  | 'low' // ทั่วไป (3-5 วัน)
  | 'medium' // ปานกลาง (1-2 วัน)
  | 'high' // เร่งด่วน (ภายใน 24 ชม.)
  | 'emergency'; // ฉุกเฉิน (ทันที)

export type TicketStatus =
  | 'pending' // รอรับงาน
  | 'accepted' // รับงานแล้ว
  | 'in_progress' // กำลังดำเนินการ
  | 'waiting_parts' // รอวัสดุ/อะไหล่
  | 'external_contractor' // ส่งช่างภายนอก
  | 'completed' // ซ่อมเสร็จแล้ว
  | 'cancelled'; // ยกเลิก

export interface MaterialUsed {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  withdrawnAt: string;
  withdrawnByName: string;
}

export interface ExternalContractorDetail {
  contractorName: string;
  detail: string;
  reason: string;
  sentDate: string;
  cost: number;
  outcome?: string;
  contactPhone?: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string; // Ticket code, e.g. MC-202610-0001
  docId: string; // Firestore document ID
  propertyId: string;
  building: string;
  floor: string;
  room: string;
  requesterUid: string;
  requesterName: string;
  requesterPhone: string;
  title: string;
  category: TicketCategory;
  description: string;
  urgency: TicketUrgency;
  images: string[]; // Max 2 base64 data URLs compressed to <= 150KB each
  status: TicketStatus;
  technicianUid?: string;
  technicianName?: string;
  inspectionNotes?: string;
  actionTaken?: string;
  materialsUsed: MaterialUsed[];
  externalContractor?: ExternalContractorDetail;
  closedAt?: string;
  closedByUid?: string;
  closedByName?: string;
  createdAt: string; // ISO 8601 string or timestamp
  updatedAt: string;
  expiresAt?: string; // Estimated expiration date (createdAt + 365 days)
}

export interface WorkOrderEvent {
  id: string;
  ticketId: string;
  status: TicketStatus;
  note: string;
  performedByUid: string;
  performedByName: string;
  timestamp: string;
}

export interface InventoryItem {
  id: string;
  propertyId: string;
  itemCode: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  location: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InventoryTransactionType =
  | 'receive' // รับเข้าคลัง
  | 'withdraw_work_order' // ช่างเบิกใช้ในใบงาน
  | 'withdraw_resident' // ผู้พักอาศัยเบิกไม่มีใบงาน
  | 'return' // คืนวัสดุ
  | 'adjustment'; // ปรับปรุงยอดตรวจนับ

export interface InventoryTransaction {
  id: string;
  propertyId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  type: InventoryTransactionType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  unitPrice: number;
  totalValue: number;
  ticketId: string | null;
  reason: string;
  requesterUid?: string;
  requesterName?: string;
  requesterRoom?: string;
  performedByUid: string;
  performedByName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  propertyId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  performedByUid: string;
  performedByName: string;
  timestamp: string;
}

export interface FirebaseConfigState {
  apiKey: string;
  authDomain: string;
  projectId: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

