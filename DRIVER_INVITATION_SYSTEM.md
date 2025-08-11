# 🚀 OTP-Based Driver Invitation System

## 📋 **Overview**

The Driver Invitation System is a secure, OTP-based invitation workflow that allows admins to invite new drivers to join the Greep SDS platform. Instead of creating driver accounts directly, admins send invitations via email, and drivers activate their accounts through a secure token-based process.

## 🔧 **System Architecture**

### **Components:**

1. **DriverInvitation Model** - Database schema for invitations
2. **DriverInvitationService** - Business logic for invitation management
3. **Admin Controller** - API endpoints for admin operations
4. **Driver Controller** - API endpoints for driver activation
5. **Email Service** - Professional email templates
6. **Routes** - API routing for all invitation operations

## 📊 **Database Schema**

### **DriverInvitation Collection:**

```javascript
{
  _id: ObjectId,
  email: String,                    // Driver's email address
  name: String,                     // Driver's name
  invitationToken: String,          // Unique 64-character token
  status: String,                   // 'pending', 'activated', 'expired'
  invitedBy: ObjectId,              // Admin who sent invitation
  invitedAt: Date,                  // When invitation was sent
  expiresAt: Date,                  // Expiration date (7 days)
  activatedAt: Date,                // When account was activated
  activationAttempts: Number,       // Failed activation attempts
  lastActivationAttempt: Date,      // Last activation attempt
  createdAt: Date,
  updatedAt: Date
}
```

## 🔌 **API Endpoints**

### **Admin Endpoints (Require Authentication)**

#### **1. Invite New Driver**

```http
POST /api/admin/drivers/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Driver Name",
  "email": "driver@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Driver invitation sent successfully",
  "data": {
    "invitationId": "6899be66e6142d85f6c5a9cf",
    "email": "driver@example.com",
    "status": "pending",
    "expiresAt": "2025-08-18T09:56:54.613Z"
  }
}
```

#### **2. Get Pending Invitations**

```http
GET /api/admin/drivers/invitations?page=1&limit=20
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Pending invitations retrieved successfully",
  "data": {
    "invitations": [
      {
        "_id": "6899be66e6142d85f6c5a9cf",
        "email": "driver@example.com",
        "name": "Driver Name",
        "status": "pending",
        "invitedBy": {
          "_id": "688973b69cd2d8234f26bd39",
          "email": "admin@greep.io",
          "name": "Super Admin"
        },
        "expiresAt": "2025-08-18T09:56:54.613Z",
        "invitedAt": "2025-08-11T09:56:54.624Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### **3. Cancel Invitation**

```http
POST /api/admin/drivers/invitations/:invitationId/cancel
Authorization: Bearer <token>
```

#### **4. Resend Invitation**

```http
POST /api/admin/drivers/invitations/:invitationId/resend
Authorization: Bearer <token>
```

### **Driver Endpoints (No Authentication Required)**

#### **1. Validate Invitation Token**

```http
GET /api/driver/activate/:token
```

**Response:**

```json
{
  "success": true,
  "message": "Invitation is valid",
  "data": {
    "invitation": {
      "email": "driver@example.com",
      "name": "Driver Name",
      "expiresAt": "2025-08-18T09:56:54.613Z"
    }
  }
}
```

#### **2. Activate Driver Account**

```http
POST /api/driver/activate/:token
Content-Type: application/json

