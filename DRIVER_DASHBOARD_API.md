# Driver Dashboard API Documentation

## Overview

The Driver Dashboard API provides a comprehensive, single-endpoint solution for fetching all data needed for a driver's dashboard interface. This endpoint combines profile information, verification status, analytics, earnings, and delivery data into one optimized response.

## Endpoint

### Get Driver Dashboard

**GET** `/driver/dashboard`

**Authentication:** Required (Bearer token)

**Query Parameters:**

- `period` (optional): Analytics period - `today` | `week` | `month` | `year` | `all-time` | `custom`
  - Default: `month`
- `month` (optional): Specific month (1-12) when period is `month`
- `year` (optional): Specific year when period is `month`
- `startDate` (optional): Custom start date when period is `custom`
- `endDate` (optional): Custom end date when period is `custom`

## Response Structure

```json
{
  "success": true,
  "message": "Driver dashboard data retrieved successfully",
  "data": {
    "driver": {
      "id": "673b123456789abcdef12345",
      "name": "Test Driver",
      "email": "driver@example.com",
      "phone": "+905332154789",
      "area": "Famagusta",
      "university": "Eastern Mediterranean University (EMU)",
      "studentId": "20223056",
      "transportationType": "bicycle",
      "profilePicture": "https://res.cloudinary.com/...",
      "isOnline": true,
      "isActive": true,
      "lastLogin": "2025-01-21T10:30:00Z"
    },
    "accountStatus": {
      "verification": {
        "studentVerified": true,
        "profileComplete": true,
        "activeDeliveryPartner": true
      },
      "completion": {
        "overall": 85,
        "sections": {
          "personalDetails": { "completed": 3, "total": 4, "percentage": 75 },
          "studentInfo": { "completed": 2, "total": 2, "percentage": 100 },
          "transportation": { "completed": 2, "total": 2, "percentage": 100 },
          "verification": { "completed": 2, "total": 3, "percentage": 67 },
          "documents": { "completed": 4, "total": 5, "percentage": 80 }
        },
        "isComplete": false,
        "readyForDeliveries": true
      },
      "documents": {
        "studentId": {
          "status": "verified",
          "uploadDate": "2025-01-15T10:00:00Z"
        },
        "profilePhoto": {
          "status": "verified",
          "uploadDate": "2025-01-15T10:05:00Z"
        },
        "universityEnrollment": {
          "status": "verified",
          "uploadDate": "2025-01-15T10:10:00Z"
        },
        "identityCard": {
          "status": "pending",
          "uploadDate": "2025-01-20T14:00:00Z"
        },
        "transportationLicense": { "status": "pending", "required": false }
      }
    },
    "quickStats": {
      "today": {
        "deliveries": 3,
        "completed": 2,
        "earnings": 300,
        "pending": 0,
        "inProgress": 1
      },
      "thisWeek": {
        "deliveries": 12,
        "earnings": 1800,
        "averagePerDay": 1.7,
        "completionRate": 95.5
      },
      "currentPeriod": {
        "deliveries": 45,
        "earnings": 6750,
        "averagePerDay": 1.5,
        "completionRate": 93.3
      },
      "allTime": {
        "totalDeliveries": 127,
        "totalEarnings": 19050,
        "avgDeliveryTime": 32.5,
        "avgEarningsPerDelivery": 150
      }
    },
    "performance": {
      "rating": 4.8,
      "completionRate": 93.3,
      "totalDeliveries": 127,
      "totalEarnings": 19050,
      "averageEarningsPerDelivery": 150,
      "memberSince": "2024-09-15T08:00:00Z",
      "accountAge": 128,
      "isOnline": true,
      "isActive": true,
      "lastLogin": "2025-01-21T10:30:00Z"
    },
    "analytics": {
      "period": "month",
      "current": {
        "period": "month",
        "startDate": "2025-01-01T00:00:00Z",
        "endDate": "2025-01-31T23:59:59Z",
        "driver": {
          "id": "673b123456789abcdef12345",
          "name": "Test Driver",
          "email": "driver@example.com",
          "area": "Famagusta"
        },
        "stats": {
          "totalDeliveries": 45,
          "totalEarnings": 6750,
          "averagePerDay": 1.5,
          "averageEarningsPerDay": 225,
          "completionRate": 93.3,
          "averageEarningsPerDelivery": 150
        },
        "dailyStats": [
          {
            "date": "2025-01-01",
            "deliveries": 2,
            "earnings": 300,
            "averageEarnings": 150
          }
        ],
        "trends": {
          "deliveryTrend": "increasing",
          "earningsTrend": "stable",
          "efficiencyTrend": "improving"
        },
        "bestDay": {
          "date": "2025-01-15",
          "deliveries": 5,
          "earnings": 750
        },
        "remissionOwed": {
          "totalDeliveries": 45,
          "amountPerDelivery": 50,
          "totalOwed": 2250
        }
      },
      "today": {
        // Similar structure for today's analytics
      },
      "week": {
        // Similar structure for week's analytics
      }
    },
    "deliveries": {
      "recent": [
        {
          "_id": "673c123456789abcdef12345",
          "deliveryCode": "GRP-123456",
          "pickupLocation": "Main Campus Gate",
          "deliveryLocation": "Student Dormitory Block A",
          "status": "delivered",
          "fee": 150,
          "driverEarning": 150,
          "createdAt": "2025-01-21T09:00:00Z",
          "deliveredAt": "2025-01-21T09:45:00Z",
          "estimatedTime": "2025-01-21T09:30:00Z",
          "priority": "normal",
          "paymentMethod": "cash",
          "assignedBy": {
            "_id": "673a123456789abcdef12345",
            "name": "Admin User",
            "email": "admin@example.com"
          }
        }
      ],
      "available": [
        {
          "_id": "673d123456789abcdef12345",
          "deliveryCode": "GRP-123457",
          "pickupLocation": "Library",
          "deliveryLocation": "Cafeteria",
          "fee": 100,
          "estimatedTime": "2025-01-21T14:00:00Z",
          "priority": "normal",
          "createdAt": "2025-01-21T11:00:00Z",
          "distance": 0.8
        }
      ],
      "today": [
        {
          "_id": "673e123456789abcdef12345",
          "deliveryCode": "GRP-123458",
          "status": "assigned",
          "pickupLocation": "Student Center",
          "deliveryLocation": "Parking Lot B",
          "fee": 120,
          "driverEarning": 120,
          "priority": "high"
        }
      ]
    },
    "earnings": {
      "breakdown": [
        {
          "week": "2025-W03",
          "startDate": "2025-01-20T00:00:00Z",
          "endDate": "2025-01-26T23:59:59Z",
          "deliveries": 8,
          "earnings": 1200,
          "remissionOwed": 400,
          "netEarnings": 800
        }
      ],
      "summary": {
        "currentPeriod": 6750,
        "today": 300,
        "week": 1800,
        "allTime": 19050,
        "pending": 2250
      }
    },
    "trends": {
      "deliveryTrend": "increasing",
      "earningsTrend": "stable",
      "efficiencyTrend": "improving"
    },
    "lastUpdated": "2025-01-21T12:00:00Z"
  }
}
```

