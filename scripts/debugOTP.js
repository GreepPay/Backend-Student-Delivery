#!/usr/bin/env node

/**
 * Debug OTP Issue
 * 
 * This script directly tests the OTP functionality to identify the issue.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const OTPService = require('../src/services/otpService');
const Admin = require('../src/models/Admin');

async function debugOTP() {
    console.log('🔍 Debugging OTP Issue');
    console.log('======================\n');

    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Test 1: Check if admin exists
        console.log('🔍 Test 1: Checking if admin exists...');
        const admin = await Admin.findOne({ email: 'wisdom@greep.io' });
        console.log('Admin found:', admin ? 'Yes' : 'No');
        if (admin) {
            console.log('Admin details:', {
                email: admin.email,
                isActive: admin.isActive,
                role: admin.role
            });
        }
        console.log('');

        // Test 2: Check findActiveByEmail method
        console.log('🔍 Test 2: Testing findActiveByEmail method...');
        const activeAdmin = await Admin.findActiveByEmail('wisdom@greep.io');
        console.log('Active admin found:', activeAdmin ? 'Yes' : 'No');
        if (activeAdmin) {
            console.log('Active admin details:', {
                email: activeAdmin.email,
                isActive: activeAdmin.isActive,
                role: activeAdmin.role
            });
        }
        console.log('');

        // Test 3: Test verifyUserExists directly
        console.log('🔍 Test 3: Testing verifyUserExists method...');
        try {
            const user = await OTPService.verifyUserExists('wisdom@greep.io', 'admin');
            console.log('✅ User verification successful:', user.email);
        } catch (error) {
            console.log('❌ User verification failed:', error.message);
        }
        console.log('');

        // Test 4: Test full OTP send process
        console.log('🔍 Test 4: Testing full OTP send process...');
        try {
            const result = await OTPService.sendOTP('wisdom@greep.io', 'admin', '127.0.0.1', 'test-agent');
            console.log('✅ OTP send successful:', result);
        } catch (error) {
            console.log('❌ OTP send failed:', error.message);
            console.log('Error stack:', error.stack);
        }

    } catch (error) {
        console.log('❌ Debug script failed:', error.message);
        console.log('Error stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

// Run the debug
debugOTP().catch(console.error);
