# 📋 Complete API Endpoints List

## 🔗 Base URL: `http://localhost:3001`

---

## 🔐 **Authentication Endpoints** (`/api/auth`)

| Method | Endpoint                     | Description                       | Auth Required |
| ------ | ---------------------------- | --------------------------------- | ------------- |
| `POST` | `/api/auth/send-otp`         | Send OTP for authentication       | ❌            |
| `POST` | `/api/auth/verify-otp`       | Verify OTP and login              | ❌            |
| `POST` | `/api/auth/resend-otp`       | Resend OTP                        | ❌            |
| `GET`  | `/api/auth/can-request-otp`  | Check if can request OTP          | ❌            |
| `POST` | `/api/auth/logout`           | Logout user                       | ✅            |
| `POST` | `/api/auth/refresh-token`    | Refresh access token              | ✅            |
| `GET`  | `/api/auth/profile`          | Get authenticated user profile    | ✅            |
| `PUT`  | `/api/auth/profile`          | Update authenticated user profile | ✅            |
| `POST` | `/api/auth/change-password`  | Change user password              | ✅            |
| `GET`  | `/api/auth/validate-session` | Validate current session          | ✅            |
| `GET`  | `/api/auth/stats`            | Get authentication stats          | ✅            |
| `POST` | `/api/auth/cleanup-otps`     | Cleanup expired OTPs              | ✅            |

---

## 🚗 **Driver Endpoints** (`/api/driver`)

### **Profile & Dashboard**

| Method | Endpoint                                     | Description                                     | Auth Required |
| ------ | -------------------------------------------- | ----------------------------------------------- | ------------- |
| `GET`  | `/api/driver/dashboard?period=today`         | Driver dashboard (today)                        | ✅            |
| `GET`  | `/api/driver/dashboard?period=thisWeek`      | Driver dashboard (this week)                    | ✅            |
| `GET`  | `/api/driver/dashboard?period=currentPeriod` | Driver dashboard (current period)               | ✅            |
| `GET`  | `/api/driver/dashboard?period=allTime`       | Driver dashboard (all time)                     | ✅            |
| `GET`  | `/api/driver/profile`                        | Get driver profile                              | ✅            |
| `PUT`  | `/api/driver/profile`                        | Update driver profile                           | ✅            |
| `POST` | `/api/driver/profile/debug`                  | Debug profile requests                          | ✅            |
| `GET`  | `/api/driver/profile-options`                | Get profile options (universities, areas, etc.) | ❌            |

### **Status & Activity**

| Method | Endpoint                    | Description               | Auth Required |
| ------ | --------------------------- | ------------------------- | ------------- |
| `POST` | `/api/driver/toggle-online` | Toggle online status      | ✅            |
| `POST` | `/api/driver/toggle-active` | Toggle active status      | ✅            |
| `GET`  | `/api/driver/status`        | Get driver status         | ✅            |
| `PUT`  | `/api/driver/deactivate`    | Deactivate driver account | ✅            |

### **Analytics & Performance**

| Method | Endpoint                                | Description                  | Auth Required |
| ------ | --------------------------------------- | ---------------------------- | ------------- |
| `GET`  | `/api/driver/analytics?period=today`    | Driver analytics (today)     | ✅            |
| `GET`  | `/api/driver/analytics?period=thisWeek` | Driver analytics (this week) | ✅            |
| `GET`  | `/api/driver/analytics?period=month`    | Driver analytics (month)     | ✅            |
| `GET`  | `/api/driver/earnings?period=monthly`   | Driver earnings data         | ✅            |
| `GET`  | `/api/driver/performance`               | Driver performance metrics   | ✅            |
| `GET`  | `/api/driver/leaderboard`               | Driver leaderboard           | ✅            |

### **Deliveries**

