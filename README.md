# DormCare — ระบบบริหารงานแจ้งซ่อมหอพักและคลังวัสดุ (Multi-Property)

ระบบเว็บแอปพลิเคชันสำหรับบริหารจัดการงานแจ้งซ่อมบำรุงและคลังวัสดุสำหรับหอพักหลายแห่ง (Multi-tenant) พัฒนาด้วย React 19, TypeScript, Vite, Tailwind CSS, Firebase Authentication, Cloud Firestore และ GitHub Pages ภายใต้เงื่อนไข **ใช้งานฟรี 100% (Firebase Spark Plan) ไม่ต้องผูกบัตรเครดิต ไม่เปิด Billing และไม่มีค่าใช้จ่ายแอบแฝง**

---

## สถาปัตยกรรมระบบและข้อจำกัดการใช้งานฟรี (Free-Tier Architecture)

1. **Frontend Hosting:** โฮสต์บน GitHub Pages เป็น Static SPA ฟรี พร้อมระบบ fallback routing `404.html`
2. **Authentication:** Firebase Authentication (Email/Password) ใช้งานฟรี ไม่จำกัดจำนวนผู้ใช้
3. **Database:** Cloud Firestore (Spark Plan)
   - **Reads:** 50,000 ครั้ง/วัน
   - **Writes:** 20,000 ครั้ง/วัน
   - **พื้นที่จัดเก็บ:** 1 GiB
   - **ขนาดเอกสารสูงสุด:** ไม่เกิน 1 MiB ต่อเอกสาร (ระบบควบคุมขนาดรวมไม่เกิน 700 KB)
4. **การจัดเก็บรูปภาพ:** บีบอัดรูปภาพผ่าน HTML5 Canvas ในเบราว์เซอร์ของผู้ใช้ก่อนอัปโหลดเป็น WebP/JPEG คุณภาพสูง ขนาดไม่เกิน 150 KB/รูป ไม่เกิน 2 รูปต่อใบงาน และฝังในเอกสาร Firestore โดยตรง จึง**ไม่ต้องเปิดใช้ Firebase Storage หรือเสียเงินเปิด Billing**
5. **การล้างข้อมูลเก่าอัตโนมัติ (365 วัน):** ใช้ GitHub Actions Scheduled Workflow ร่วมกับ Node.js / Firebase Admin SDK รันฟรีทุกวัน เพื่อลบใบงานและบันทึกคลังที่อายุเกิน 365 วัน โดยไม่ใช้ Cloud Functions ที่ต้องใช้ Blaze Plan

---

## สิทธิ์ผู้ใช้งาน 3 ระดับ (Role-Based Access Control)

| บทบาท | หน้าที่และความสามารถ | การจำกัดสิทธิ์ |
| :--- | :--- | :--- |
| **1. ผู้ดูแลระบบ (Admin)** | • จัดการหอพัก อาคาร และห้องพัก<br>• สร้างและกำหนดบทบาทผู้ใช้งาน<br>• จัดการคลังวัสดุ รับเข้า และปรับยอด<br>• ดูประวัติการเบิกใช้วัสดุและรายงานสถิติ<br>• ส่งออกไฟล์สำรองข้อมูล (JSON) | • เข้าถึงได้เฉพาะหอพักที่ได้รับมอบหมาย (หรือทุกหอพักหากเป็น Super Admin) |
| **2. ช่างซ่อม / เจ้าหน้าที่ (Staff)** | • ตรวจสอบรายการแจ้งซ่อมประจำหอพักแบบ Real-time<br>• กดรับงาน บันทึกผลการตรวจซ่อม และเริ่มซ่อม<br>• เบิกวัสดุในใบงาน (ระบบตัดสต็อกอัตโนมัติแบบ Atomic Transaction)<br>• บันทึกส่งงานต่อให้ช่าง/ผู้รับเหมาภายนอก พร้อมค่าใช้จ่าย<br>• ปิดงานซ่อมเมื่อกรอกผลการซ่อมครบถ้วน | • เข้าถึงได้เฉพาะหอพักที่ตนได้รับมอบหมาย<br>• ไม่สามารถแก้ไขสิทธิ์ของตนเองหรือผู้อื่น |
| **3. ผู้พักอาศัย (Resident)** | • ส่งใบแจ้งซ่อม พร้อมแนบภาพถ่ายชำรุด (บีบอัดอัตโนมัติ)<br>• ติดตามสถานะงานซ่อมห้องของตนเอง<br>• เบิกวัสดุของใช้จำเป็นโดยไม่มีใบงาน (เฉพาะเมื่อหอพักเปิดสิทธิ์) | • มองเห็นเฉพาะใบแจ้งซ่อมของห้องตนเองเท่านั้น<br>• ห้ามเข้าถึงหน้าบริหารหรือแก้ยอดสต็อกโดยตรง |