{
  "password": "securepassword123",
  "phone": "+905551234567",
  "studentId": "20223056",
  "university": "Eastern Mediterranean University (EMU)",
  "area": "Famagusta",
  "address": "Student Address"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Driver account activated successfully",
  "data": {
    "driver": {
      "id": "6899be66e6142d85f6c5a9d0",
      "name": "Driver Name",
      "email": "driver@example.com",
      "area": "Famagusta"
    }
  }
}
```

## 📧 **Email Templates**

### **1. Driver Invitation Email**

- **Subject:** "Welcome to Greep SDS - Complete Your Driver Account Setup"
- **Content:** Professional HTML email with activation link
- **Features:**
  - Greep SDS branding
  - Step-by-step activation instructions
  - Support contact information
  - Expiration date warning
  - Mobile-responsive design

### **2. Welcome Email**

- **Subject:** "Welcome to Greep SDS - Your Account is Ready!"
- **Content:** Confirmation email after successful activation
- **Features:**
  - Account activation confirmation
  - Next steps for drivers
  - Login link
  - Support information

## 🔐 **Security Features**

### **1. Token Security**

- **64-character hexadecimal tokens** generated using crypto.randomBytes()
- **Unique tokens** with database constraints
- **Time-limited validity** (7 days expiration)
- **One-time use** tokens (marked as activated after use)

### **2. Access Control**

- **Admin-only invitation creation** (requires `manage_drivers` permission)
- **Role-based authorization** (super admin can manage all invitations)
- **Invitation ownership** (only sender or super admin can cancel/resend)

### **3. Validation**

- **Email uniqueness** (prevents duplicate invitations)
- **Token validation** (checks existence, status, and expiration)
- **Password strength** (minimum 6 characters)
- **Required fields** validation for account activation

## 🔄 **Workflow Process**

### **1. Admin Invites Driver**

```
Admin → POST /api/admin/drivers/invite
↓
System creates invitation record
↓
System generates unique token
↓
System sends invitation email
↓
Invitation status: "pending"
```

### **2. Driver Receives Email**

```
Driver receives email with activation link
↓
Link format: /driver/activate/:token
↓
Driver clicks link to validate token
↓
System validates token and shows activation form
```

### **3. Driver Activates Account**

```
Driver fills activation form
↓
POST /api/driver/activate/:token
↓
System validates all required fields
↓
System creates driver account
↓
System marks invitation as "activated"
↓
System sends welcome email
↓
Driver can now log in and start working
```

## 🛠 **Error Handling**

### **Common Error Scenarios:**

#### **1. Invalid Token**

```json
{
  "success": false,
  "error": "Invalid invitation token"
}
```

#### **2. Expired Invitation**

```json
{
  "success": false,
  "error": "Invitation has expired"
}
```

#### **3. Already Used Token**

```json
{
  "success": false,
  "error": "Invitation has already been used or expired"
}
```

#### **4. Duplicate Email**

```json
{
  "success": false,
  "error": "Driver with this email already exists"
}
```

#### **5. Missing Required Fields**

```json
{
  "success": false,
  "error": "All fields are required for account activation"
}
```

## 📈 **Monitoring & Maintenance**

### **1. Cleanup Jobs**

- **Automatic expiration** of old invitations
- **Database cleanup** of expired records
- **Email failure handling** (doesn't break invitation creation)

### **2. Analytics**

- **Invitation tracking** (sent, activated, expired)
- **Activation attempt monitoring**
- **Email delivery statistics**

### **3. Admin Dashboard Features**

- **Pending invitations list**
- **Invitation status overview**
- **Cancel/resend functionality**
- **Expiration date management**

## 🎯 **Frontend Integration**

### **Admin Dashboard:**

```javascript
// Invite new driver
const inviteDriver = async (name, email) => {
  const response = await fetch("/api/admin/drivers/invite", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email }),
  });
  return response.json();
};

// Get pending invitations
const getPendingInvitations = async () => {
  const response = await fetch("/api/admin/drivers/invitations", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};
```

### **Driver Activation Page:**

```javascript
// Validate invitation token
const validateInvitation = async (token) => {
  const response = await fetch(`/api/driver/activate/${token}`);
  return response.json();
};

// Activate account
const activateAccount = async (token, driverData) => {
  const response = await fetch(`/api/driver/activate/${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(driverData),
  });
  return response.json();
};
```

## ✅ **Testing**

### **Test Cases:**

1. ✅ **Create invitation** - Admin can invite new driver
2. ✅ **Validate token** - Token validation works correctly
3. ✅ **Activate account** - Driver can activate account with valid data
4. ✅ **Error handling** - Proper error messages for invalid scenarios
5. ✅ **Email templates** - Professional email formatting
6. ✅ **Security** - Token uniqueness and expiration
7. ✅ **Authorization** - Proper permission checks

## 🚀 **Deployment Notes**

### **Environment Variables:**

```bash
FRONTEND_URL=http://localhost:3000  # For activation links
EMAIL_SERVICE_CONFIG=...            # Email service configuration
```

### **Database Indexes:**

- `email` + `status` for efficient queries
- `invitationToken` for fast token lookups
- `expiresAt` for cleanup operations

### **Cron Jobs:**

```javascript
// Daily cleanup of expired invitations
0 2 * * * node cleanup-expired-invitations.js
```

---

**Status:** ✅ **Complete and Tested**  
**Last Updated:** August 11, 2025  
**Version:** 1.0.0