## Data Sections Explained

### 1. Driver Profile

Basic driver information including contact details, location, and account status.

### 2. Account Status

- **Verification**: Student verification, profile completion, and delivery eligibility
- **Completion**: Detailed breakdown of profile completion by section
- **Documents**: Status of all required documents

### 3. Quick Stats

Summarized statistics for different time periods:

- **Today**: Current day performance
- **This Week**: Weekly performance
- **Current Period**: Performance for selected period
- **All Time**: Lifetime statistics

### 4. Performance Metrics

Key performance indicators:

- Rating, completion rate, delivery count
- Earnings, efficiency metrics
- Account age and activity status

### 5. Analytics

Comprehensive analytics data including:

- Detailed statistics for different periods
- Daily breakdowns and trends
- Best performance days
- Remission calculations

### 6. Deliveries

- **Recent**: Last 10 deliveries (completed/in-progress)
- **Available**: Nearby pending deliveries for pickup
- **Today**: All deliveries assigned for today

### 7. Earnings

- **Breakdown**: Weekly/monthly earnings breakdown
- **Summary**: Quick earnings overview across periods

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Access token required"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Access denied - Driver access required"
}
```

### 404 Driver Not Found

```json
{
  "success": false,
  "error": "Driver not found"
}
```

### 500 Server Error

```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Usage Examples

### Get Current Month Dashboard

```bash
GET /driver/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Get Today's Dashboard

```bash
GET /driver/dashboard?period=today
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Get Custom Date Range

```bash
GET /driver/dashboard?period=custom&startDate=2025-01-01&endDate=2025-01-15
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Get Specific Month

```bash
GET /driver/dashboard?period=month&month=12&year=2024
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Performance Notes

- This endpoint is optimized with parallel data fetching using `Promise.all()`
- Response is cached-friendly - consider implementing client-side caching for 1-2 minutes
- Large datasets are automatically limited (recent deliveries: 10, available deliveries: 5)
- Analytics calculations are performed efficiently using MongoDB aggregation

## Related Endpoints

For more specific data, you can also use these individual endpoints:

- `GET /driver/profile` - Driver profile only
- `GET /driver/analytics` - Analytics only
- `GET /driver/earnings` - Earnings breakdown only
- `GET /driver/deliveries` - Deliveries with pagination
- `GET /driver/status` - Account status only

## Updates and Refresh

The dashboard data includes a `lastUpdated` timestamp. The frontend should:

1. Display this timestamp to users
2. Implement pull-to-refresh functionality
3. Consider automatic refresh every 5-10 minutes for active sessions
4. Update immediately after delivery status changes
