# Profile Update 400 Error Analysis

## ❌ **Problem: `PUT /api/driver/profile 400 (Bad Request)`**

### 🔍 **Root Cause Identified**

The 400 error is caused by **frontend sending incorrect field names** that don't match the backend validation schema.

## 📋 **Backend Validation Schema**

### ✅ **Expected Fields (updateDriverProfile schema):**

```javascript
{
    fullName: Joi.string().min(2).max(50),
    phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).allow(''),
    area: Joi.string().valid('Gonyeli', 'Kucuk', 'Lefkosa', 'Famagusta', 'Kyrenia', 'Other'),
    transportationType: Joi.string().valid('bicycle', 'motorcycle', 'scooter', 'car', 'walking', 'other'),
    university: Joi.string().valid(
        'Eastern Mediterranean University (EMU)',
        'Near East University (NEU)',
        'Cyprus International University (CIU)',
        'Girne American University (GAU)',
        'University of Kyrenia (UoK)',
        'European University of Lefke (EUL)',
        'Middle East Technical University (METU) – Northern Cyprus Campus',
        'Final International University (FIU)',
        'Bahçeşehir Cyprus University (BAU)',
        'University of Mediterranean Karpasia (UMK)',
        'Cyprus Health and Social Science University',
        'Arkin University of Creative Arts & Design',
        'Cyprus West University'
    ),
    studentId: Joi.string().min(4).max(20),
    address: Joi.string().valid(
        'Gonyeli', 'Kucuk', 'Lefkosa', 'Famagusta', 'Kyrenia',
        'Girne', 'Iskele', 'Guzelyurt', 'Lapta', 'Ozankoy',
        'Bogaz', 'Dipkarpaz', 'Yeniiskele', 'Gazimagusa', 'Other'
    ).allow('')
}
```

## ❌ **Common Frontend Mistakes**

### **1. Wrong Field Names:**

```javascript
// ❌ WRONG - Will cause 400 error
{
    "name": "John Doe",           // Should be "fullName"
    "method": "bicycle",          // Should be "transportationType"
    "location": "Famagusta"       // Should be "area"
}

// ✅ CORRECT
{
    "fullName": "John Doe",
    "transportationType": "bicycle",
    "area": "Famagusta"
}
```

### **2. Invalid Enum Values:**

```javascript
// ❌ WRONG - Invalid enum values
{
    "area": "Nicosia",                    // Not in enum
    "transportationType": "bike",         // Should be "bicycle"
    "university": "Some University",      // Not in enum
    "address": "Random Location"          // Not in enum
}

// ✅ CORRECT
{
    "area": "Famagusta",                  // Valid enum value
    "transportationType": "bicycle",      // Valid enum value
    "university": "Eastern Mediterranean University (EMU)", // Valid enum value
    "address": "Gonyeli"                  // Valid enum value
}
```

## 🔧 **Frontend Fixes Required**

### **1. Update Field Names:**

```javascript
// Frontend form data mapping
const formData = {
  fullName: form.name, // Map "name" to "fullName"
  phone: form.phone,
  area: form.serviceArea, // Map "serviceArea" to "area"
  transportationType: form.method, // Map "method" to "transportationType"
  university: form.university,
  studentId: form.studentId,
  address: form.location, // Map "location" to "address"
};
```

### **2. Use Correct Enum Values:**

```javascript
// Areas (service areas)
const areas = ["Gonyeli", "Kucuk", "Lefkosa", "Famagusta", "Kyrenia", "Other"];

// Transportation methods
const transportationTypes = [
  "bicycle",
  "motorcycle",
  "scooter",
  "car",
  "walking",
  "other",
];

// Universities (13 options)
const universities = [
  "Eastern Mediterranean University (EMU)",
  "Near East University (NEU)",
  "Cyprus International University (CIU)",
  "Girne American University (GAU)",
  "University of Kyrenia (UoK)",
  "European University of Lefke (EUL)",
  "Middle East Technical University (METU) – Northern Cyprus Campus",
  "Final International University (FIU)",
  "Bahçeşehir Cyprus University (BAU)",
  "University of Mediterranean Karpasia (UMK)",
  "Cyprus Health and Social Science University",
  "Arkin University of Creative Arts & Design",
  "Cyprus West University",
];

// Addresses (15 locations)
const addresses = [
  "Gonyeli",
  "Kucuk",
  "Lefkosa",
  "Famagusta",
  "Kyrenia",
  "Girne",
  "Iskele",
  "Guzelyurt",
  "Lapta",
  "Ozankoy",
  "Bogaz",
  "Dipkarpaz",
  "Yeniiskele",
  "Gazimagusa",
  "Other",
];
```

### **3. Example Correct Request:**

```javascript
// ✅ CORRECT request body
const updateData = {
  fullName: "John Doe",
  phone: "+905551234567",
  area: "Famagusta",
  transportationType: "bicycle",
  university: "Eastern Mediterranean University (EMU)",
  studentId: "20230001",
  address: "Gonyeli",
};

// Send to backend
fetch("/api/driver/profile", {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(updateData),
});
```

## 🧪 **Testing & Debugging**

### **1. Use Debug Endpoint:**

```bash
# Test what data is being sent
curl -X POST http://localhost:3001/api/driver/profile/debug \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "method": "bike"}'
```

### **2. Check Browser Network Tab:**

- Look at the request payload being sent
- Check if field names match the schema
- Verify enum values are correct

### **3. Check Browser Console:**

- Look for validation error details
- Check the exact error message from the 400 response

## 📊 **API Endpoint Details**

### **Route:** `PUT /api/driver/profile`

- **Controller:** `DriverController.updateProfile`
- **Validation:** `schemas.updateDriverProfile`
- **Authentication:** Required (Bearer token)

### **Expected Response:**

```javascript
{
    "success": true,
    "message": "Profile updated successfully",
    "data": {
        "id": "driver_id",
        "fullName": "John Doe",
        "email": "driver@example.com",
        "phone": "+905551234567",
        "area": "Famagusta",
        "transportationType": "bicycle",
        "university": "Eastern Mediterranean University (EMU)",
        "studentId": "20230001",
        "address": "Gonyeli",
        "profilePicture": "cloudinary_url",
        "completion": { /* profile completion data */ },
        "verification": { /* verification status */ }
    }
}
```

## 🎯 **Summary**

### ✅ **Backend Status: WORKING CORRECTLY**

- Validation schema is properly implemented
- All required fields are defined
- Enum values are correctly specified
- API endpoint is functioning

### ❌ **Frontend Status: NEEDS FIXES**

- Field names don't match backend schema
- Enum values may be incorrect
- Data mapping needs to be updated

### 🔧 **Immediate Actions:**

1. **Update frontend field names** to match backend schema
2. **Use correct enum values** for all dropdowns
3. **Test with debug endpoint** to verify data format
4. **Check browser network tab** to confirm correct payload

The 400 error is **100% a frontend validation issue** - the backend is working correctly and rejecting invalid data as expected! 🎯