---

## คู่มือการติดตั้งและตั้งค่าระบบ (10 ขั้นตอนฉบับสมบูรณ์)

### ขั้นตอนที่ 1: สร้าง Firebase Project (เลือก Spark Plan ฟรี)
1. ไปที่ [Firebase Console](https://console.firebase.google.com/) แล้วเข้าสู่ระบบด้วย Google Account
2. คลิก **Add project** (หรือ "สร้างโปรเจกต์")
3. ตั้งชื่อโปรเจกต์ เช่น `dormcare-demo`
4. ปิดการใช้งาน Google Analytics (หรือไม่เลือกเพื่อความรวดเร็ว) แล้วคลิก **Create project**
5. ตรวจสอบว่าแพ็กเกจเป็น **Spark Plan (Free $0/month)** ซึ่งไม่มีการขอข้อมูลบัตรเครดิต

---

### ขั้นตอนที่ 2: เปิดใช้งาน Authentication (Email/Password)
1. ในแถบเมนูด้านซ้าย เลือก **Build > Authentication** แล้วคลิก **Get started**
2. ในแท็บ **Sign-in method** เลือก **Email/Password**
3. เปิดสวิตช์ (Enable) เฉพาะตัวเลือกแรก **Email/Password** (ตัวเลือก Email link ไม่ต้องเปิด)
4. คลิก **Save**

---

### ขั้นตอนที่ 3: สร้าง Cloud Firestore Database และตั้งค่า Rules
1. ในแถบเมนูด้านซ้าย เลือก **Build > Firestore Database** แล้วคลิก **Create database**
2. เลือก Region ใกล้ประเทศไทยเพื่อความเร็ว เช่น `asia-southeast1` (สิงคโปร์)
3. เลือกระบบความปลอดภัยเริ่มต้นเป็น **Start in production mode** แล้วคลิก **Create**
4. ไปที่แท็บ **Rules** แล้วคัดลอกโค้ดจากไฟล์ `firestore.rules` ในโปรเจกต์นี้ทั้งหมดไปวางแทนที่
5. คลิก **Publish** เพื่อเปิดใช้งานกฎความปลอดภัยที่เข้มงวด

---

### ขั้นตอนที่ 4: สร้างบัญชีผู้ดูแลระบบ (Admin) คนแรกอย่างปลอดภัย
เนื่องจากระบบความปลอดภัยปิดไม่ให้ผู้ใช้ทั่วไปสถาปนาตนเองเป็น Admin:
1. ไปที่ **Firebase Console > Authentication > Users** แล้วคลิก **Add user**
2. กรอกอีเมลและรหัสผ่านของผู้ดูแลคนแรก เช่น `admin@dormcare.internal`
3. คัดลอกค่า **User UID** ของบัญชีที่เพิ่งสร้าง
4. นำ UID ที่ได้ไปเปิดสิทธิ์ใน Firestore:
   - ไปที่ **Firestore Database > Data**
   - คลิก **Start collection** ตั้งชื่อคอลเลกชันว่า `users`
   - ในช่อง **Document ID** ให้วางค่า **UID** ของแอดมินที่คัดลอกมา
   - เพิ่มฟิลด์ต่อไปนี้:
     ```json
     {
       "uid": "<วาง_UID_ที่นี่>",
       "email": "admin@dormcare.internal",
       "displayName": "ผู้ดูแลระบบหลัก",
       "role": "admin",
       "propertyIds": ["prop-pk-01"],
       "isActive": true,
       "createdAt": "2026-10-28T00:00:00.000Z"
     }
     ```
   - คลิก **Save**
5. (แนะนำ) ในไฟล์ `firestore.rules` คุณสามารถเปลี่ยนข้อความ `"YOUR_INITIAL_ADMIN_UID"` ให้เป็น UID นี้ เพื่อเป็นกฎสำรองระดับโครงสร้างฐานข้อมูล

---

### ขั้นตอนที่ 5: ตั้งค่า Environment Variables
1. ไปที่ **Firebase Console > Project Settings (รูปฟันเฟือง) > General**
2. เลื่อนลงมาที่หัวข้อ **Your apps** แล้วคลิกไอคอนเว็บ `</>` เพื่อลงทะเบียน Web App ตั้งชื่อว่า `dormcare-web`
3. Firebase จะแสดงค่า `firebaseConfig` ให้คัดลอกค่ามาตั้งในไฟล์ `.env` (คัดลอกจาก `.env.example`):
   ```env
   VITE_FIREBASE_API_KEY="AIzaSy..."
   VITE_FIREBASE_AUTH_DOMAIN="dormcare-demo.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="dormcare-demo"
   VITE_FIREBASE_STORAGE_BUCKET="dormcare-demo.appspot.com"
   VITE_FIREBASE_MESSAGING_SENDER_ID="123456789012"
   VITE_FIREBASE_APP_ID="1:123456789012:web:abcdef123456"
   VITE_BASE_PATH="./"
   ```
> **หมายเหตุความปลอดภัย:** ค่าคอนฟิกด้านบนเป็น Public Client Web Config ไม่ใช่ Private Key หรือ Service Account ลับ ความปลอดภัยที่แท้จริงควบคุมโดย `firestore.rules`

---

### ขั้นตอนที่ 6: ทดสอบบัญชีทั้ง 3 บทบาท
- **โหมดทดลอง (Sandbox Demo):** เมื่อเปิดเว็บครั้งแรก สามารถกดปุ่มสลับบทบาท `ผู้ดูแล (Admin)`, `ช่างซ่อม (Staff)`, หรือ `ผู้พักอาศัย (Resident)` ได้ทันทีโดยไม่ต้องกรอกรหัสผ่าน เพื่อทดลองใช้งาน UI
- **โหมดฐานข้อมูลจริง (Production):**
  1. เข้าสู่ระบบด้วยอีเมล Admin ที่สร้างในขั้นตอนที่ 4
  2. ไปที่เมนู **"จัดการผู้ใช้งาน"** เพื่อสร้างบัญชีช่างซ่อม และบัญชีผู้พักอาศัย
  3. ระบบจะใช้ Secondary Firebase App ในการสร้างบัญชี ทำให้เซสชันของผู้ดูแลไม่หลุด
  4. ทดสอบล็อกอินด้วยบัญชีช่างเพื่อรับงาน และบัญชีผู้พักอาศัยเพื่อส่งใบแจ้งซ่อม

---

### ขั้นตอนที่ 7: สร้าง GitHub Repository และ Deploy ขึ้น GitHub Pages
1. สร้าง Git Repository ใหม่บน GitHub
2. กำหนด Remote และ Push โค้ดขึ้น branch `main`:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: DormCare production app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. บน GitHub ไปที่ **Settings > Pages**
   - ในหัวข้อ **Build and deployment > Source** ให้เลือกเป็น **GitHub Actions**
4. ไปที่ **Firebase Console > Authentication > Settings > Authorized domains**
   - เพิ่มโดเมน GitHub Pages ของคุณ เช่น `<your-username>.github.io` เพื่ออนุญาตให้เข้าสู่ระบบได้
5. เมื่อ GitHub Actions รันเสร็จสิ้น เว็บของคุณจะพร้อมใช้งานผ่าน URL ของ GitHub Pages ทันที

---

### ขั้นตอนที่ 8: ตั้งค่า GitHub Secrets สำหรับ Scheduled Cleanup Workflow
เพื่อให้ระบบสามารถลบข้อมูลเก่าอัตโนมัติทุกวันผ่าน GitHub Actions:
1. ไปที่ **Firebase Console > Project Settings > Service accounts**
2. คลิก **Generate new private key** (จะได้รับไฟล์ `.json`)
3. เปิดไฟล์ `.json` นั้นแล้วคัดลอกเนื้อหาทั้งหมด
4. ไปที่ **GitHub Repository > Settings > Secrets and variables > Actions**
5. คลิก **New repository secret**
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Secret:** วางเนื้อหา JSON ทั้งหมดที่คัดลอกมา
6. คลิก **Add secret**
> **ข้อควรระวัง:** ห้าม commit หรือนำไฟล์ Service Account JSON ไปใส่ในโค้ด frontend เด็ดขาด!

---

### ขั้นตอนที่ 9: ทดสอบการลบข้อมูลเก่า (Cleanup Script)
สามารถทดสอบการรันสคริปต์ได้ 2 วิธี:
1. **ทดสอบผ่าน GitHub Actions:**
   - ไปที่แท็บ **Actions > DormCare Scheduled 365-Day Data Cleanup**
   - คลิก **Run workflow** และเลือกเปิดเช็คบ็อกซ์ `Dry Run` (สแกนอย่างเดียว ไม่ลบจริง) เพื่อดูรายงานผลลัพธ์
2. **ทดสอบในเครื่องคอมพิวเตอร์ของคุณ (Local CLI):**
   ```bash
   export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
   npx tsx scripts/cleanup-expired-data.ts --dry-run
   ```
   สคริปต์จะแสดงจำนวนใบงานที่หมดอายุ Subcollection `events` ที่จะถูกลบ และยืนยันว่าข้อมูลหลัก (Users, Properties, Items) จะไม่ได้รับผลกระทบ

---

### ขั้นตอนที่ 10: การตรวจสอบโควต้า, การสำรองข้อมูล และความปลอดภัย
1. **การควบคุมขนาดเอกสาร:** รูปถ่ายทุกใบจะผ่านการบีบอัดลงเหลือไม่เกิน 150 KB ต่อรูป (สูงสุด 2 รูป = 300 KB) ทำให้ขนาดเอกสารรวมของใบงานไม่เกิน 700 KB ปลอดภัยจากขีดจำกัด 1 MiB ของ Firestore
2. **การสำรองข้อมูล (Backup):** ไปที่เมนู **"ตั้งค่า & Health Check"** ผู้ดูแลระบบสามารถคลิก **"ส่งออกข้อมูล (Export JSON)"** เพื่อดาวน์โหลดไฟล์สำรองข้อมูลของหอพักลงเครื่องได้ตลอดเวลา
3. **การตรวจสอบสิทธิ์ข้ามหอพัก (Multi-tenant Isolation):** ใน Firestore Rules จะตรวจสอบ `propertyId in getUserData().propertyIds` ในทุกการอ่านและเขียนข้อมูล ป้องกันไม่ให้ช่างหรือผู้พักอาศัยดูข้อมูลของหอพักอื่นได้อย่างเด็ดขาด

---

## โครงสร้างโปรเจกต์ (Project Structure)

```text
├── .github/
│   └── workflows/
│       ├── deploy.yml                   # Deploy เว็บไป GitHub Pages
│       └── cleanup-expired-data.yml      # Cron job ลบข้อมูลเก่า 365 วัน
├── scripts/
│   └── cleanup-expired-data.ts           # Node script ลบข้อมูลหมดอายุด้วย Admin SDK
├── src/
│   ├── components/
│   │   ├── ConfirmModal.tsx             # กล่องยืนยันการทำรายการสำคัญ
│   │   ├── FirebaseSetupModal.tsx       # หน้าต่างตรวจ Health Check และตั้งค่า Web Config
│   │   ├── Header.tsx                   # แถบเมนูด้านบนพร้อมตัวสลับบทบาทจำลอง
│   │   ├── NewWorkOrderModal.tsx        # แบบฟอร์มแจ้งซ่อมพร้อมบีบอัดรูปภาพ
│   │   ├── ResidentWithdrawModal.tsx    # แบบฟอร์มเบิกของใช้สำหรับผู้พักอาศัย
│   │   ├── Sidebar.tsx                  # เมนูนำทางแบบแยกตามบทบาทผู้ใช้
│   │   └── Toast.tsx                    # การแจ้งเตือนข้อผิดพลาด/สำเร็จภาษาไทย
│   ├── layouts/
│   │   └── AppLayout.tsx                # โครงสร้างหน้าหลักและแถบเตือน Sandbox
│   ├── lib/
│   │   ├── authContext.tsx              # ตัวจัดการสถานะเข้าสู่ระบบและการสลับหอพัก
│   │   ├── firebase.ts                  # เชื่อมต่อ Firebase และ Secondary Auth
│   │   ├── firestoreService.ts          # บริการจัดการฐานข้อมูลและ Atomic Transaction
│   │   ├── imageCompression.ts         # อัลกอริทึมบีบอัดรูปภาพบนเบราว์เซอร์
│   │   ├── mockData.ts                  # ข้อมูลตัวอย่างสำหรับโหมดทดลองใช้งาน
│   │   ├── permissions.ts               # ฟังก์ชันตรวจสอบสิทธิ์ 3 ระดับ
│   │   └── validation.ts                # ตรวจสอบความถูกต้องของแบบฟอร์มภาษาไทย
│   ├── pages/
│   │   ├── DashboardPage.tsx            # สรุปภาพรวมและ KPI หอพัก
│   │   ├── InventoryPage.tsx            # บริหารคลัง รับเข้า และปรับยอดสต็อก
│   │   ├── InventoryTransactionsPage.tsx# ประวัติการเคลื่อนไหวพัสดุ (Audit Trail)
│   │   ├── LoginPage.tsx                # หน้าเข้าสู่ระบบและบัญชีทดสอบ 1-Click
│   │   ├── PropertiesPage.tsx           # จัดการหอพัก อาคาร และเปิดสิทธิ์ผู้พักอาศัย
│   │   ├── ReportsPage.tsx              # สรุปรายงานรายเดือน/สัปดาห์พร้อมสั่งพิมพ์ PDF
│   │   ├── SettingsPage.tsx             # ตรวจสอบสุขภาพระบบและส่งออกข้อมูล
│   │   ├── UsersPage.tsx                # จัดการบัญชีผู้ใช้และมอบหมายหอพัก
│   │   ├── WorkOrderDetailPage.tsx      # รายละเอียดใบงาน การเบิกอะไหล่ และส่งช่างนอก
│   │   └── WorkOrdersPage.tsx           # รายการใบแจ้งซ่อม Real-time พร้อมตัวกรอง
│   ├── types/
│   │   └── index.ts                     # TypeScript Interfaces ทั้งหมด
│   ├── App.tsx                          # Root Application Component
│   ├── index.css                        # Tailwind CSS และ Print Styles
│   └── main.tsx                         # Entry point
├── firestore.rules                      # กฎความปลอดภัย Cloud Firestore
├── firestore.indexes.json               # ดัชนี Composite สำหรับ Query
├── firebase.json                        # คอนฟิกการ Deploy Firebase
├── package.json                         # Dependencies
└── README.md                            # คู่มือการใช้งานภาษาไทย
```

---

## การพัฒนาในเครื่อง (Local Development)

```bash
# ติดตั้ง dependencies
npm install

# รัน Development Server (พอร์ต 3000)
npm run dev

# ตรวจสอบ TypeScript Lint
npm run lint

# สร้าง Production Build
npm run build
```

---
*DormCare — พัฒนาขึ้นเพื่อการบริหารจัดการหอพักที่เสถียร ปลอดภัย และประหยัดค่าใช้จ่ายอย่างแท้จริง*
