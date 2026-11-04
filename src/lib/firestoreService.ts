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
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  WorkOrder,
  WorkOrderEvent,
  InventoryItem,
  InventoryTransaction,
  Property,
  UserProfile,
  TicketStatus,
  AuditLog,
  RepairCategory,
} from '../types';
import {
  INITIAL_PROPERTIES,
  INITIAL_WORK_ORDERS,
  INITIAL_INVENTORY,
  INITIAL_TRANSACTIONS,
  INITIAL_USERS,
} from './mockData';

// --- Local reactive state and Browser Database Storage ---
export const DEFAULT_PRIMARY_ADMIN: UserProfile = {
  uid: 'user-admin-primary',
  username: 'admin',
  password: '213894120',
  email: 'admin@dormcare.app',
  displayName: 'ผู้ดูแลระบบหลัก (Admin)',
  role: 'admin',
  propertyIds: ['prop-chula-01', 'prop-silom-02'],
  phone: '081-234-5678',
  isActive: true,
  createdAt: new Date().toISOString(),
};

const STORAGE_USERS_KEY = 'dormcare_db_users';
const STORAGE_PROPERTIES_KEY = 'dormcare_db_properties';

export function getStoredUsers(): UserProfile[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_USERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading stored users:', e);
  }
  const initial = [DEFAULT_PRIMARY_ADMIN];
  saveStoredUsers(initial);
  return initial;
}

export function saveStoredUsers(users: UserProfile[]): void {
  localUsers = users;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    }
  } catch (e) {
    console.warn('Error writing stored users:', e);
  }
}

export function getStoredProperties(): Property[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_PROPERTIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading stored properties:', e);
  }
  return localProperties;
}

export function saveStoredProperties(props: Property[]): void {
  localProperties = props;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_PROPERTIES_KEY, JSON.stringify(props));
    }
  } catch (e) {
    console.warn('Error writing stored properties:', e);
  }
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

let localProperties: Property[] = [...INITIAL_PROPERTIES];
let localWorkOrders: WorkOrder[] = [...INITIAL_WORK_ORDERS];
let localInventory: InventoryItem[] = [...INITIAL_INVENTORY];
let localTransactions: InventoryTransaction[] = [...INITIAL_TRANSACTIONS];
let localUsers: UserProfile[] = [...INITIAL_USERS];

const workOrderListeners: Array<(orders: WorkOrder[]) => void> = [];
const inventoryListeners: Array<(items: InventoryItem[]) => void> = [];

function notifyWorkOrders() {
  workOrderListeners.forEach((fn) => fn([...localWorkOrders]));
}

function notifyInventory() {
  inventoryListeners.forEach((fn) => fn([...localInventory]));
}

// Helper to generate next unique Ticket ID e.g. MC-202610-0005
export function generateTicketCode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `MC-${year}${month}-${randomSuffix}`;
}