| Method | Endpoint                                    | Description            | Auth Required |
| ------ | ------------------------------------------- | ---------------------- | ------------- |
| `GET`  | `/api/driver/deliveries?limit=10`           | Get driver deliveries  | ✅            |
| `GET`  | `/api/driver/deliveries/nearby`             | Get nearby deliveries  | ✅            |
| `GET`  | `/api/driver/deliveries/:deliveryId`        | Get specific delivery  | ✅            |
| `PUT`  | `/api/driver/deliveries/:deliveryId/status` | Update delivery status | ✅            |

### **Documents & Images**

| Method | Endpoint                                     | Description                        | Auth Required |
| ------ | -------------------------------------------- | ---------------------------------- | ------------- |
| `POST` | `/api/driver/documents/:documentType/upload` | Upload document                    | ✅            |
| `POST` | `/api/driver/profile/picture`                | Upload profile picture             | ✅            |
| `POST` | `/api/driver/profile/image`                  | Upload profile image (alternative) | ✅            |

### **Notifications**

| Method | Endpoint                                         | Description                    | Auth Required |
| ------ | ------------------------------------------------ | ------------------------------ | ------------- |
| `GET`  | `/api/driver/notifications`                      | Get driver notifications       | ✅            |
| `GET`  | `/api/driver/notifications/unread-count`         | Get unread notification count  | ✅            |
| `PUT`  | `/api/driver/notifications/:notificationId/read` | Mark notification as read      | ✅            |
| `PUT`  | `/api/driver/notifications/mark-all-read`        | Mark all notifications as read | ✅            |

---

## 👨‍💼 **Admin Endpoints** (`/api/admin`)

### **Dashboard & Analytics**

| Method | Endpoint                 | Description        | Auth Required |
| ------ | ------------------------ | ------------------ | ------------- |
| `GET`  | `/api/admin/dashboard`   | Admin dashboard    | ✅ Admin      |
| `GET`  | `/api/admin/stats`       | System statistics  | ✅ Admin      |
| `GET`  | `/api/admin/analytics`   | Detailed analytics | ✅ Admin      |
| `GET`  | `/api/admin/export`      | Export data        | ✅ Admin      |
| `GET`  | `/api/admin/leaderboard` | Driver leaderboard | ✅ Admin      |

### **Admin Management**

| Method   | Endpoint                | Description              | Auth Required  |
| -------- | ----------------------- | ------------------------ | -------------- |
| `GET`    | `/api/admin/admins`     | Get all admins           | ✅ Super Admin |
| `POST`   | `/api/admin/admins`     | Create new admin         | ✅ Super Admin |
| `PUT`    | `/api/admin/admins/:id` | Update admin             | ✅ Super Admin |
| `DELETE` | `/api/admin/admins/:id` | Delete admin             | ✅ Super Admin |
| `POST`   | `/api/admin/test-email` | Test email functionality | ✅ Super Admin |

### **Driver Management**

| Method   | Endpoint                                               | Description                | Auth Required |
| -------- | ------------------------------------------------------ | -------------------------- | ------------- |
| `GET`    | `/api/admin/drivers`                                   | Get all drivers            | ✅ Admin      |
| `GET`    | `/api/admin/drivers/:id`                               | Get specific driver        | ✅ Admin      |
| `POST`   | `/api/admin/drivers`                                   | Create new driver          | ✅ Admin      |
| `PUT`    | `/api/admin/drivers/:id`                               | Update driver              | ✅ Admin      |
| `DELETE` | `/api/admin/drivers/:id`                               | Delete driver              | ✅ Admin      |
| `POST`   | `/api/admin/drivers/:id/suspend`                       | Suspend driver             | ✅ Admin      |
| `POST`   | `/api/admin/drivers/:id/unsuspend`                     | Unsuspend driver           | ✅ Admin      |
| `PUT`    | `/api/admin/drivers/:id/verification`                  | Update driver verification | ✅ Admin      |
| `GET`    | `/api/admin/drivers/:driverId/status`                  | Get driver status          | ✅ Admin      |
| `PUT`    | `/api/admin/drivers/:driverId/documents/:documentType` | Update driver document     | ✅ Admin      |
| `POST`   | `/api/admin/drivers/bulk`                              | Bulk driver operations     | ✅ Admin      |
| `GET`    | `/api/admin/drivers/area/:area`                        | Get drivers by area        | ✅ Admin      |

