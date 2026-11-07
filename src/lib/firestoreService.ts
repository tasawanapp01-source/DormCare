/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  addDoc,
  getDocFromServer,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './firebase';
import {
  WorkOrder,
  InventoryItem,
  InventoryTransaction,
  Property,
  UserProfile,
  TicketStatus,
  AuditLog,
  RepairCategory,
} from '../types';

// ============================================================================
// Standard Error Handling (Firebase Skill Standard)
// ============================================================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.uid || null,
      email: currentAuth?.email || null,
      emailVerified: currentAuth?.emailVerified || null,
      isAnonymous: currentAuth?.isAnonymous || null,
      tenantId: currentAuth?.tenantId || null,
      providerInfo: currentAuth?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ============================================================================
// Validate Connection to Firestore (Firebase Skill Standard)
// ============================================================================
export async function testConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

// ============================================================================
// Base System Templates (No Mock Data - Direct Firestore Seeders)
// ============================================================================
export const DEFAULT_PRIMARY_ADMIN: UserProfile = {
  uid: 'user-admin-primary',
  username: 'admin',
  password: '213894120',
  email: 'admin@dormcare.app',
  displayName: 'ผู้ดูแลระบบหลัก (Admin)',
  role: 'admin',
  propertyIds: ['prop-main-01'],
  phone: '081-234-5678',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_SYSTEM_PROPERTY: Property = {
  id: 'prop-main-01',
  code: 'DORM-01',
  name: 'หอพักหลัก (Main Dormitory)',
  residentSelfWithdrawEnabled: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_REPAIR_CATEGORIES: RepairCategory[] = [
  { id: 'plumbing', name: 'ระบบประปา / สุขภัณฑ์ / ท่อตัน', isDefault: true },
  { id: 'electrical', name: 'ระบบไฟฟ้า / หลอดไฟ / สวิตช์', isDefault: true },
  { id: 'aircon', name: 'เครื่องปรับอากาศ / แอร์', isDefault: true },
  { id: 'furniture', name: 'เฟอร์นิเจอร์ / ประตู / ลูกบิด / หน้าต่าง', isDefault: true },
  { id: 'appliance', name: 'เครื่องใช้ไฟฟ้าส่วนกลาง', isDefault: true },
  { id: 'structural', name: 'โครงสร้าง / ผนัง / ฝ้าเพดาน / หลังคา', isDefault: true },
  { id: 'sanitary', name: 'ความสะอาด / ขยะ / สิ่งแวดล้อม', isDefault: true },
  { id: 'other', name: 'อื่นๆ', isDefault: true },
];

export const DEFAULT_INVENTORY_CATEGORIES = ['งานประปา', 'งานไฟฟ้า', 'งานเครื่องปรับอากาศ', 'งานเฟอร์นิเจอร์', 'งานสีและโครงสร้าง', 'งานสุขภัณฑ์'];

// In-memory cache for fast sync
let cachedRepairCategories: RepairCategory[] = [...DEFAULT_REPAIR_CATEGORIES];
let cachedInventoryCategories: string[] = [...DEFAULT_INVENTORY_CATEGORIES];

export function generateTicketCode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `MC-${year}${month}-${randomSuffix}`;
}

export function cleanForFirestore<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    if (
      input instanceof Date ||
      (input as any)._methodName ||
      typeof (input as any).isEqual === 'function' ||
      (input.constructor && input.constructor.name === 'FieldValue')
    ) {
      return input;
    }
    const output: Record<string, any> = {};
    for (const [key, val] of Object.entries(input)) {
      if (val !== undefined) {
        output[key] = cleanForFirestore(val);
      }
    }
    return output as T;
  }
  return input;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  try {
    const res = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    return fallback;
  }
}

// Compatibility helper for authContext
export function getStoredUsers(): UserProfile[] {
  return [DEFAULT_PRIMARY_ADMIN];
}

export function saveStoredUsers(_users: UserProfile[]): void {
  // Stored directly in Firestore
}

export function getStoredProperties(): Property[] {
  return [DEFAULT_SYSTEM_PROPERTY];
}

export function saveStoredProperties(_props: Property[]): void {
  // Stored directly in Firestore
}

// ============================================================================
// Properties Service (Direct Firebase Cloud Firestore)
// ============================================================================

