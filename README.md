# Student Delivery System API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

The API uses JWT (JSON Web Token) authentication with OTP (One-Time Password) verification.

### Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## Authentication Endpoints

### 1. Send OTP

Send OTP to user's email for login.

**POST** `/auth/send-otp`

**Body:**

```json
{
  "email": "user@example.com",
  "userType": "admin" | "driver"
}
```

**Response:**

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "email": "user@example.com",
    "userType": "admin",
    "expiresIn": 600
  }
}
```

### 2. Verify OTP & Login

Verify OTP and receive JWT token.

**POST** `/auth/verify-otp`

**Body:**

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "userType": "admin" | "driver"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe",
      "userType": "admin",
      "role": "super_admin",
      "permissions": ["create_delivery", "manage_drivers"]
    },
    "token": "jwt_token_here",
    "expiresIn": "24h"
  }
}
```

### 3. Logout

**POST** `/auth/logout`

**Headers:** `Authorization: Bearer <token>`

### 4. Refresh Token

**POST** `/auth/refresh-token`

**Headers:** `Authorization: Bearer <token>`

## Admin Endpoints

All admin endpoints require `Authorization: Bearer <admin_token>`

### Dashboard

#### Get Dashboard Overview

**GET** `/admin/dashboard?period=month`

**Query Parameters:**

- `period`: `today` | `week` | `month` | `year`

**Response:**

```json
{
  "success": true,
  "data": {
    "analytics": {
      "overview": {
        "totalDrivers": 15,
        "activeDrivers": 12,
        "totalDeliveries": 234,
        "completedDeliveries": 198,
        "completionRate": 84.6
      },
      "revenue": {
        "totalRevenue": 35100,
        "totalDriverEarnings": 23400,
        "totalCompanyEarnings": 11700
      }
    },
    "recentDeliveries": [...],
    "activeDriversToday": 8
  }
}
```

### Driver Management

#### Get All Drivers

**GET** `/admin/drivers?page=1&limit=20&area=Gonyeli&isActive=true`

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `area`: Filter by area
- `isActive`: Filter by active status
- `sortBy`: `name` | `totalDeliveries` | `totalEarnings` | `joinedAt`
- `sortOrder`: `asc` | `desc`

#### Add New Driver

**POST** `/admin/drivers`

**Body:**

```json
{
  "email": "driver@example.com",
  "name": "Jane Smith",
  "phone": "+905551234567",
  "studentId": "STU123456",
  "area": "Gonyeli"
}
```

#### Update Driver

**PUT** `/admin/drivers/:id`

**Body:**

```json
{
  "name": "Updated Name",
  "phone": "+905557654321",
  "area": "Kucuk",
  "isActive": true
}
```

#### Delete Driver

**DELETE** `/admin/drivers/:id`

#### Get Driver Analytics

**GET** `/admin/drivers/:driverId/analytics?period=month&month=11&year=2025`

### Delivery Management

#### Get All Deliveries

**GET** `/admin/deliveries?page=1&limit=20&status=delivered&area=Gonyeli`

**Query Parameters:**

- `status`: `pending` | `assigned` | `picked_up` | `delivered` | `cancelled`
- `assignedTo`: Driver ID
- `startDate`: ISO date string
- `endDate`: ISO date string
- `area`: Driver's area
- `priority`: `low` | `normal` | `high` | `urgent`
- `paymentMethod`: `cash` | `card` | `transfer`

#### Create New Delivery

**POST** `/admin/deliveries`

**Body:**

```json
{
  "pickupLocation": "Main Campus Gate",
  "deliveryLocation": "Student Dormitory Block A",
  "customerName": "Ali Veli",
  "customerPhone": "+905551234567",
  "fee": 150,
  "paymentMethod": "cash",
  "estimatedTime": "2025-07-30T14:00:00Z",
  "notes": "Handle with care",
  "priority": "normal",
  "assignedTo": "driver_id_optional"
}
```

#### Assign Delivery to Driver

**POST** `/admin/deliveries/:id/assign`

**Body:**

```json
{
  "driverId": "driver_id_here",
  "notes": "Urgent delivery"
}
```

#### Bulk Operations

**POST** `/admin/deliveries/bulk`

**Body:**

```json
{
  "operation": "assign" | "cancel" | "delete" | "updatePriority",
  "ids": ["delivery_id_1", "delivery_id_2"],
  "data": {
    "driverId": "driver_id_for_assign",
    "priority": "high_for_priority_update"
  }
}
```

## Driver Endpoints

All driver endpoints require `Authorization: Bearer <driver_token>`

### Profile & Status

#### Get Profile

**GET** `/driver/profile`

#### Update Profile

**PUT** `/driver/profile`

