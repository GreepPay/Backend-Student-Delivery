const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const InvitationReferralCode = require('../src/models/InvitationReferralCode');
const Referral = require('../src/models/Referral');
const Driver = require('../src/models/Driver');

const REFERRAL_CODE = 'GRP-SDS001-WI';

async function checkReferralCode() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log(`🔍 Checking for referral code: ${REFERRAL_CODE}`);
        console.log('='.repeat(50));

        // Check in InvitationReferralCode collection
        console.log('📋 Checking InvitationReferralCode collection...');
        const invitationCode = await InvitationReferralCode.findOne({
            referralCode: REFERRAL_CODE
        }).populate('referrer', 'name email phone area');

        if (invitationCode) {
            console.log('✅ Found in InvitationReferralCode:');
            console.log(`   Referral Code: ${invitationCode.referralCode}`);
            console.log(`   Status: ${invitationCode.status}`);
            console.log(`   Created At: ${invitationCode.createdAt}`);
            console.log(`   Expires At: ${invitationCode.expiresAt}`);

            if (invitationCode.referrer) {
                console.log(`   Referrer: ${invitationCode.referrer.name} (${invitationCode.referrer.email})`);
                console.log(`   Referrer Area: ${invitationCode.referrer.area}`);
            }

            if (invitationCode.usedAt) {
                console.log(`   Used At: ${invitationCode.usedAt}`);
            }

            if (invitationCode.usedBy) {
                const usedByDriver = await Driver.findById(invitationCode.usedBy).select('name email');
                if (usedByDriver) {
                    console.log(`   Used By: ${usedByDriver.name} (${usedByDriver.email})`);
                }
            }
        } else {
            console.log('❌ Not found in InvitationReferralCode collection');
        }

        console.log('\n' + '='.repeat(50));

        // Check in Referral collection
        console.log('📋 Checking Referral collection...');
        const referral = await Referral.findOne({
            referralCode: REFERRAL_CODE
        }).populate('referrer', 'name email phone area')
            .populate('referred', 'name email phone area');

        if (referral) {
            console.log('✅ Found in Referral collection:');
            console.log(`   Referral Code: ${referral.referralCode}`);
            console.log(`   Status: ${referral.status}`);
            console.log(`   Registered At: ${referral.registeredAt}`);
            console.log(`   Expires At: ${referral.expiresAt}`);

            if (referral.referrer) {
                console.log(`   Referrer: ${referral.referrer.name} (${referral.referrer.email})`);
                console.log(`   Referrer Area: ${referral.referrer.area}`);
            }

            if (referral.referred) {
                console.log(`   Referred: ${referral.referred.name} (${referral.referred.email})`);
                console.log(`   Referred Area: ${referral.referred.area}`);
            }

            console.log(`   Progress: ${referral.progress.completedDeliveries}/${referral.completionCriteria.referredDeliveries} deliveries`);
            console.log(`   Earnings: $${referral.progress.totalEarnings}/${referral.completionCriteria.referredEarnings}`);
            console.log(`   Days Remaining: ${referral.progress.daysRemaining}`);

            if (referral.completedAt) {
                console.log(`   Completed At: ${referral.completedAt}`);
            }
        } else {
            console.log('❌ Not found in Referral collection');
        }

        console.log('\n' + '='.repeat(50));

        // Check all referral codes for pattern matching
        console.log('🔍 Checking all referral codes with similar pattern...');
        const allInvitationCodes = await InvitationReferralCode.find({
            referralCode: { $regex: /^GRP-SDS001-/ }
        }).populate('referrer', 'name email');

        if (allInvitationCodes.length > 0) {
            console.log(`✅ Found ${allInvitationCodes.length} invitation codes with GRP-SDS001- pattern:`);
            allInvitationCodes.forEach(code => {
                console.log(`   - ${code.referralCode} (${code.referrer?.name || 'Unknown'}) - Status: ${code.status}`);
            });
        } else {
            console.log('❌ No invitation codes found with GRP-SDS001- pattern');
        }

        const allReferrals = await Referral.find({
            referralCode: { $regex: /^GRP-SDS001-/ }
        }).populate('referrer', 'name email');

        if (allReferrals.length > 0) {
            console.log(`✅ Found ${allReferrals.length} referrals with GRP-SDS001- pattern:`);
            allReferrals.forEach(ref => {
                console.log(`   - ${ref.referralCode} (${ref.referrer?.name || 'Unknown'}) - Status: ${ref.status}`);
            });
        } else {
            console.log('❌ No referrals found with GRP-SDS001- pattern');
        }

        console.log('\n' + '='.repeat(50));

        // Summary
        console.log('📊 SUMMARY:');
        console.log(`   Target Code: ${REFERRAL_CODE}`);
        console.log(`   In InvitationReferralCode: ${invitationCode ? 'YES' : 'NO'}`);
        console.log(`   In Referral: ${referral ? 'YES' : 'NO'}`);

        if (!invitationCode && !referral) {
            console.log('\n❌ The referral code does not exist in the database');
        } else {
            console.log('\n✅ The referral code exists in the database');
        }

    } catch (error) {
        console.error('❌ Error checking referral code:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the check
checkReferralCode();