/**
 * Recursively removes all keys with `undefined` values from an object or nested objects/arrays.
 * Preserves Firestore FieldValues (such as serverTimestamp()), Dates, etc.
 * This completely prevents Firestore's:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
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

// ----------------------------------------------------
// Properties Service
// ----------------------------------------------------

export async function fetchProperties(): Promise<Property[]> {
  const current = getStoredProperties();
  if (!isFirebaseConfigured() || !db) {
    return current;
  }

  try {
    const colRef = collection(db, 'properties');
    const snapshot = await withTimeout(getDocs(colRef), 1200, null);
    if (snapshot && !snapshot.empty) {
      const remoteProps = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Property));
      const propMap = new Map<string, Property>();
      current.forEach((p) => propMap.set(p.id, p));
      remoteProps.forEach((p) => propMap.set(p.id, p));
      const merged = Array.from(propMap.values());
      saveStoredProperties(merged);
      return merged;
    }
    return current;
  } catch (err) {
    console.warn('Falling back to local properties due to error:', err);
    return current;
  }
}

export async function saveProperty(property: Property): Promise<void> {
  const props = getStoredProperties();
  const idx = props.findIndex((p) => p.id === property.id);
  if (idx >= 0) {
    props[idx] = property;
  } else {
    props.push(property);
  }
  saveStoredProperties(props);

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  try {
    const docRef = doc(db, 'properties', property.id);
    const dataToSave = cleanForFirestore({
      ...property,
      updatedAt: new Date().toISOString(),
    });
    await withTimeout(setDoc(docRef, dataToSave, { merge: true }), 2000, null).catch((err) => {
      console.warn('Firestore setDoc note:', err);
    });
  } catch (e) {
    console.warn('Firestore saveProperty note:', e);
  }
}

export async function deleteProperty(propertyId: string): Promise<void> {
  let props = getStoredProperties();
  props = props.filter((p) => p.id !== propertyId);
  saveStoredProperties(props);

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  try {
    const docRef = doc(db, 'properties', propertyId);
    withTimeout(deleteDoc(docRef), 2000, null).catch(() => {});
  } catch (e) {
    console.warn('Firestore deleteProperty note:', e);
  }
}

// ----------------------------------------------------
// Work Orders Service (with onSnapshot Realtime updates)
// ----------------------------------------------------

export function subscribeWorkOrders(
  propertyId: string,
  user: UserProfile | null,
  callback: (orders: WorkOrder[]) => void
): () => void {
  if (!isFirebaseConfigured() || !db) {
    const filterAndEmit = () => {
      let filtered = localWorkOrders.filter((w) => w.propertyId === propertyId);
      if (user && user.role === 'resident') {
        filtered = filtered.filter((w) => w.requesterUid === user.uid);
      }
      callback(filtered);
    };

    filterAndEmit();
    workOrderListeners.push(filterAndEmit);

    return () => {
      const idx = workOrderListeners.indexOf(filterAndEmit);
      if (idx >= 0) workOrderListeners.splice(idx, 1);
    };
  }

  try {
    const colRef = collection(db, 'workOrders');
    let q = query(colRef, where('propertyId', '==', propertyId), orderBy('createdAt', 'desc'));

    if (user && user.role === 'resident') {
      q = query(
        colRef,
        where('propertyId', '==', propertyId),
        where('requesterUid', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((d) => ({ ...d.data(), docId: d.id } as WorkOrder));
        callback(orders);
      },
      (error) => {
        console.error('WorkOrders onSnapshot error:', error);
        // Fallback to local
        callback(localWorkOrders.filter((w) => w.propertyId === propertyId));
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Failed to setup WorkOrders snapshot:', err);
    callback(localWorkOrders.filter((w) => w.propertyId === propertyId));
    return () => {};
  }
}

export async function createWorkOrder(data: Omit<WorkOrder, 'docId' | 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ticketId = generateTicketCode();
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days retention
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

  if (!isFirebaseConfigured() || !db) {
    localWorkOrders.unshift(fullOrder);
    notifyWorkOrders();
    return ticketId;
  }

  // Real Firestore write
  const docRef = doc(db, 'workOrders', ticketId);
  await setDoc(docRef, cleanForFirestore({
    ...fullOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  // Record initial event in subcollection
  const eventRef = collection(db, 'workOrders', ticketId, 'events');
  await addDoc(eventRef, cleanForFirestore({
    ticketId,
    status: 'pending',
    note: 'สร้างใบแจ้งซ่อมเข้าระบบ',
    performedByUid: data.requesterUid,
    performedByName: data.requesterName,
    timestamp: serverTimestamp(),
  }));

  return ticketId;
}

export async function updateWorkOrderStatus(
  workOrder: WorkOrder,
  newStatus: TicketStatus,
  note: string,
  user: UserProfile,
  extraUpdates: Partial<WorkOrder> = {}
): Promise<void> {
  const now = new Date().toISOString();

  if (!isFirebaseConfigured() || !db) {
    const idx = localWorkOrders.findIndex((w) => w.id === workOrder.id);
    if (idx >= 0) {
      localWorkOrders[idx] = {
        ...localWorkOrders[idx],
        ...extraUpdates,
        status: newStatus,
        updatedAt: now,
      };
      notifyWorkOrders();
    }
    return;
  }

  const docRef = doc(db, 'workOrders', workOrder.id);
  await updateDoc(docRef, cleanForFirestore({
    ...extraUpdates,
    status: newStatus,
    updatedAt: serverTimestamp(),
  }));

  // Write immutable event to subcollection
  const eventRef = collection(db, 'workOrders', workOrder.id, 'events');
  await addDoc(eventRef, cleanForFirestore({
    ticketId: workOrder.id,
    status: newStatus,
    note,
    performedByUid: user.uid,
    performedByName: user.displayName,
    timestamp: serverTimestamp(),
  }));
}

// ----------------------------------------------------
// Inventory Service (with Atomic Transactions)
// ----------------------------------------------------

export function subscribeInventory(
  propertyId: string,
  callback: (items: InventoryItem[]) => void
): () => void {
  if (!isFirebaseConfigured() || !db) {
    const filterAndEmit = () => {
      const filtered = localInventory.filter((i) => i.propertyId === propertyId);
      callback(filtered);
    };

    filterAndEmit();
    inventoryListeners.push(filterAndEmit);

    return () => {
      const idx = inventoryListeners.indexOf(filterAndEmit);
      if (idx >= 0) inventoryListeners.splice(idx, 1);
    };
  }

  try {
    const colRef = collection(db, 'inventoryItems');
    const q = query(colRef, where('propertyId', '==', propertyId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as InventoryItem));
        callback(items);
      },
      (error) => {
        console.error('Inventory onSnapshot error:', error);
        callback(localInventory.filter((i) => i.propertyId === propertyId));
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('Failed to setup inventory snapshot:', err);
    callback(localInventory.filter((i) => i.propertyId === propertyId));
    return () => {};
  }
}

/**
 * ATOMIC WITHDRAWAL:
 * Validates available stock, deducts quantity, logs inventory transaction,
 * and updates work order's materialsUsed list in a single atomic transaction.
 * Prevents negative stock and race conditions!
 */
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

  // --- DEMO / LOCAL FALLBACK WITH ATOMIC SIMULATION ---
  if (!isFirebaseConfigured() || !db) {
    const itemIndex = localInventory.findIndex((i) => i.id === itemId && i.propertyId === propertyId);
    if (itemIndex === -1) {
      throw new Error('ไม่พบข้อมูลวัสดุในระบบ');
    }

    const currentItem = localInventory[itemIndex];
    if (currentItem.quantity < quantity) {
      throw new Error(`สต็อกไม่เพียงพอ! คงเหลือเพียง ${currentItem.quantity} ${currentItem.unit} (ต้องการเบิก ${quantity})`);
    }

    const previousQuantity = currentItem.quantity;
    const newQuantity = previousQuantity - quantity;

    // Update item stock
    localInventory[itemIndex] = {
      ...currentItem,
      quantity: newQuantity,
      updatedAt: new Date().toISOString(),
    };

    // Log transaction
    const txId = `tx-${Date.now()}`;
    const newTx: InventoryTransaction = {
      id: txId,
      propertyId,
      itemId,
      itemCode: currentItem.itemCode,
      itemName: currentItem.name,
      type,
      quantity,
      previousQuantity,
      newQuantity,
      unitPrice: currentItem.unitPrice,
      totalValue: quantity * currentItem.unitPrice,
      ticketId,
      reason,
      requesterUid,
      requesterName,
      requesterRoom,
      performedByUid: user.uid,
      performedByName: user.displayName,
      createdAt: new Date().toISOString(),
    };
    localTransactions.unshift(newTx);

    // If attached to a work order, update work order materials
    if (ticketId) {
      const woIndex = localWorkOrders.findIndex((w) => w.id === ticketId);
      if (woIndex >= 0) {
        const materials = [...localWorkOrders[woIndex].materialsUsed];
        materials.push({
          itemId,
          itemCode: currentItem.itemCode,
          itemName: currentItem.name,
          quantity,
          unit: currentItem.unit,
          unitPrice: currentItem.unitPrice,
          withdrawnAt: new Date().toISOString(),
          withdrawnByName: user.displayName,
        });
        localWorkOrders[woIndex] = {
          ...localWorkOrders[woIndex],
          materialsUsed: materials,
          updatedAt: new Date().toISOString(),
        };
        notifyWorkOrders();
      }
    }

    notifyInventory();
    return;
  }

  const firestore = db;
  // --- REAL FIRESTORE RUNTRANSACTION ---
  const itemDocRef = doc(firestore, 'inventoryItems', itemId);
  const txColRef = collection(firestore, 'inventoryTransactions');
  const txDocRef = doc(txColRef);

  await runTransaction(firestore, async (transaction) => {
    const itemSnapshot = await transaction.get(itemDocRef);
    if (!itemSnapshot.exists()) {
      throw new Error('ไม่พบเอกสารวัสดุชิ้นนี้ใน Firestore');
    }

    const itemData = itemSnapshot.data() as InventoryItem;
    if (itemData.quantity < quantity) {
      throw new Error(`สต็อกไม่เพียงพอ! คงเหลือเพียง ${itemData.quantity} ${itemData.unit} (ต้องการเบิก ${quantity})`);
    }

    const previousQuantity = itemData.quantity;
    const newQuantity = previousQuantity - quantity;

    // 1. Deduct item quantity
    transaction.update(itemDocRef, {
      quantity: newQuantity,
      updatedAt: serverTimestamp(),
    });

    // 2. Create inventory transaction log
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

    // 3. Update work order if ticketId exists
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

/**
 * RECEIVE INVENTORY (เพิ่มยอดพัสดุเข้าคลัง)
 */
export async function receiveInventoryItem(params: {
  propertyId: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  reason: string;
  user: UserProfile;
}): Promise<void> {
  const { propertyId, itemId, quantity, unitPrice, reason, user } = params;

  if (!isFirebaseConfigured() || !db) {
    const idx = localInventory.findIndex((i) => i.id === itemId);
    if (idx >= 0) {
      const current = localInventory[idx];
      const prev = current.quantity;
      const next = prev + quantity;
      localInventory[idx] = {
        ...current,
        quantity: next,
        unitPrice: unitPrice > 0 ? unitPrice : current.unitPrice,
        updatedAt: new Date().toISOString(),
      };

      localTransactions.unshift({
        id: `tx-${Date.now()}`,
        propertyId,
        itemId,
        itemCode: current.itemCode,
        itemName: current.name,
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
        createdAt: new Date().toISOString(),
      });

      notifyInventory();
    }
    return;
  }

  const firestore = db;
  const itemRef = doc(firestore, 'inventoryItems', itemId);
  const txColRef = collection(firestore, 'inventoryTransactions');
  const txRef = doc(txColRef);

  await runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(itemRef);
    if (!snap.exists()) throw new Error('ไม่พบข้อมูลวัสดุ');
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

/**
 * ADJUST STOCK (ปรับปรุงยอดตรวจนับจริง)
 */
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

  if (!isFirebaseConfigured() || !db) {
    const idx = localInventory.findIndex((i) => i.id === itemId);
    if (idx >= 0) {
      const current = localInventory[idx];
      const prev = current.quantity;
      const diff = newQuantity - prev;
      localInventory[idx] = {
        ...current,
        quantity: newQuantity,
        updatedAt: new Date().toISOString(),
      };

      localTransactions.unshift({
        id: `tx-${Date.now()}`,
        propertyId,
        itemId,
        itemCode: current.itemCode,
        itemName: current.name,
        type: 'adjustment',
        quantity: Math.abs(diff),
        previousQuantity: prev,
        newQuantity,
        unitPrice: current.unitPrice,
        totalValue: Math.abs(diff) * current.unitPrice,
        ticketId: null,
        reason: `${reason} (ปรับจาก ${prev} เป็น ${newQuantity})`,
        performedByUid: user.uid,
        performedByName: user.displayName,
        createdAt: new Date().toISOString(),
      });

      notifyInventory();
    }
    return;
  }

  const firestore = db;
  const itemRef = doc(firestore, 'inventoryItems', itemId);
  const txColRef = collection(firestore, 'inventoryTransactions');
  const txRef = doc(txColRef);

  await runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(itemRef);
    if (!snap.exists()) throw new Error('ไม่พบข้อมูลวัสดุ');
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

// ----------------------------------------------------
// Categories Management
// ----------------------------------------------------
const STORAGE_CATEGORIES_KEY = 'dormcare_db_inventory_categories';
export const DEFAULT_INVENTORY_CATEGORIES = ['งานประปา', 'งานไฟฟ้า'];

export function getStoredCategories(): string[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_CATEGORIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading stored categories:', e);
  }
  return DEFAULT_INVENTORY_CATEGORIES;
}

export function saveStoredCategories(categories: string[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories));
    }
  } catch (e) {
    console.warn('Error saving stored categories:', e);
  }
}

