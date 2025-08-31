#!/usr/bin/env node

/**
 * Comprehensive Referral System Test
 * 
 * This script tests the entire referral system flow:
 * 1. Generate referral code for existing driver
 * 2. Invite new driver with referral code
 * 3. Activate driver account
 * 4. Track referral progress
 * 5. Complete referral requirements
 * 6. Verify referral completion
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models and services
const Driver = require('../src/models/Driver');
const DriverInvitation = require('../src/models/DriverInvitation');
const InvitationReferralCode = require('../src/models/InvitationReferralCode');
const Referral = require('../src/models/Referral');
const ReferralService = require('../src/services/referralService');
const DriverInvitationService = require('../src/services/driverInvitationService');

// Test data
const testData = {
    referrerDriver: {
        name: 'John Referrer',
        email: 'john.referrer@test.com',
        phone: '+905551234568'
    },
    referredDriver: {
        name: 'Jane Referred',
        email: 'jane.referred@test.com',
        phone: '+905551234567'
    },
    adminUser: {
        id: '688973b69cd2d8234f26bd39', // Use existing admin ID
        name: 'Test Admin'
    }
};

class ReferralSystemTest {
    constructor() {
        this.testResults = [];
        this.cleanupIds = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '📝';
        console.log(`${prefix} [${timestamp}] ${message}`);
        this.testResults.push({ timestamp, type, message });
    }

    async connectToDatabase() {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            this.log('Connected to MongoDB', 'success');
            return true;
        } catch (error) {
            this.log(`Database connection failed: ${error.message}`, 'error');
            return false;
        }
    }

    async cleanup() {
        this.log('🧹 Starting cleanup...');

        for (const id of this.cleanupIds) {
            try {
                await Driver.findByIdAndDelete(id);
                this.log(`Cleaned up driver: ${id}`);
            } catch (error) {
                this.log(`Cleanup error for ${id}: ${error.message}`, 'warning');
            }
        }

        // Clean up test invitations
        try {
            await DriverInvitation.deleteMany({
                email: { $in: [testData.referrerDriver.email, testData.referredDriver.email] }
            });
            this.log('Cleaned up test invitations');
        } catch (error) {
            this.log(`Invitation cleanup error: ${error.message}`, 'warning');
        }

        // Clean up test referral codes
        try {
            await InvitationReferralCode.deleteMany({
                referralCode: { $regex: /TEST-/ }
            });
            this.log('Cleaned up test referral codes');
        } catch (error) {
            this.log(`Referral code cleanup error: ${error.message}`, 'warning');
        }

        // Clean up test referrals
        try {
            await Referral.deleteMany({
                referralCode: { $regex: /TEST-/ }
            });
            this.log('Cleaned up test referrals');
        } catch (error) {
            this.log(`Referral cleanup error: ${error.message}`, 'warning');
        }
    }

    async testStep1_GenerateReferralCode() {
        this.log('\n🔑 STEP 1: Generate Referral Code for Existing Driver');

        try {
            // Find an existing driver to use as referrer
            const existingDriver = await Driver.findOne({ isActive: true });
            if (!existingDriver) {
                this.log('No existing drivers found. Creating test driver...', 'warning');

                const newDriver = new Driver({
                    name: testData.referrerDriver.name,
                    email: testData.referrerDriver.email,
                    phone: testData.referrerDriver.phone,
                    isActive: true,
                    isOnline: false
                });

                await newDriver.save();
                this.referrerDriverId = newDriver._id;
                this.cleanupIds.push(newDriver._id);
                this.log(`Created test referrer driver: ${newDriver._id}`);
            } else {
                this.referrerDriverId = existingDriver._id;
                this.log(`Using existing driver as referrer: ${existingDriver.name} (${existingDriver._id})`);
            }

            // Generate referral code
            const result = await ReferralService.generateInvitationReferralCode(this.referrerDriverId);

            if (result.success) {
                this.referralCode = result.referralCode;
                this.log(`✅ Referral code generated: ${this.referralCode}`);
                this.log(`Driver: ${result.driverName}`);
                this.log(`Message: ${result.message}`);
                return true;
            } else {
                this.log(`❌ Failed to generate referral code: ${result.error}`, 'error');
                return false;
            }
        } catch (error) {
            this.log(`❌ Error in step 1: ${error.message}`, 'error');
            return false;
        }
    }

    async testStep2_InviteDriverWithReferralCode() {
        this.log('\n📧 STEP 2: Invite New Driver with Referral Code');

        try {
            const invitation = await DriverInvitationService.createInvitation({
                name: testData.referredDriver.name,
                email: testData.referredDriver.email,
                invitedBy: testData.adminUser.id,
                referralCode: this.referralCode
            });

            this.invitationId = invitation._id;
            this.invitationToken = invitation.invitationToken;

            this.log(`✅ Driver invitation created: ${invitation._id}`);
            this.log(`Email: ${invitation.email}`);
            this.log(`Status: ${invitation.status}`);
            this.log(`Referral Code: ${invitation.referralCode}`);
            this.log(`Expires: ${invitation.expiresAt}`);

            return true;
        } catch (error) {
            this.log(`❌ Error in step 2: ${error.message}`, 'error');
            return false;
        }
    }

    async testStep3_ActivateDriverAccount() {
        this.log('\n🚀 STEP 3: Activate Driver Account');

        try {
            const driverData = {
                phone: testData.referredDriver.phone,
                area: 'Gonyeli',
                isActive: true,
                isOnline: false
            };

            const driver = await DriverInvitationService.activateDriverAccount(
                this.invitationToken,
                driverData
            );

            this.referredDriverId = driver._id;
            this.cleanupIds.push(driver._id);

            this.log(`✅ Driver account activated: ${driver._id}`);
            this.log(`Name: ${driver.name}`);
            this.log(`Email: ${driver.email}`);
            this.log(`Status: ${driver.isActive ? 'Active' : 'Inactive'}`);

            return true;
        } catch (error) {
            this.log(`❌ Error in step 3: ${error.message}`, 'error');
            return false;
        }
    }

    async testStep4_VerifyReferralCodeUsage() {
        this.log('\n🔍 STEP 4: Verify Referral Code Usage');

        try {
            // Check if referral code was marked as used
            const referralCodeRecord = await InvitationReferralCode.findOne({
                referralCode: this.referralCode
            });

            if (referralCodeRecord) {
                this.log(`✅ Referral code record found: ${referralCodeRecord._id}`);
                this.log(`Status: ${referralCodeRecord.status}`);
                this.log(`Used by: ${referralCodeRecord.usedBy}`);
                this.log(`Used at: ${referralCodeRecord.usedAt}`);

                if (referralCodeRecord.status === 'used' && referralCodeRecord.usedBy) {
                    this.log('✅ Referral code correctly marked as used');
                    return true;
                } else {
                    this.log('❌ Referral code not properly marked as used', 'error');
                    return false;
                }
            } else {
                this.log('❌ Referral code record not found', 'error');
                return false;
            }
        } catch (error) {
            this.log(`❌ Error in step 4: ${error.message}`, 'error');
            return false;
        }
    }

    async testStep5_CheckReferralStatistics() {
        this.log('\n📊 STEP 5: Check Referral Statistics (Invitation System)');

        try {
            // Check invitation referral code statistics

            const referralCodes = await InvitationReferralCode.find({
                referrer: this.referrerDriverId
            });

            this.log(`📈 Invitation Referral Codes for ${this.referrerDriverId}:`);
            this.log(`Total Codes Generated: ${referralCodes.length}`);

            const activeCodes = referralCodes.filter(code => code.status === 'active');
            const usedCodes = referralCodes.filter(code => code.status === 'used');
            const expiredCodes = referralCodes.filter(code => code.status === 'expired');

            this.log(`Active Codes: ${activeCodes.length}`);
            this.log(`Used Codes: ${usedCodes.length}`);
            this.log(`Expired Codes: ${expiredCodes.length}`);

            // Check if our referral code is in the used codes
            const ourUsedCode = usedCodes.find(code => code.referralCode === this.referralCode);
            if (ourUsedCode) {
                this.log(`✅ Our referral code ${this.referralCode} is correctly marked as used`);
                this.log(`Used by: ${ourUsedCode.usedBy}`);
                this.log(`Used at: ${ourUsedCode.usedAt}`);
                return true;
            } else {
                this.log(`❌ Our referral code ${this.referralCode} not found in used codes`, 'error');
                return false;
            }
        } catch (error) {
            this.log(`❌ Error in step 5: ${error.message}`, 'error');
            return false;
        }
    }

    async testStep6_TestProgressTrackingSystem() {
        this.log('\n📈 STEP 6: Test Progress Tracking Referral System');

        try {
            // Create a referral record for progress tracking

            const referralCode = `TEST-${Date.now()}`;
            const referral = new Referral({
                referrer: this.referrerDriverId,
                referred: this.referredDriverId,
                referralCode: referralCode,
                status: 'pending',
                completionCriteria: {
                    referredDeliveries: 5,
                    referredEarnings: 500,
                    timeLimit: 30
                },
                progress: {
                    completedDeliveries: 0,
                    totalEarnings: 0,
                    daysRemaining: 30
                },
                rewards: {
                    referrer: 1000,
                    referred: 500
                },
                expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
            });

            await referral.save();
            this.log(`✅ Created progress tracking referral: ${referral._id}`);

            // Test progress updates
            const progressUpdates = [
                { deliveries: 2, earnings: 200 },
                { deliveries: 5, earnings: 500 },
                { deliveries: 7, earnings: 700 }
            ];

            for (const update of progressUpdates) {
                referral.updateProgress(update.deliveries, update.earnings);
                await referral.save();

                this.log(`📊 Updated progress: ${update.deliveries} deliveries, ${update.earnings} earnings`);
                this.log(`Status: ${referral.status}`);
                this.log(`Days Remaining: ${referral.progress.daysRemaining}`);

                if (referral.status === 'completed') {
                    this.log('🎉 Referral completed!');
                    break;
                }
            }

            // Test referral statistics
            const referrerStats = await ReferralService.getReferralStats(this.referrerDriverId);

            this.log(`📈 Progress Tracking Statistics:`);
            this.log(`Referrals Given - Total: ${referrerStats.stats.referralsGiven.total}`);
            this.log(`Referrals Given - Pending: ${referrerStats.stats.referralsGiven.pending}`);
            this.log(`Referrals Given - Completed: ${referrerStats.stats.referralsGiven.completed}`);

            if (referrerStats.stats.referralsGiven.total > 0) {
                this.log('✅ Progress tracking referral is working correctly');
                return true;
            } else {
                this.log('❌ Progress tracking referral not found in statistics', 'error');
                return false;
            }
        } catch (error) {
            this.log(`❌ Error in step 6: ${error.message}`, 'error');
            return false;
        }
    }

    async runAllTests() {
        this.log('🧪 Starting Comprehensive Referral System Test');
        this.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        this.log(`Database: ${process.env.MONGODB_URI ? 'Configured' : 'Not configured'}`);

        // Connect to database
        if (!(await this.connectToDatabase())) {
            return false;
        }

        const steps = [
            this.testStep1_GenerateReferralCode.bind(this),
            this.testStep2_InviteDriverWithReferralCode.bind(this),
            this.testStep3_ActivateDriverAccount.bind(this),
            this.testStep4_VerifyReferralCodeUsage.bind(this),
            this.testStep5_CheckReferralStatistics.bind(this),
            this.testStep6_TestProgressTrackingSystem.bind(this)
        ];

        let allPassed = true;
        for (let i = 0; i < steps.length; i++) {
            const stepPassed = await steps[i]();
            if (!stepPassed) {
                allPassed = false;
                this.log(`❌ Step ${i + 1} failed, stopping test`, 'error');
                break;
            }
        }

        // Cleanup
        await this.cleanup();

        // Summary
        this.log('\n📋 TEST SUMMARY');
        this.log(`Overall Result: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
        this.log(`Total Steps: ${steps.length}`);
        this.log(`Passed Steps: ${this.testResults.filter(r => r.type === 'success').length}`);
        this.log(`Failed Steps: ${this.testResults.filter(r => r.type === 'error').length}`);

        return allPassed;
    }
}

// Run the test
async function main() {
    const test = new ReferralSystemTest();
    const success = await test.runAllTests();

    if (success) {
        console.log('\n🎉 All referral system tests passed!');
        process.exit(0);
    } else {
        console.log('\n💥 Some referral system tests failed!');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});