### **Driver Analytics (Admin)**

| Method | Endpoint                                   | Description        | Auth Required |
| ------ | ------------------------------------------ | ------------------ | ------------- |
| `GET`  | `/api/admin/drivers/:driverId/analytics`   | Driver analytics   | ✅ Admin      |
| `GET`  | `/api/admin/drivers/:driverId/earnings`    | Driver earnings    | ✅ Admin      |
| `GET`  | `/api/admin/drivers/:driverId/deliveries`  | Driver deliveries  | ✅ Admin      |
| `GET`  | `/api/admin/drivers/:driverId/performance` | Driver performance | ✅ Admin      |
| `POST` | `/api/admin/drivers/:driverId/send-report` | Send driver report | ✅ Admin      |

### **Delivery Management**

| Method   | Endpoint                             | Description              | Auth Required |
| -------- | ------------------------------------ | ------------------------ | ------------- |
| `GET`    | `/api/admin/deliveries`              | Get all deliveries       | ✅ Admin      |
| `GET`    | `/api/admin/deliveries/stats`        | Delivery statistics      | ✅ Admin      |
| `GET`    | `/api/admin/deliveries/:id`          | Get specific delivery    | ✅ Admin      |
| `POST`   | `/api/admin/deliveries`              | Create new delivery      | ✅ Admin      |
| `PUT`    | `/api/admin/deliveries/:id`          | Update delivery          | ✅ Admin      |
| `DELETE` | `/api/admin/deliveries/:id`          | Delete delivery          | ✅ Admin      |
| `POST`   | `/api/admin/deliveries/:id/assign`   | Assign delivery          | ✅ Admin      |
| `POST`   | `/api/admin/deliveries/:id/unassign` | Unassign delivery        | ✅ Admin      |
| `POST`   | `/api/admin/deliveries/bulk`         | Bulk delivery operations | ✅ Admin      |

### **Notifications (Admin)**

| Method   | Endpoint                                        | Description                  | Auth Required |
| -------- | ----------------------------------------------- | ---------------------------- | ------------- |
| `GET`    | `/api/admin/notifications`                      | Get notifications            | ✅ Admin      |
| `GET`    | `/api/admin/notifications/unread-count`         | Get unread count             | ✅ Admin      |
| `PUT`    | `/api/admin/notifications/:notificationId/read` | Mark as read                 | ✅ Admin      |
| `PUT`    | `/api/admin/notifications/mark-all-read`        | Mark all as read             | ✅ Admin      |
| `DELETE` | `/api/admin/notifications/:notificationId`      | Delete notification          | ✅ Admin      |
| `POST`   | `/api/admin/notifications/system`               | Create system notification   | ✅ Admin      |
| `GET`    | `/api/admin/notifications/stats`                | Notification statistics      | ✅ Admin      |
| `POST`   | `/api/admin/notifications/bulk`                 | Bulk notification operations | ✅ Admin      |

### **Admin Notifications**

| Method   | Endpoint                                              | Description                          | Auth Required |
| -------- | ----------------------------------------------------- | ------------------------------------ | ------------- |
| `GET`    | `/api/admin/admin-notifications`                      | Get admin notifications              | ✅ Admin      |
| `GET`    | `/api/admin/admin-notifications/stats`                | Admin notification stats             | ✅ Admin      |
| `PUT`    | `/api/admin/admin-notifications/:notificationId/read` | Mark admin notification as read      | ✅ Admin      |
| `PUT`    | `/api/admin/admin-notifications/mark-all-read`        | Mark all admin notifications as read | ✅ Admin      |
| `DELETE` | `/api/admin/admin-notifications/:notificationId`      | Delete admin notification            | ✅ Admin      |