// ----------------------------------------------------
// Repair Categories Management (หมวดหมู่งานซ่อม: เพิ่ม ลบ แก้ไข)
// ----------------------------------------------------
const STORAGE_REPAIR_CATEGORIES_KEY = 'dormcare_db_repair_categories';

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

let localRepairCategories: RepairCategory[] = [];
const repairCategoryListeners: Array<(cats: RepairCategory[]) => void> = [];

export function notifyRepairCategories(cats: RepairCategory[]) {
  repairCategoryListeners.forEach((fn) => fn([...cats]));
}

export function getStoredRepairCategories(): RepairCategory[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_REPAIR_CATEGORIES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localRepairCategories = parsed;
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading stored repair categories:', e);
  }
  localRepairCategories = [...DEFAULT_REPAIR_CATEGORIES];
  saveStoredRepairCategories(localRepairCategories);
  return localRepairCategories;
}

export function saveStoredRepairCategories(cats: RepairCategory[]): void {
  localRepairCategories = cats;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_REPAIR_CATEGORIES_KEY, JSON.stringify(cats));
    }
  } catch (e) {
    console.warn('Error saving stored repair categories:', e);
  }
  notifyRepairCategories(cats);
}

export function subscribeRepairCategories(callback: (cats: RepairCategory[]) => void): () => void {
  const initial = getStoredRepairCategories();
  callback(initial);
  repairCategoryListeners.push(callback);

  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, 'repairCategories');
      const unsub = onSnapshot(
        colRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteCats = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as RepairCategory));
            saveStoredRepairCategories(remoteCats);
          }
        },
        (err) => console.warn('Repair categories snapshot error:', err)
      );
      return () => {
        unsub();
        const idx = repairCategoryListeners.indexOf(callback);
        if (idx >= 0) repairCategoryListeners.splice(idx, 1);
      };
    } catch (e) {
      console.warn('Failed to listen to repairCategories in Firestore:', e);
    }
  }

  return () => {
    const idx = repairCategoryListeners.indexOf(callback);
    if (idx >= 0) repairCategoryListeners.splice(idx, 1);
  };
}

