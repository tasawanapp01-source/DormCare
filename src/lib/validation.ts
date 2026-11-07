/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateWorkOrderInput(data: {
  title?: string;
  category: string;
  building?: string;
  room: string;
  description: string;
  urgency: string;
  imagesCount: number;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.description || data.description.trim().length < 4) {
    errors.description = 'กรุณาระบุรายละเอียดอาการชำรุดอย่างน้อย 4 ตัวอักษร เพื่อให้ช่างเตรียมอุปกรณ์ได้ตรงจุด';
  }
  if (!data.category) {
    errors.category = 'กรุณาเลือกหมวดหมู่งานซ่อม';
  }
  if (!data.room || data.room.trim().length === 0) {
    errors.room = 'กรุณาระบุเลขห้องหรือจุดที่พบปัญหา';
  }
  if (!data.urgency) {
    errors.urgency = 'กรุณาระบุระดับความเร่งด่วน';
  }
  if (data.imagesCount > 2) {
    errors.images = 'แนบรูปภาพประกอบได้ไม่เกิน 2 รูปเท่านั้น ตามข้อกำหนดพื้นที่จัดเก็บฟรี';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateWithdrawal(data: {
  itemId: string;
  quantity: number;
  availableStock: number;
  reason: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.itemId) {
    errors.itemId = 'กรุณาเลือกรายการวัสดุที่ต้องการเบิก';
  }
  if (!data.quantity || data.quantity <= 0) {
    errors.quantity = 'จำนวนที่เบิกต้องมากกว่า 0';
  } else if (!Number.isInteger(data.quantity)) {
    errors.quantity = 'จำนวนที่เบิกต้องเป็นจำนวนเต็ม';
  } else if (data.quantity > data.availableStock) {
    errors.quantity = `สต็อกคงเหลือไม่เพียงพอ (คงเหลือ ${data.availableStock} ชิ้น)`;
  }

  if (!data.reason || data.reason.trim().length < 3) {
    errors.reason = 'กรุณาระบุเหตุผลหรือวัตถุประสงค์ในการเบิกใช้งาน';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateExternalContractor(data: {
  contractorName: string;
  detail: string;
  reason: string;
  sentDate: string;
  cost: number;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.contractorName || data.contractorName.trim().length < 2) {
    errors.contractorName = 'กรุณาระบุชื่อผู้รับเหมาหรือศูนย์บริการภายนอก';
  }
  if (!data.detail || data.detail.trim().length < 5) {
    errors.detail = 'กรุณาระบุรายละเอียดงานที่ส่งมอบให้ผู้รับเหมา';
  }
  if (!data.reason || data.reason.trim().length < 5) {
    errors.reason = 'กรุณาระบุสาเหตุที่ต้องส่งช่างภายนอก (เช่น เครื่องมือเฉพาะทาง, งานมีประกัน)';
  }
  if (!data.sentDate) {
    errors.sentDate = 'กรุณาระบุวันที่ส่งงาน';
  }
  if (data.cost < 0) {
    errors.cost = 'ค่าใช้จ่ายต้องไม่ติดลบ (กรอก 0 ได้หากยังไม่มีใบเสนอราคา)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateUserCreation(data: {
  displayName: string;
  password?: string;
  phone?: string;
  role: string;
  propertyIds: string[];
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.displayName || data.displayName.trim().length < 2) {
    errors.displayName = 'กรุณาระบุชื่อ - นามสกุลจริงอย่างน้อย 2 ตัวอักษร';
  }

  if (data.password === undefined || data.password.trim().length < 4) {
    errors.password = 'รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 4 ตัวอักษร';
  }

  if (!data.role) {
    errors.role = 'กรุณาเลือกระดับสิทธิ์ (บทบาท)';
  }

  if (!data.propertyIds || data.propertyIds.length === 0) {
    errors.propertyIds = 'กรุณาเลือกหอพักที่อนุญาตให้เข้าถึงอย่างน้อย 1 แห่ง';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