export async function fetchProperties(): Promise<Property[]> {
  if (!db) {
    return [DEFAULT_SYSTEM_PROPERTY];
  }
  const colPath = 'properties';
  try {
    const colRef = collection(db, colPath);
    const snapshot = await withTimeout(getDocs(colRef), 5000, null);
    if (snapshot && !snapshot.empty) {
      const remoteProps = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Property));
      const validProps = remoteProps.filter(
        (p) => p.id !== 'prop-chula-01' && p.id !== 'prop-silom-02'
      );
      if (validProps.length > 0) {
        return validProps;
      }
    }

    // Seed default property directly to Firestore
    const docRef = doc(db, colPath, DEFAULT_SYSTEM_PROPERTY.id);
    await setDoc(
      docRef,
      cleanForFirestore({
        ...DEFAULT_SYSTEM_PROPERTY,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
    return [DEFAULT_SYSTEM_PROPERTY];
  } catch (err) {
    console.error('Failed to fetch properties from Firestore:', err);
    return [DEFAULT_SYSTEM_PROPERTY];
  }
}

export async function saveProperty(property: Property): Promise<void> {
  if (!db) return;
  const docPath = `properties/${property.id}`;
  try {
    const docRef = doc(db, 'properties', property.id);
    await setDoc(
      docRef,
      cleanForFirestore({
        ...property,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, docPath);
  }
}

export async function deleteProperty(propertyId: string): Promise<void> {
  if (!db) return;
  const docPath = `properties/${propertyId}`;
  try {
    const docRef = doc(db, 'properties', propertyId);
    await deleteDoc(docRef);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, docPath);
  }
}

// ============================================================================
// Users Service (Direct Firebase Cloud Firestore)
// ============================================================================

export async function fetchUsersList(propertyId?: string): Promise<UserProfile[]> {
  if (!db) {
    return [DEFAULT_PRIMARY_ADMIN];
  }
  const colPath = 'users';
  try {
    const colRef = collection(db, colPath);
    const snap = await withTimeout(getDocs(colRef), 5000, null);
    if (snap && !snap.empty) {
      let remoteUsers = snap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserProfile));
      // Ensure primary admin always exists in Firestore
      if (!remoteUsers.some((u) => u.username?.toLowerCase() === 'admin')) {
        await saveUserProfile(DEFAULT_PRIMARY_ADMIN);
        remoteUsers.unshift(DEFAULT_PRIMARY_ADMIN);
      }
      if (propertyId) {
        remoteUsers = remoteUsers.filter((u) => u.propertyIds?.includes(propertyId));
      }
      return remoteUsers;
    } else {
      // Seed initial admin to Firestore
      await saveUserProfile(DEFAULT_PRIMARY_ADMIN);
      return [DEFAULT_PRIMARY_ADMIN];
    }
  } catch (err) {
    console.error('Error fetching users from Firestore:', err);
    return [DEFAULT_PRIMARY_ADMIN];
  }
}

export function subscribeUsersList(callback: (users: UserProfile[]) => void): () => void {
  if (!db) {
    callback([DEFAULT_PRIMARY_ADMIN]);
    return () => {};
  }
  const colPath = 'users';
  try {
    const colRef = collection(db, colPath);
    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((d) => ({ ...d.data(), uid: d.id } as UserProfile));
          if (!list.some((u) => u.username?.toLowerCase() === 'admin')) {
            await saveUserProfile(DEFAULT_PRIMARY_ADMIN);
            list.unshift(DEFAULT_PRIMARY_ADMIN);
          }
          callback(list);
        } else {
          await saveUserProfile(DEFAULT_PRIMARY_ADMIN);
          callback([DEFAULT_PRIMARY_ADMIN]);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, colPath);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to subscribe users list from Firestore:', err);
    return () => {};
  }
}

export async function saveUserProfile(user: UserProfile): Promise<void> {
  if (!db) return;
  const docPath = `users/${user.uid}`;
  try {
    const docRef = doc(db, 'users', user.uid);
    const dataToSave = cleanForFirestore({
      ...user,
      updatedAt: serverTimestamp(),
    });
    await setDoc(docRef, dataToSave, { merge: true });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, docPath);
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  if (!db) return;
  const docPath = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const dataToUpdate = cleanForFirestore({
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(docRef, dataToUpdate);
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, docPath);
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  if (!db) return;
  const docPath = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    await deleteDoc(docRef);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, docPath);
  }
}