**Body:**

```json
{
  "name": "Updated Name",
  "phone": "+905559876543"
}
```

#### Toggle Online Status

**POST** `/driver/toggle-online`

### Analytics & Earnings

#### Get Personal Analytics

**GET** `/driver/analytics?period=month&month=11&year=2025`

**Response:**

```json
{
  "success": true,
  "data": {
    "period": "month",
    "stats": {
      "totalDeliveries": 45,
      "totalEarnings": 4500,
      "averagePerDay": 1.5,
      "averageEarningsPerDay": 150,
      "completionRate": 95.6,
      "averageEarningsPerDelivery": 100
    },
    "dailyStats": [
      {
        "date": "2025-11-01",
        "deliveries": 3,
        "earnings": 300
      }
    ],
    "remissionOwed": {
      "totalDeliveries": 45,
      "amountPerDelivery": 50,
      "totalOwed": 2250
    }
  }
}
```

#### Get Earnings Breakdown

**GET** `/driver/earnings?period=month`

### Deliveries

#### Get My Deliveries

**GET** `/driver/deliveries?page=1&limit=20&status=delivered`

#### Get Nearby Deliveries

**GET** `/driver/deliveries/nearby?limit=10`

#### Update Delivery Status

**PUT** `/driver/deliveries/:deliveryId/status`

**Body:**

```json
{
  "status": "picked_up" | "delivered" | "cancelled",
  "notes": "Delivery completed successfully",
  "deliveryProof": "https://example.com/proof.jpg",
  "rating": 5,
  "feedback": "Great customer service"
}
```

## Public Endpoints

### Track Delivery

**GET** `/delivery/track/:deliveryCode`

**Example:** `/delivery/track/%23001`

**Response:**

```json
{
  "success": true,
  "data": {
    "deliveryCode": "GRP-123456",
    "status": "delivered",
    "pickupLocation": "Main Campus",
    "deliveryLocation": "Dormitory Block A",
    "estimatedTime": "2025-07-30T14:00:00Z",
    "createdAt": "2025-07-30T10:00:00Z",
    "deliveredAt": "2025-07-30T13:45:00Z",
    "driver": {
      "name": "John Driver",
      "area": "Gonyeli"
    }
  }
}
```

### Public Statistics

**GET** `/delivery/public/stats`

## Error Responses

### Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Please enter a valid email address"
    }
  ]
}
```

### Authentication Error

```json
{
  "success": false,
  "error": "Access token required"
}
```

### Permission Error

```json
{
  "success": false,
  "error": "Permission required: manage_drivers"
}
```

### Rate Limit Error

```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": 3600
}
```

## Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Data Models

### User Roles & Permissions

#### Admin Permissions

- `create_delivery` - Create new deliveries
- `edit_delivery` - Update delivery details
- `delete_delivery` - Delete deliveries
- `manage_drivers` - Add, update, remove drivers
- `view_analytics` - Access analytics and reports

#### User Types

- `admin` - Regular administrator
- `super_admin` - Full system access
- `driver` - Delivery driver

### Delivery Status Flow

```
pending → assigned → picked_up → delivered
    ↓         ↓          ↓
cancelled  cancelled  cancelled
```

### Areas

- Gonyeli
- Kucuk
- Lefkosa
- Famagusta
- Kyrenia
- Other

## Rate Limits

- General API: 100 requests per hour per IP
- OTP requests: 3 requests per 5 minutes per email
- Authenticated users: 1000 requests per hour per user

## Environment Setup

### Required Environment Variables

```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=<Ask me>
JWT_SECRET=<Ask me>
JWT_EXPIRES_IN=24h
ZEPTO_MAIL_USER=<Ask me>
ZEPTO_MAIL_PASSWORD=<Ask me>
EMAIL_FROM_NAME=Student Delivery System
# Note: All emails will be sent from noreply@greep.io
FRONTEND_URL=http://localhost:3000
MAX_REQUESTS_PER_HOUR=100
OTP_EXPIRY_MINUTES=10
```

### Installation & Running

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Business Logic Notes

### Revenue Split

- Default delivery fee: 150₺
- Driver earnings: 100₺ (67%)
- Company earnings: 50₺ (33%)
- Remission owed by driver: 50₺ per delivery

### OTP System

- 6-digit numeric OTP
- 10-minute expiration
- Maximum 3 attempts per OTP
- Rate limited: 3 requests per 5 minutes per email

### Driver Areas

Drivers are assigned to specific areas for optimized delivery routing:

- Gonyeli, Kucuk, Lefkosa, Famagusta, Kyrenia, Other

This API provides a complete backend solution for your student delivery system with authentication, role-based access control, comprehensive analytics.