### **System Maintenance**

| Method | Endpoint                              | Description                   | Auth Required  |
| ------ | ------------------------------------- | ----------------------------- | -------------- |
| `GET`  | `/api/admin/activity-logs`            | Get activity logs             | ✅ Super Admin |
| `POST` | `/api/admin/maintenance`              | System maintenance            | ✅ Super Admin |
| `POST` | `/api/admin/recalculate-driver-stats` | Recalculate driver statistics | ✅ Super Admin |

---

## 📦 **Delivery Endpoints** (`/api/delivery`)

| Method | Endpoint                            | Description                | Auth Required |
| ------ | ----------------------------------- | -------------------------- | ------------- |
| `GET`  | `/api/delivery/track/:deliveryCode` | Track delivery by code     | ❌            |
| `GET`  | `/api/delivery/public/stats`        | Public delivery statistics | ❌            |
| `GET`  | `/api/delivery/:id`                 | Get specific delivery      | ✅            |
| `GET`  | `/api/delivery/`                    | Get deliveries             | ✅            |
| `POST` | `/api/delivery/test-notification`   | Test notification system   | ✅            |

---

## 📢 **Notifications Endpoints** (`/api/notifications`)

| Method   | Endpoint                                  | Description                    | Auth Required |
| -------- | ----------------------------------------- | ------------------------------ | ------------- |
| `GET`    | `/api/notifications/`                     | Get notifications              | ✅            |
| `GET`    | `/api/notifications/unread-count`         | Get unread notification count  | ✅            |
| `PUT`    | `/api/notifications/:notificationId/read` | Mark notification as read      | ✅            |
| `PUT`    | `/api/notifications/mark-all-read`        | Mark all notifications as read | ✅            |
| `DELETE` | `/api/notifications/:notificationId`      | Delete notification            | ✅ Admin      |
| `POST`   | `/api/notifications/system`               | Create system notification     | ✅ Admin      |
| `GET`    | `/api/notifications/stats`                | Notification statistics        | ✅ Admin      |

---

## 💰 **Earnings Config Endpoints** (`/api/earnings-config`)

| Method   | Endpoint                                | Description                       | Auth Required |
| -------- | --------------------------------------- | --------------------------------- | ------------- |
| `GET`    | `/api/earnings-config/active`           | Get active earnings configuration | ✅            |
| `GET`    | `/api/earnings-config/`                 | Get all earnings configurations   | ✅ Admin      |
| `POST`   | `/api/earnings-config/`                 | Create earnings configuration     | ✅ Admin      |
| `PUT`    | `/api/earnings-config/:configId`        | Update earnings configuration     | ✅ Admin      |
| `DELETE` | `/api/earnings-config/:configId`        | Delete earnings configuration     | ✅ Admin      |
| `POST`   | `/api/earnings-config/test-calculation` | Test earnings calculation         | ✅ Admin      |
| `POST`   | `/api/earnings-config/bulk-update`      | Bulk update earnings              | ✅ Admin      |
| `GET`    | `/api/earnings-config/stats`            | Earnings statistics               | ✅ Admin      |

---

## ⭐ **Driver Rating Endpoints** (`/api/driver-rating`)

| Method | Endpoint                              | Description             | Auth Required |
| ------ | ------------------------------------- | ----------------------- | ------------- |
| `GET`  | `/api/driver-rating/driver/:driverId` | Calculate driver rating | ✅            |

---

## ⚙️ **System Settings Endpoints** (`/api/system-settings`)