// ============================================================================
// Work Orders Service (Real-time Firebase Cloud Firestore)
// ============================================================================

export function subscribeWorkOrders(
  propertyId: string,
  user: UserProfile | null,
  callback: (orders: WorkOrder[]) => void
): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const colPath = 'workOrders';
  try {
    const colRef = collection(db, colPath);
    let q = query(colRef, where('propertyId', '==', propertyId));

    if (user && user.role === 'resident') {
      q = query(
        colRef,
        where('propertyId', '==', propertyId),
        where('requesterUid', '==', user.uid)
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((d) => ({ ...d.data(), docId: d.id } as WorkOrder));
        orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        callback(orders);
      },
      (error) => {
        console.error('WorkOrders snapshot error from Firestore:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Failed to setup WorkOrders snapshot:', err);
    callback([]);
    return () => {};
  }
}

export async function createWorkOrder(
  data: Omit<WorkOrder, 'docId' | 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) {
    throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase Cloud Firestore ได้');
  }

  const ticketId = generateTicketCode();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const expiresAt = expiresDate.toISOString();

  const fullOrder: WorkOrder = {
    ...data,
    id: ticketId,
    docId: ticketId,
    status: 'pending',
    materialsUsed: [],
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  };

  const docPath = `workOrders/${ticketId}`;
  try {
    const docRef = doc(db, 'workOrders', ticketId);
    await setDoc(
      docRef,
      cleanForFirestore({
        ...fullOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    const eventRef = collection(db, 'workOrders', ticketId, 'events');
    await addDoc(
      eventRef,
      cleanForFirestore({
        ticketId,
        status: 'pending',
        note: 'สร้างใบแจ้งซ่อมเข้าระบบ',
        performedByUid: data.requesterUid,
        performedByName: data.requesterName,
        timestamp: serverTimestamp(),
      })
    );

    return ticketId;
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, docPath);
    return ticketId;
  }
}

export async function updateWorkOrderStatus(
  workOrder: WorkOrder,
  newStatus: TicketStatus,
  note: string,
  user: UserProfile,
  extraUpdates: Partial<WorkOrder> = {}
): Promise<void> {
  if (!db) {
    throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase Cloud Firestore ได้');
  }

  const docPath = `workOrders/${workOrder.id}`;
  try {
    const docRef = doc(db, 'workOrders', workOrder.id);
    await updateDoc(
      docRef,
      cleanForFirestore({
        ...extraUpdates,
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
    );

    const eventRef = collection(db, 'workOrders', workOrder.id, 'events');
    await addDoc(
      eventRef,
      cleanForFirestore({
        ticketId: workOrder.id,
        status: newStatus,
        note,
        performedByUid: user.uid,
        performedByName: user.displayName,
        timestamp: serverTimestamp(),
      })
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, docPath);
  }
}

// ============================================================================
// Inventory Service (Direct Firebase Cloud Firestore with Atomic Transactions)
// ============================================================================

export function subscribeInventory(
  propertyId: string,
  callback: (items: InventoryItem[]) => void
): () => void {
  if (!db) {
    callback([]);
    return () => {};
  }

  const colPath = 'inventoryItems';
  try {
    const colRef = collection(db, colPath);
    const q = query(colRef, where('propertyId', '==', propertyId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as InventoryItem));
        callback(items);
      },
      (error) => {
        console.error('Inventory snapshot error from Firestore:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Failed to setup inventory snapshot:', err);
    callback([]);
    return () => {};
  }
}

export async function withdrawInventoryItemAtomic(params: {
  propertyId: string;
  itemId: string;
  quantity: number;
  ticketId: string | null;
  workOrder?: WorkOrder | null;
  reason: string;
  type: 'withdraw_work_order' | 'withdraw_resident';
  requesterUid?: string;
  requesterName?: string;
  requesterRoom?: string;
  user: UserProfile;
}): Promise<void> {
  const { propertyId, itemId, quantity, ticketId, workOrder, reason, type, requesterUid, requesterName, requesterRoom, user } = params;

  if (quantity <= 0) {
    throw new Error('จำนวนที่เบิกต้องมากกว่า 0');
  }
  if (!db) {
    throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase Cloud Firestore ได้');
  }

  const firestore = db;
  const itemDocRef = doc(firestore, 'inventoryItems', itemId);
  const txColRef = collection(firestore, 'inventoryTransactions');
  const txDocRef = doc(txColRef);

  await runTransaction(firestore, async (transaction) => {
    const itemSnapshot = await transaction.get(itemDocRef);
    if (!itemSnapshot.exists()) {
      throw new Error('ไม่พบข้อมูลวัสดุชิ้นนี้ใน Cloud Firestore');
    }

    const itemData = itemSnapshot.data() as InventoryItem;
    if (itemData.quantity < quantity) {
      throw new Error(`สต็อกไม่เพียงพอ! คงเหลือเพียง ${itemData.quantity} ${itemData.unit} (ต้องการเบิก ${quantity})`);
    }

    const previousQuantity = itemData.quantity;
    const newQuantity = previousQuantity - quantity;

    transaction.update(itemDocRef, {
      quantity: newQuantity,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txDocRef, {
      id: txDocRef.id,
      propertyId,
      itemId,
      itemCode: itemData.itemCode,
      itemName: itemData.name,
      type,
      quantity,
      previousQuantity,
      newQuantity,
      unitPrice: itemData.unitPrice || 0,
      totalValue: quantity * (itemData.unitPrice || 0),
      ticketId,
      reason,
      requesterUid: requesterUid || null,
      requesterName: requesterName || null,
      requesterRoom: requesterRoom || null,
      performedByUid: user.uid,
      performedByName: user.displayName,
      createdAt: serverTimestamp(),
    });

    if (ticketId && workOrder) {
      const woDocRef = doc(firestore, 'workOrders', workOrder.id);
      const updatedMaterials = [
        ...(workOrder.materialsUsed || []),
        {
          itemId,
          itemCode: itemData.itemCode,
          itemName: itemData.name,
          quantity,
          unit: itemData.unit,
          unitPrice: itemData.unitPrice,
          withdrawnAt: new Date().toISOString(),
          withdrawnByName: user.displayName,
        },
      ];

      transaction.update(woDocRef, {
        materialsUsed: updatedMaterials,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function receiveInventoryItem(params: {
  propertyId: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  reason: string;
  user: UserProfile;
}): Promise<void> {
  const { propertyId, itemId, quantity, unitPrice, reason, user } = params;

  if (!db) {
    throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase Cloud Firestore ได้');
  }

  const firestore = db;
  const itemRef = doc(firestore, 'inventoryItems', itemId);
  const txColRef = collection(firestore, 'inventoryTransactions');
  const txRef = doc(txColRef);

  await runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(itemRef);
    if (!snap.exists()) throw new Error('ไม่พบข้อมูลวัสดุใน Cloud Firestore');
    const data = snap.data() as InventoryItem;
    const prev = data.quantity;
    const next = prev + quantity;

    transaction.update(itemRef, {
      quantity: next,
      unitPrice: unitPrice > 0 ? unitPrice : data.unitPrice,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      id: txRef.id,
      propertyId,
      itemId,
      itemCode: data.itemCode,
      itemName: data.name,
      type: 'receive',
      quantity,
      previousQuantity: prev,
      newQuantity: next,
      unitPrice,
      totalValue: quantity * unitPrice,
      ticketId: null,
      reason,
      performedByUid: user.uid,
      performedByName: user.displayName,
      createdAt: serverTimestamp(),
    });
  });
}

export async function adjustInventoryItem(params: {
  propertyId: string;
  itemId: string;
  newQuantity: number;
  reason: string;
  user: UserProfile;
}): Promise<void> {
  const { propertyId, itemId, newQuantity, reason, user } = params;

  if (newQuantity < 0) {
    throw new Error('จำนวนสต็อกคงเหลือต้องไม่ติดลบ');
  }
  if (!db) {
    throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase Cloud Firestore ได้');
  }

  const firestore = db;
  const itemRef = doc(firestore, 'inventoryItems', itemId);
  const txColRef = collection(firestore, 'inventoryTransactions');
  const txRef = doc(txColRef);

  await runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(itemRef);
    if (!snap.exists()) throw new Error('ไม่พบข้อมูลวัสดุใน Cloud Firestore');
    const data = snap.data() as InventoryItem;
    const prev = data.quantity;
    const diff = newQuantity - prev;

    transaction.update(itemRef, {
      quantity: newQuantity,
      updatedAt: serverTimestamp(),
    });

    transaction.set(txRef, {
      id: txRef.id,
      propertyId,
      itemId,
      itemCode: data.itemCode,
      itemName: data.name,
      type: 'adjustment',
      quantity: Math.abs(diff),
      previousQuantity: prev,
      newQuantity,
      unitPrice: data.unitPrice || 0,
      totalValue: Math.abs(diff) * (data.unitPrice || 0),
      ticketId: null,
      reason: `${reason} (ปรับจาก ${prev} เป็น ${newQuantity})`,
      performedByUid: user.uid,
      performedByName: user.displayName,
      createdAt: serverTimestamp(),
    });
  });
}

export async function createInventoryItem(params: {
  item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>;
  user: UserProfile;
}): Promise<InventoryItem> {
  const { item, user } = params;
  if (!db) {
    throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase Cloud Firestore ได้');
  }

  const newItemId = `item-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const newItem: InventoryItem = {
    ...item,
    id: newItemId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const docRef = doc(db, 'inventoryItems', newItemId);
  await setDoc(
    docRef,
    cleanForFirestore({
      ...newItem,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  if (newItem.quantity > 0) {
    const txColRef = collection(db, 'inventoryTransactions');
    await addDoc(
      txColRef,
      cleanForFirestore({
        propertyId: newItem.propertyId,
        itemId: newItem.id,
        itemCode: newItem.itemCode,
        itemName: newItem.name,
        type: 'receive',
        quantity: newItem.quantity,
        previousQuantity: 0,
        newQuantity: newItem.quantity,
        unitPrice: newItem.unitPrice,
        totalValue: newItem.quantity * newItem.unitPrice,
        ticketId: null,
        reason: 'ยอดยกมา / เพิ่มรายการวัสดุใหม่เข้าคลัง',
        performedByUid: user.uid,
        performedByName: user.displayName,
        createdAt: serverTimestamp(),
      })
    );
  }

  return newItem;
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  if (!db) return;
  const docRef = doc(db, 'inventoryItems', itemId);
  await deleteDoc(docRef);
}

export async function fetchTransactions(propertyId: string): Promise<InventoryTransaction[]> {
  if (!db) return [];
  try {
    const colRef = collection(db, 'inventoryTransactions');
    const q = query(colRef, where('propertyId', '==', propertyId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as InventoryTransaction));
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return list;
  } catch (err) {
    console.error('Failed to fetch transactions from Firestore:', err);
    return [];
  }
}

// ============================================================================
// Categories Management (Direct Firebase Cloud Firestore)
// ============================================================================

export function getStoredCategories(): string[] {
  return cachedInventoryCategories;
}

export function saveStoredCategories(categories: string[]): void {
  cachedInventoryCategories = categories;
  if (!db) return;
  const docRef = doc(db, 'systemConfig', 'inventoryCategories');
  setDoc(docRef, cleanForFirestore({ categories, updatedAt: serverTimestamp() }), { merge: true }).catch(() => {});
}

export function getStoredRepairCategories(): RepairCategory[] {
  return cachedRepairCategories;
}

export function saveStoredRepairCategories(cats: RepairCategory[]): void {
  cachedRepairCategories = cats;
}

export function subscribeRepairCategories(callback: (cats: RepairCategory[]) => void): () => void {
  callback(cachedRepairCategories);

  if (!db) return () => {};

  try {
    const colRef = collection(db, 'repairCategories');
    const unsub = onSnapshot(
      colRef,
      async (snapshot) => {
        if (!snapshot.empty) {
          const remoteCats = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as RepairCategory));
          cachedRepairCategories = remoteCats;
          callback(remoteCats);
        } else if (db) {
          // Seed standard categories into Firestore
          for (const cat of DEFAULT_REPAIR_CATEGORIES) {
            await setDoc(doc(db, 'repairCategories', cat.id), cleanForFirestore(cat));
          }
          cachedRepairCategories = [...DEFAULT_REPAIR_CATEGORIES];
          callback(DEFAULT_REPAIR_CATEGORIES);
        }
      },
      (err) => console.warn('Repair categories snapshot error:', err)
    );
    return unsub;
  } catch (e) {
    console.warn('Failed to listen to repairCategories in Firestore:', e);
    return () => {};
  }
}

export async function createRepairCategory(name: string): Promise<RepairCategory> {
  const cleanName = name.trim();
  const id = `cat-${Date.now()}`;
  const newCat: RepairCategory = {
    id,
    name: cleanName,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  cachedRepairCategories.push(newCat);

  if (db) {
    try {
      const docRef = doc(db, 'repairCategories', id);
      await setDoc(docRef, cleanForFirestore(newCat));
    } catch (err) {
      console.error('Firestore createRepairCategory error:', err);
    }
  }

  return newCat;
}

export async function updateRepairCategory(id: string, newName: string): Promise<void> {
  cachedRepairCategories = cachedRepairCategories.map((c) =>
    c.id === id ? { ...c, name: newName.trim() } : c
  );

  if (db) {
    try {
      const docRef = doc(db, 'repairCategories', id);
      await updateDoc(docRef, { name: newName.trim(), updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('Firestore updateRepairCategory error:', err);
    }
  }
}

export async function deleteRepairCategory(id: string): Promise<void> {
  cachedRepairCategories = cachedRepairCategories.filter((c) => c.id !== id);

  if (db) {
    try {
      const docRef = doc(db, 'repairCategories', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Firestore deleteRepairCategory error:', err);
    }
  }
}

export async function resetRepairCategoriesToDefault(): Promise<RepairCategory[]> {
  cachedRepairCategories = [...DEFAULT_REPAIR_CATEGORIES];
  if (db) {
    for (const cat of DEFAULT_REPAIR_CATEGORIES) {
      await setDoc(doc(db, 'repairCategories', cat.id), cleanForFirestore(cat));
    }
  }
  return DEFAULT_REPAIR_CATEGORIES;
}

export function getCategoryDisplayName(categoryKey: string, customCategories?: RepairCategory[]): string {
  if (!categoryKey) return '-';
  const list = customCategories && customCategories.length > 0 ? customCategories : cachedRepairCategories;
  const found = list.find((c) => c.id === categoryKey || c.name === categoryKey);
  if (found) return found.name;

  const legacyMap: Record<string, string> = {
    plumbing: 'ระบบประปา / สุขภัณฑ์ / ท่อตัน',
    electrical: 'ระบบไฟฟ้า / หลอดไฟ / สวิตช์',
    aircon: 'เครื่องปรับอากาศ / แอร์',
    furniture: 'เฟอร์นิเจอร์ / ประตู / ลูกบิด / หน้าต่าง',
    appliance: 'เครื่องใช้ไฟฟ้าส่วนกลาง',
    structural: 'โครงสร้าง / ผนัง / ฝ้าเพดาน / หลังคา',
    sanitary: 'ความสะอาด / ขยะ / สิ่งแวดล้อม',
    other: 'อื่นๆ',
  };

  return legacyMap[categoryKey] || categoryKey;
}

// ============================================================================
// Audit Log Service (Direct Firebase Cloud Firestore)
// ============================================================================

export async function createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  if (!db) return;
  try {
    const colRef = collection(db, 'auditLogs');
    await addDoc(
      colRef,
      cleanForFirestore({
        ...log,
        timestamp: serverTimestamp(),
      })
    );
  } catch (e) {
    console.warn('Audit log write error:', e);
  }
}

// ============================================================================
// System Baseline Initializer & Cleaner
// ============================================================================

export interface UploadSystemDataResult {
  success: boolean;
  uploadedAdmin: boolean;
  uploadedProperty: boolean;
  uploadedCategoriesCount: number;
  uploadedInventoryCategoriesCount: number;
  cleanedMockOrdersCount: number;
  cleanedMockItemsCount: number;
  message: string;
  syncedAt: string;
}

export async function uploadSystemDataToDatabase(): Promise<UploadSystemDataResult> {
  const syncedAt = new Date().toISOString();

  if (!db) {
    return {
      success: false,
      uploadedAdmin: false,
      uploadedProperty: false,
      uploadedCategoriesCount: 0,
      uploadedInventoryCategoriesCount: 0,
      cleanedMockOrdersCount: 0,
      cleanedMockItemsCount: 0,
      message: 'ไม่พบการเชื่อมต่อ Firebase Cloud Firestore',
      syncedAt,
    };
  }

  try {
    // 1. Upload Primary Admin account to Firestore
    const adminRef = doc(db, 'users', DEFAULT_PRIMARY_ADMIN.uid);
    await setDoc(
      adminRef,
      cleanForFirestore({
        ...DEFAULT_PRIMARY_ADMIN,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );

    // 2. Upload Default System Property to Firestore
    const propRef = doc(db, 'properties', DEFAULT_SYSTEM_PROPERTY.id);
    await setDoc(
      propRef,
      cleanForFirestore({
        ...DEFAULT_SYSTEM_PROPERTY,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );

    // 3. Upload Standard Repair Categories to Firestore
    for (const cat of DEFAULT_REPAIR_CATEGORIES) {
      const catRef = doc(db, 'repairCategories', cat.id);
      await setDoc(
        catRef,
        cleanForFirestore({
          ...cat,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
    }

    // 4. Upload Standard Inventory Categories & Metadata to Firestore
    const invCatRef = doc(db, 'systemConfig', 'inventoryCategories');
    await setDoc(
      invCatRef,
      cleanForFirestore({
        categories: DEFAULT_INVENTORY_CATEGORIES,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );

    const statusRef = doc(db, 'systemConfig', 'status');
    await setDoc(
      statusRef,
      cleanForFirestore({
        systemName: 'DormCare Dormitory Maintenance & Inventory System',
        systemVersion: '2.5.0',
        initializedAt: syncedAt,
        lastSyncedAt: syncedAt,
        hasMockData: false,
        adminUsername: DEFAULT_PRIMARY_ADMIN.username,
        defaultPropertyCode: DEFAULT_SYSTEM_PROPERTY.code,
        status: 'active',
        databaseBound: true,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    );

    // 5. Purge any legacy mock records from Firestore
    const legacyMockPropIds = ['prop-chula-01', 'prop-silom-02'];
    for (const mockId of legacyMockPropIds) {
      try {
        await deleteDoc(doc(db, 'properties', mockId));
      } catch (_) {}
    }

    const legacyMockWoIds = [
      'wo-doc-001',
      'wo-doc-002',
      'wo-doc-003',
      'wo-doc-004',
      'MC-202610-0001',
      'MC-202610-0002',
      'MC-202610-0003',
      'MC-202610-0004',
    ];
    for (const mockWoId of legacyMockWoIds) {
      try {
        await deleteDoc(doc(db, 'workOrders', mockWoId));
      } catch (_) {}
    }

    const legacyMockItemIds = ['item-001', 'item-002', 'item-003', 'item-004', 'item-005'];
    for (const mockItemId of legacyMockItemIds) {
      try {
        await deleteDoc(doc(db, 'inventoryItems', mockItemId));
      } catch (_) {}
    }

    const legacyMockTxIds = ['tx-001', 'tx-002', 'tx-003'];
    for (const mockTxId of legacyMockTxIds) {
      try {
        await deleteDoc(doc(db, 'inventoryTransactions', mockTxId));
      } catch (_) {}
    }

    return {
      success: true,
      uploadedAdmin: true,
      uploadedProperty: true,
      uploadedCategoriesCount: DEFAULT_REPAIR_CATEGORIES.length,
      uploadedInventoryCategoriesCount: DEFAULT_INVENTORY_CATEGORIES.length,
      cleanedMockOrdersCount: legacyMockWoIds.length,
      cleanedMockItemsCount: legacyMockItemIds.length,
      message: 'ผูกข้อมูลจริงกับ Firebase Cloud Firestore เรียบร้อย ปราศจากข้อมูลจำลอง',
      syncedAt,
    };
  } catch (error) {
    console.error('Error uploading baseline data to Firestore:', error);
    return {
      success: false,
      uploadedAdmin: false,
      uploadedProperty: false,
      uploadedCategoriesCount: 0,
      uploadedInventoryCategoriesCount: 0,
      cleanedMockOrdersCount: 0,
      cleanedMockItemsCount: 0,
      message: `เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ${error instanceof Error ? error.message : String(error)}`,
      syncedAt,
    };
  }
}
