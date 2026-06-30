# Hướng dẫn Build IPA — ANC-CFAM (TrollStore)

> Cần thực hiện trên **máy Mac** có cài **Xcode 15+**

---

## BƯỚC 1 — Chuẩn bị môi trường (Mac)

```bash
# Cài Xcode từ App Store (nếu chưa có)
xcode-select --install

# Cài CocoaPods (Capacitor iOS cần)
sudo gem install cocoapods
```

---

## BƯỚC 2 — Đưa project lên Mac

Copy thư mục `anc-cfam` lên Mac (USB, AirDrop, GitHub...) rồi mở Terminal:

```bash
cd /path/to/anc-cfam

# Cài dependencies
npm install

# Build web app + sync sang iOS
npm run build:ios
# tương đương: vite build && npx cap sync ios
```

Lần đầu chạy `cap sync ios` sẽ tự tạo thư mục `ios/` với project Xcode.

---

## BƯỚC 3 — Add iOS platform (chỉ lần đầu)

```bash
npx cap add ios
npx cap sync ios
```

---

## BƯỚC 4 — Mở Xcode

```bash
npm run open:ios
# hoặc: npx cap open ios
```

Xcode tự mở file `ios/App/App.xcworkspace` (dùng `.xcworkspace` không phải `.xcodeproj`).

---

## BƯỚC 5 — Cấu hình trong Xcode

### 5.1 Bundle Identifier
- Click vào **App** ở sidebar trái
- Tab **Signing & Capabilities**
- **Bundle Identifier**: `com.anc.cfam`
- **Team**: Chọn **None** (không cần Apple Developer Account cho TrollStore)
- Tắt checkbox **Automatically manage signing**

### 5.2 Deployment Target
- Tab **General** → **Minimum Deployments**: iOS 15.0+

### 5.3 Build Settings quan trọng
- `CODE_SIGN_IDENTITY` = `-` (dash, tức là unsigned)
- `CODE_SIGNING_REQUIRED` = `No`
- `CODE_SIGNING_ALLOWED` = `No`

> ⚠️ Với TrollStore: App không cần ký bằng Developer cert. TrollStore tự ký lại bằng `ldid`.

---

## BƯỚC 6 — Build file .app

Trong Xcode:
1. Menu **Product** → **Scheme** → chọn **App**
2. Menu **Product** → **Destination** → **Any iOS Device (arm64)**
3. Menu **Product** → **Build** (`Cmd+B`)

Sau khi build xong, tìm file `.app`:
```bash
# Thường nằm ở:
~/Library/Developer/Xcode/DerivedData/App-xxxx/Build/Products/Debug-iphoneos/App.app

# Tìm nhanh:
find ~/Library/Developer/Xcode/DerivedData -name "*.app" -type d 2>/dev/null | grep iphoneos
```

---

## BƯỚC 7 — Đóng gói thành file .ipa

```bash
# Tạo thư mục Payload
mkdir -p Payload

# Copy .app vào Payload (thay đường dẫn thực tế)
cp -r /path/to/App.app Payload/

# Nén thành .zip rồi đổi đuôi .ipa
zip -r ANC-CFAM.ipa Payload/

# Xoá thư mục tạm
rm -rf Payload/
```

File `ANC-CFAM.ipa` là file cài được qua TrollStore.

---

## BƯỚC 8 — Cài lên iPhone qua TrollStore

**Cách 1 — AirDrop:**
- AirDrop file `ANC-CFAM.ipa` sang iPhone
- Mở TrollStore → tap vào file IPA → Install

**Cách 2 — Files app:**
- Copy IPA vào iCloud Drive / Files
- Mở TrollStore → dấu `+` → chọn file IPA

---

## BƯỚC 9 — Cấu hình Supabase cho Native App

Trong **Supabase Dashboard** → **Authentication** → **URL Configuration**:

```
Redirect URLs — thêm vào:
  capacitor://localhost
  http://localhost
  ionic://localhost
```

Nếu bro dùng Supabase Auth (đăng nhập), cần thêm mấy URL này để OAuth callback hoạt động.

---

## Xử lý lỗi thường gặp

| Lỗi | Giải pháp |
|-----|-----------|
| `CORS error` với Supabase | Kiểm tra `allowsArbitraryLoads: true` trong capacitor.config.json |
| Trắng màn hình sau cài | Xoá `server.url` khỏi config nếu còn dùng localhost |
| Bàn phím che mất input | Capacitor xử lý tự động — nếu không OK, bật `KeyboardResize: body` |
| TrollStore báo "Invalid IPA" | Kiểm tra cấu trúc: `Payload/App.app/Info.plist` phải tồn tại |
| Font quá nhỏ iOS tự zoom | ✅ Đã fix: `viewport-fit=cover`, `initial-scale=1.0` |
| Dynamic Island che header | ✅ Đã fix: `padding-top: env(safe-area-inset-top)` trên Topbar |

---

## Quick Command Summary

```bash
# Mỗi lần sửa code, chạy để sync lại iOS:
npm run build:ios

# Mở Xcode:
npm run open:ios
```