| Method | Endpoint                               | Description                | Auth Required |
| ------ | -------------------------------------- | -------------------------- | ------------- |
| `GET`  | `/api/system-settings/admin`           | Get admin settings         | ✅ Admin      |
| `GET`  | `/api/system-settings/admin/:category` | Get category settings      | ✅ Admin      |
| `PUT`  | `/api/system-settings/admin`           | Update admin settings      | ✅ Admin      |
| `PUT`  | `/api/system-settings/admin/:category` | Update category settings   | ✅ Admin      |
| `POST` | `/api/system-settings/admin/reset`     | Reset settings to defaults | ✅ Admin      |
| `GET`  | `/api/system-settings/driver`          | Get driver settings        | ✅            |
| `GET`  | `/api/system-settings/public`          | Get public settings        | ❌            |

---

## 💳 **Remittance Endpoints** (`/api/remittance`)

| Method  | Endpoint                                   | Description                     | Auth Required |
| ------- | ------------------------------------------ | ------------------------------- | ------------- |
| `GET`   | `/api/remittance/`                         | Get all remittances             | ✅ Admin      |
| `GET`   | `/api/remittance/pending`                  | Get pending remittances         | ✅ Admin      |
| `GET`   | `/api/remittance/stats`                    | Get remittance statistics       | ✅ Admin      |
| `POST`  | `/api/remittance/calculate/:driverId`      | Calculate remittance for driver | ✅ Admin      |
| `GET`   | `/api/remittance/unsettled/:driverId`      | Get unsettled deliveries        | ✅ Admin      |
| `PATCH` | `/api/remittance/:remittanceId/complete`   | Complete remittance             | ✅ Admin      |
| `PATCH` | `/api/remittance/:remittanceId/cancel`     | Cancel remittance               | ✅ Admin      |
| `GET`   | `/api/remittance/driver/:driverId`         | Get driver remittances          | ✅            |
| `GET`   | `/api/remittance/driver/:driverId/summary` | Get driver remittance summary   | ✅            |
| `GET`   | `/api/remittance/payment-structure`        | Get payment structure           | ✅            |

---

## 🌍 **Public Endpoints** (`/api/public`)

| Method | Endpoint                          | Description            | Auth Required |
| ------ | --------------------------------- | ---------------------- | ------------- |
| `GET`  | `/api/public/track/:deliveryCode` | Track delivery by code | ❌            |
| `GET`  | `/api/public/user/:id/status`     | Get user status        | ❌            |
| `GET`  | `/api/public/user/:id/join-date`  | Get user join date     | ❌            |
| `GET`  | `/api/public/profile-options`     | Get profile options    | ❌            |

---

## 🏥 **System Health Endpoints**

| Method | Endpoint  | Description         | Auth Required |
| ------ | --------- | ------------------- | ------------- |
| `GET`  | `/health` | System health check | ❌            |
| `GET`  | `/`       | API information     | ❌            |

---

## 📊 **Summary by Category**

- **🔐 Authentication**: 12 endpoints
- **🚗 Driver**: 25 endpoints
- **👨‍💼 Admin**: 45+ endpoints
- **📦 Delivery**: 5 endpoints
- **📢 Notifications**: 7 endpoints
- **💰 Earnings Config**: 8 endpoints
- **⭐ Driver Rating**: 1 endpoint
- **⚙️ System Settings**: 7 endpoints
- **💳 Remittance**: 10 endpoints
- **🌍 Public**: 4 endpoints
- **🏥 System Health**: 2 endpoints

**🎯 Total: 126+ API endpoints**

---

## 🔑 **Authentication Types**

- ❌ **No Auth Required**: Public endpoints
- ✅ **User Auth**: Requires valid JWT token
- ✅ **Admin**: Requires admin privileges
- ✅ **Super Admin**: Requires super admin privileges

---

## 🎯 **Key Dashboard Endpoints You Requested**

✅ **Working Dashboard Endpoints:**

- `GET /api/driver/dashboard?period=today`
- `GET /api/driver/dashboard?period=thisWeek`
- `GET /api/driver/dashboard?period=currentPeriod`
- `GET /api/driver/dashboard?period=allTime`

All endpoints are now properly configured and ready for your frontend! 🚀
