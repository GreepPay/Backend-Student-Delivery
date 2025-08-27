# 🚀 Server Modes Guide

## Overview
The Student Delivery System supports different server modes for development and production testing.

## 📋 Available Modes

### 1. Development Mode (`dev`)
**Purpose**: Local development with console logging
```bash
npm run start:dev
# or
node scripts/startServer.js dev
```

**Features**:
- ✅ OTPs logged to console
- ✅ No real emails sent
- ✅ Full debugging enabled
- ✅ Hot reload with nodemon

### 2. Production Mode (`prod`)
**Purpose**: Full production mode with real emails
```bash
npm run start:prod
# or
node scripts/startServer.js prod
```

**Features**:
- ✅ Real emails sent via Zepto Mail
- ✅ Production optimizations
- ✅ Rate limiting enabled
- ⚠️ Requires production environment

### 3. Local Production Mode (`local`)
**Purpose**: Production testing on localhost
```bash
npm run start:local
# or
node scripts/startServer.js local
```

**Features**:
- ✅ Production environment
- ✅ OTPs logged to console (localhost override)
- ✅ Perfect for testing production features locally
- ✅ No email sending restrictions

## 🔧 Environment Variables

### Development Mode
```bash
NODE_ENV=development
```

### Production Mode
```bash
NODE_ENV=production
ZEPTO_MAIL_USER=your_username
ZEPTO_MAIL_PASSWORD=your_password
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

### Local Production Mode
```bash
NODE_ENV=production
LOCALHOST_OVERRIDE=true
ZEPTO_MAIL_USER=your_username
ZEPTO_MAIL_PASSWORD=your_password
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

## 📧 Email Behavior

| Mode | OTP Behavior | Email Sending |
|------|-------------|---------------|
| `dev` | Logged to console | ❌ Disabled |
| `prod` | Sent via Zepto Mail | ✅ Enabled |
| `local` | Logged to console | ❌ Disabled (localhost) |

## 🧪 Testing

### Test OTP Functionality
```bash
# Test in development mode
npm run start:dev
curl -X POST http://localhost:3001/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","userType":"admin"}'
```

### Test Email Configuration
```bash
# Test Zepto Mail setup
npm run test:email

# Test production configuration
npm run test:production
```

## 🚀 Quick Start

### For Development
```bash
npm run start:dev
```

### For Production Testing (Local)
```bash
npm run start:local
```

### For Production Deployment
```bash
npm run start:prod
```

## 🔍 Troubleshooting

### "553 Relaying disallowed" Error
This error occurs when trying to send emails from localhost in production mode.

**Solution**: Use `local` mode instead of `prod` mode for local testing.

### Port Already in Use
```bash
# Kill existing processes
lsof -ti:3001 | xargs kill -9

# Or use a different port
PORT=3002 npm run start:dev
```

### Environment Variables Not Set
Make sure all required environment variables are configured in your `.env` file.

## 📝 Notes

- **Development Mode**: Best for daily development work
- **Local Production Mode**: Best for testing production features locally
- **Production Mode**: Use only on actual production servers
- **Email Testing**: Always test email functionality before deploying to production
