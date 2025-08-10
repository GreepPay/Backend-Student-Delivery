# Test Account Cleanup Guide

## 🧹 **Overview**

This guide helps you remove test accounts from your production database safely and efficiently.

## 📋 **Available Scripts**

### 1. **Preview Test Accounts** (Safe - Read Only)
```bash
node preview-test-accounts.js
```
- Shows what test accounts would be removed
- **Does NOT delete anything**
- Safe to run multiple times

### 2. **Remove Test Accounts** (Destructive)
```bash
node remove-test-accounts.js
```
- Actually removes test accounts
- **Requires confirmation**
- **Cannot be undone**

### 3. **Check Current Users** (Read Only)
```bash
node check-users.js
```
- Shows all current drivers in database
- Safe to run anytime

## 🔍 **What Gets Identified as Test Accounts**

### **Email Patterns:**
- `test@*`
- `admin@test.com`
- `driver@test.com`
- `demo@*`
- `example@*`
- `sample@*`
- `fake@*`
- `mock@*`

### **Name Patterns:**
- Contains "Test"
- Contains "Demo"
- Contains "Example"
- Contains "Sample"
- Contains "Fake"
- Contains "Mock"
- Contains "Dummy"

### **Specific Test Accounts:**
- `admin@test.com` (Test Admin)
- `driver@test.com` (Test Driver)

## 🚨 **Safety Features**

### **Confirmation Required:**
- Script asks for confirmation before deletion
- Must type "yes" or "y" to proceed
- Any other input cancels the operation

### **Preview Mode:**
- Always run preview first to see what would be removed
- No risk of accidental deletion

### **Detailed Logging:**
- Shows exactly what accounts are being removed
- Shows what accounts are being kept
- Provides summary of actions taken

## 📊 **Example Output**

### **Preview Mode:**
```
🔍 Scanning for test accounts (PREVIEW MODE)...

📋 Checking Admin accounts...
✅ Would keep admin: Super Admin (admin@example.com)
⚠️  Would remove test admin: Test Admin (admin@test.com)

📋 Checking Driver accounts...
✅ Would keep driver: Test Driver (driver@example.com)
⚠️  Would remove test driver: Test Driver (driver@test.com)

📊 Preview Summary:
⚠️  Test admins that would be removed: 1
⚠️  Test drivers that would be removed: 1
📋 Total test accounts that would be removed: 2

💡 To actually remove these accounts, run: node remove-test-accounts.js
```

### **Removal Mode:**
```
🚨 WARNING: This will permanently delete test accounts from your database!
This action cannot be undone.

Are you sure you want to continue? (yes/no): yes

🔄 Starting test account removal...

Connected to MongoDB
🔍 Scanning for test accounts...

📋 Checking Admin accounts...
❌ Removing test admin: Test Admin (admin@test.com)
✅ Keeping admin: Super Admin (admin@example.com)

📋 Checking Driver accounts...
❌ Removing test driver: Test Driver (driver@test.com)
✅ Keeping driver: Test Driver (driver@example.com)

📊 Summary:
✅ Test admins removed: 1
✅ Test drivers removed: 1
📋 Total test accounts removed: 2

🧹 Database cleanup completed successfully!
```

## 🔧 **Usage Instructions**

### **Step 1: Preview (Recommended)**
```bash
node preview-test-accounts.js
```

### **Step 2: Review Output**
- Check which accounts would be removed
- Verify no real accounts are marked for deletion
- Note the count of accounts to be removed

### **Step 3: Remove (If Safe)**
```bash
node remove-test-accounts.js
```

### **Step 4: Verify Cleanup**
```bash
node check-users.js
```

## ⚠️ **Important Notes**

### **Before Running:**
1. **Backup your database** if possible
2. **Run preview first** to see what will be removed
3. **Verify your production accounts** are not marked for deletion
4. **Ensure you have admin access** to the database

### **After Running:**
1. **Test your application** to ensure it still works
2. **Check authentication** still works for real users
3. **Verify no broken references** in other collections

## 🛠️ **Troubleshooting**

### **MongoDB Connection Error:**
```
Error: connect ECONNREFUSED ::1:27017
```
**Solution:** Ensure MongoDB is running and your `MONGODB_URI` environment variable is correct.

### **Permission Denied:**
```
Error: EACCES: permission denied
```
**Solution:** Ensure you have proper database permissions.

### **No Test Accounts Found:**
```
🎉 No test accounts found! Your database is clean.
```
**This is good!** Your database is already clean.

## 📞 **Support**

If you encounter any issues:
1. Check the error messages carefully
2. Verify your database connection
3. Ensure you have proper permissions
4. Contact your database administrator if needed

## 🎯 **Best Practices**

1. **Always preview first** before removing
2. **Keep backups** of your database
3. **Test in staging** before production
4. **Document what was removed** for future reference
5. **Run during maintenance windows** to minimize impact
