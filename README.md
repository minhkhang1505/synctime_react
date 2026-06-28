# SyncTime - Hệ thống Lên lịch rảnh & Quản lý Chi tiêu nhóm thời gian thực

SyncTime là một ứng dụng web cao cấp giúp kết nối, lên lịch rảnh và quản lý các khoản chi tiêu dùng chung (tiền nước, tiền gửi xe...) cho nhóm bạn bè, bạn cùng phòng hoặc đồng nghiệp một cách trực quan, tối ưu và nhanh chóng theo thời gian thực.

---

## Hình ảnh Giao diện Dự án

> [!NOTE]
> Bạn có thể thay thế đường dẫn hình ảnh dưới đây bằng ảnh chụp màn hình thực tế của ứng dụng sau khi triển khai.

| Trang chủ (Lịch khớp hôm nay) | Biểu đồ lịch khớp (Heatmap) | Quản lý Chi tiêu & Ghi nhận |
| :---: | :---: | :---: |
| ![Trang chủ](https://drive.google.com/file/d/1dH7nPOcacnsopq4vOdLtMgPGhiAGdsuN/view?usp=drive_link) | ![Biểu đồ Heatmap](https://drive.google.com/file/d/1bsntmfw3nmCFndjDECN5YCN39UYZAyOY/view?usp=drive_link) | ![Quản lý Chi tiêu](https://drive.google.com/file/d/1TOdlk7gWeDgff6WPFgIXtfSdpBX2s0FC/view?usp=drive_link) |

---

## Các Tính Năng Nổi Bật

### 1. Cài Đặt Lịch Rảnh & Biểu Đồ Lịch Khớp (Heatmap)
* **Cài đặt giờ rảnh cá nhân**: Cho phép từng thành viên tự chọn các khung giờ rảnh trong tuần (Sáng/Chiều/Tối) thông qua giao diện ô lưới (Grid) mượt mà.
* **Biểu đồ nhiệt thông minh (Live Heatmap)**: Tổng hợp lịch rảnh của cả nhóm theo thời gian thực. 
  * Tự động tính toán số lượng người rảnh trên mỗi khung giờ.
  * Hiển thị trạng thái màu sắc trực quan (Bận, Khớp 1 phần, Khớp hoàn hảo với hiệu ứng lấp lánh ✨).
  * Panel chi tiết xem chính xác danh sách những ai đang rảnh trong khung giờ được chọn.

### 2. Quản Lý Chi Tiêu & Thanh Toán Nhóm (Payments & Tracking)
* **Lịch theo dõi chi tiết**: Giao diện lịch cuộn theo tháng trực quan, hiển thị các biểu tượng chi tiêu (`💧` cho tiền nước, `🚗` cho tiền xe) kèm số tiền rút gọn tiện lợi (ví dụ: `50k`, `1tr` thay vì hiển thị đầy đủ số 0).
* **Quy tắc định dạng số tiền thông minh**:
  * Định dạng phân tách hàng nghìn bằng dấu chấm chuẩn tiếng Việt (ví dụ: `100.000`, `1.500.000`).
  * Tự động rút gọn đơn vị thông minh: Số triệu tròn hiển thị dạng `1tr`, `2tr` (không lẻ `.0`). Số lẻ hiển thị tối đa 3 chữ số sau dấu phẩy và làm tròn (ví dụ: `1.235tr`).
* **Popup ghi nhận nhanh**:
  * Tích hợp bộ tăng/giảm nhanh giá trị bằng nút bấm `+ 5.000` / `- 5.000`.
  * Các chip chọn nhanh số tiền phổ biến (`+10.000`, `+50.000`, `+100.000`).
* **Lịch sử ghi nhận (Tracking List)**: Hiển thị danh sách chi tiêu gần đây, tự động làm nổi bật (highlight) tên người ghi nhận giúp nhóm dễ theo dõi.

### 3. Hệ Thống Thông Báo Thời Gian Thực (Real-time Notifications)
* Tự động gửi thông báo đến các thành viên trong nhóm khi có các hoạt động:
  * Thành viên mới tham gia hoặc rời nhóm.
  * Có người cập nhật lịch rảnh.
  * Có người ghi nhận chi tiêu mới hoặc hoàn tất thanh toán.
* Tích hợp thông báo Toast trực tiếp trên màn hình theo thời gian thực mà không cần tải lại trang.

### 4. Phân Quyền & Bảo Mật (RLS Policies)
* **Bảo mật dữ liệu**: Sử dụng các chính sách bảo mật cấp hàng (Row Level Security - RLS) trên Supabase đảm bảo thành viên chỉ xem được thông tin của nhóm mình tham gia.
* **Quyền chủ nhóm (Owner Only)**: Chỉ người tạo nhóm mới có quyền xóa nhóm. Hệ thống tự động xử lý xóa liên hoàn (Cascade Delete) sạch sẽ các dữ liệu liên quan mà không lỗi khóa ngoại.

---

## Công Nghệ Sử Dụng

* **Frontend**:
  * [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
  * [Tailwind CSS](https://tailwindcss.com/) (Giao diện Glassmorphism hiện đại, responsive tốt trên Mobile & Desktop)
  * [TanStack Query v5 (React Query)](https://tanstack.com/query/latest) (Đồng bộ, quản lý cache và trạng thái server)
  * [Zustand](https://zustand-demo.pmnd.rs/) (Quản lý trạng thái UI local)
  * [Lucide React](https://lucide.dev/) (Icon pack hiện đại)
  * [Date-fns](https://date-fns.org/) (Xử lý thời gian và bản địa hóa tiếng Việt)

* **Backend & Database**:
  * [Supabase](https://supabase.com/) (Database PostgreSQL, Realtime Sync, Storage & Authentication qua Google Account)
  * RLS Policies, Database Triggers & Functions (PL/pgSQL)

---

## Hướng Dẫn Cài Đặt Dự Án

### 1. Yêu cầu hệ thống
* Đã cài đặt [Node.js](https://nodejs.org/) (Khuyến nghị phiên bản 18 trở lên).
* Có tài khoản [Supabase](https://supabase.com/).

### 2. Cài đặt các thư viện phụ thuộc
Di chuyển vào thư mục dự án và chạy lệnh cài đặt:
```bash
npm install
```

### 3. Thiết lập biến môi trường
Tạo file `.env.local` ở thư mục gốc của dự án và điền các thông tin kết nối Supabase của bạn:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Thiết lập Cơ sở dữ liệu (Supabase SQL)
Truy cập vào Supabase Dashboard, mở mục **SQL Editor** và chạy toàn bộ mã nguồn SQL có trong file:
👉 [docs/database/migration.sql](file:///Users/nguyenminhkhang/Documents/react/group-scheduler/docs/database/migration.sql)

*Lưu ý: Script này sẽ tự động khởi tạo cấu trúc bảng, các hàm logic (Trigger Functions), chỉ mục hiệu năng (Indexes) và các chính sách bảo mật RLS cần thiết.*

---

## Chạy Dự Án

* Chạy dự án dưới môi trường phát triển (Local Development):
  ```bash
  npm run dev
  ```
  Ứng dụng sẽ chạy tại địa chỉ mặc định: `http://localhost:5173`.

* Kiểm tra và đóng gói sản phẩm (Production Build):
  ```bash
  npm run build
  ```

---

## Cấu Trúc Mã Nguồn

```text
├── docs/                 # Tài liệu thiết kế database, sơ đồ schema, câu lệnh sql
├── src/
│   ├── components/       # Các component UI dùng chung cho toàn bộ layout
│   │   └── layout/       # Shell điều hướng, sidebar và thanh bottom navigation
│   ├── features/         # Các chức năng chính (auth, groups, scheduler...)
│   │   ├── auth/         # Đăng nhập bằng Google
│   │   └── groups/       # Tạo nhóm, tham gia nhóm, thành viên ảo, API kết nối
│   ├── lib/              # Cấu hình Supabase client và các hàm tiện ích
│   ├── pages/            # Các trang chính (Home, Groups, Detail, Heatmap, Payments)
│   ├── store/            # Quản lý trạng thái toàn cục (Zustand) và Realtime Listener
│   ├── App.tsx           # Quản lý định tuyến (React Router Dom) và cấu hình chính
│   └── index.css         # Thiết kế hệ thống CSS Variable & Glassmorphism theme
```

---
*Chúc bạn có những trải nghiệm kết nối và sắp xếp thời gian tuyệt vời cùng **SyncTime**!*