export async function createRepairCategory(name: string): Promise<RepairCategory> {
  const current = getStoredRepairCategories();
  const cleanName = name.trim();
  const id = `cat-${Date.now()}`;
  const newCat: RepairCategory = {
    id,
    name: cleanName,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  const updated = [...current, newCat];
  saveStoredRepairCategories(updated);

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'repairCategories', id);
      await setDoc(docRef, cleanForFirestore(newCat));
    } catch (err) {
      console.warn('Firestore createRepairCategory error:', err);
    }
  }

  return newCat;
}

export async function updateRepairCategory(id: string, newName: string): Promise<void> {
  const current = getStoredRepairCategories();
  const updated = current.map((c) => (c.id === id ? { ...c, name: newName.trim() } : c));
  saveStoredRepairCategories(updated);

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'repairCategories', id);
      await updateDoc(docRef, { name: newName.trim(), updatedAt: serverTimestamp() });
    } catch (err) {
      console.warn('Firestore updateRepairCategory error:', err);
    }
  }
}

export async function deleteRepairCategory(id: string): Promise<void> {
  const current = getStoredRepairCategories();
  const updated = current.filter((c) => c.id !== id);
  saveStoredRepairCategories(updated);

  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'repairCategories', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore deleteRepairCategory error:', err);
    }
  }
}

export async function resetRepairCategoriesToDefault(): Promise<RepairCategory[]> {
  saveStoredRepairCategories([...DEFAULT_REPAIR_CATEGORIES]);
  return DEFAULT_REPAIR_CATEGORIES;
}

export function getCategoryDisplayName(categoryKey: string, customCategories?: RepairCategory[]): string {
  if (!categoryKey) return '-';
  const list = customCategories && customCategories.length > 0 ? customCategories : getStoredRepairCategories();
  const found = list.find((c) => c.id === categoryKey || c.name === categoryKey);
  if (found) return found.name;

  // Fallback map for legacy identifiers
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

/**
 * CREATE NEW INVENTORY ITEM (เพิ่มรายการวัสดุใหม่)
 */
export async function createInventoryItem(params: {
  item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>;
  user: UserProfile;
}): Promise<InventoryItem> {
  const { item, user } = params;
  const newItemId = `item-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const newItem: InventoryItem = {
    ...item,
    id: newItemId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 1. Optimistic Local update
  localInventory.unshift(newItem);
  notifyInventory();

  // If initial quantity > 0, log an initial receive transaction
  if (newItem.quantity > 0) {
    const initialTx: InventoryTransaction = {
      id: `tx-${Date.now()}`,
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
      createdAt: nowIso,
    };
    localTransactions.unshift(initialTx);
  }

  // 2. Persist to Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const docRef = doc(db, 'inventoryItems', newItemId);
      const dataToSave = cleanForFirestore({
        ...newItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      withTimeout(setDoc(docRef, dataToSave), 2500, null).catch((err) => {
        console.warn('Firestore setDoc inventoryItem note:', err);
      });

      if (newItem.quantity > 0) {
        const txColRef = collection(db, 'inventoryTransactions');
        addDoc(txColRef, cleanForFirestore({
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
        })).catch(() => {});
      }
    } catch (e) {
      console.warn('createInventoryItem firestore note:', e);
    }
  }

  return newItem;
}

/**
 * DELETE INVENTORY ITEM (ลบรายการวัสดุ)
 */
export async function deleteInventoryItem(itemId: string): Promise<void> {
  localInventory = localInventory.filter((i) => i.id !== itemId);
  notifyInventory();

  if (!isFirebaseConfigured() || !db) return;

  try {
    const docRef = doc(db, 'inventoryItems', itemId);
    withTimeout(deleteDoc(docRef), 2000, null).catch(() => {});
  } catch (e) {
    console.warn('deleteInventoryItem note:', e);
  }
}

export async function fetchTransactions(propertyId: string): Promise<InventoryTransaction[]> {
  if (!isFirebaseConfigured() || !db) {
    return localTransactions.filter((t) => t.propertyId === propertyId);
  }

  try {
    const colRef = collection(db, 'inventoryTransactions');
    const q = query(colRef, where('propertyId', '==', propertyId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as InventoryTransaction));
  } catch (err) {
    console.warn('Failed to fetch real transactions, using local fallback:', err);
    return localTransactions.filter((t) => t.propertyId === propertyId);
  }
}

// ----------------------------------------------------
// Users & Audit Log Service
// ----------------------------------------------------

export async function fetchUsersList(propertyId?: string): Promise<UserProfile[]> {
  let users = getStoredUsers();

  // Ensure primary admin requested by user is always included
  if (!users.some((u) => u.username?.toLowerCase() === 'admin')) {
    users.unshift(DEFAULT_PRIMARY_ADMIN);
    saveStoredUsers(users);
  }

  if (isFirebaseConfigured() && db) {
    try {
      const colRef = collection(db, 'users');
      const snap = await withTimeout(getDocs(colRef), 1200, null);
      if (snap && !snap.empty) {
        const remoteUsers = snap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserProfile));
        if (!remoteUsers.some((u) => u.username?.toLowerCase() === 'admin')) {
          remoteUsers.unshift(DEFAULT_PRIMARY_ADMIN);
        }
        users = remoteUsers;
        saveStoredUsers(users);
      }
    } catch (err) {
      console.warn('Fetch users from Firestore note, using stored data:', err);
    }
  }

  if (!propertyId) return users;
  return users.filter((u) => u.propertyIds?.includes(propertyId));
}

export async function saveUserProfile(user: UserProfile): Promise<void> {
  const users = getStoredUsers();
  const idx = users.findIndex((u) => u.uid === user.uid);
  if (idx >= 0) {
    users[idx] = user;
  } else {
    users.unshift(user);
  }
  saveStoredUsers(users);

  if (!isFirebaseConfigured() || !db) {
    return;
  }

  try {
    const docRef = doc(db, 'users', user.uid);
    const dataToSave = cleanForFirestore({
      ...user,
      updatedAt: serverTimestamp(),
    });
    withTimeout(setDoc(docRef, dataToSave, { merge: true }), 2000, null).catch(() => {});
  } catch (e) {
    console.warn('Firestore saveUserProfile note:', e);
  }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const users = getStoredUsers();
  const idx = users.findIndex((u) => u.uid === uid);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...updates };
    saveStoredUsers(users);
  }

  if (!isFirebaseConfigured() || !db) return;

  try {
    const docRef = doc(db, 'users', uid);
    const dataToUpdate = cleanForFirestore({
      ...updates,
      updatedAt: serverTimestamp(),
    });
    withTimeout(updateDoc(docRef, dataToUpdate), 2000, null).catch(() => {});
  } catch (e) {
    console.warn('Firestore updateUserProfile note:', e);
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  let users = getStoredUsers();
  users = users.filter((u) => u.uid !== uid);
  saveStoredUsers(users);

  if (!isFirebaseConfigured() || !db) return;

  try {
    const docRef = doc(db, 'users', uid);
    withTimeout(deleteDoc(docRef), 2000, null).catch(() => {});
  } catch (e) {
    console.warn('Firestore deleteUserProfile note:', e);
  }
}

export async function createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    return;
  }
  try {
    const colRef = collection(db, 'auditLogs');
    await addDoc(colRef, cleanForFirestore({
      ...log,
      timestamp: serverTimestamp(),
    }));
  } catch (e) {
    console.warn('Audit log write error:', e);
  }
}
