const mongoose = require('mongoose');
const Driver = require('./src/models/Driver');

// Connect to MongoDB
mongoose.connect('mongodb+srv://developer:rr7RoKQ8hb5FoNPG@cluster0.2lu5og4.mongodb.net/delivery_system?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function createTestDriver() {
    try {
        // Check if test driver already exists
        let testDriver = await Driver.findOne({ email: 'test@example.com' });
        
        if (!testDriver) {
            // Create a test driver with some sample data
            testDriver = await Driver.create({
                email: 'test@example.com',
                name: 'John Smith',
                phone: '+1234567890',
                studentId: 'EMU-2024-001',
                area: 'Kyrenia',
                transportationType: 'bicycle',
                university: 'Eastern Mediterranean University',
                isEmailVerified: true,
                isPhoneVerified: true,
                isDocumentVerified: false,
                totalDeliveries: 32,
                completedDeliveries: 31,
                totalEarnings: 3100,
                documents: {
                    studentId: {
                        status: 'verified',
                        uploadDate: new Date('2024-03-15T10:30:00.000Z')
                    },
                    profilePhoto: {
                        status: 'verified',
                        uploadDate: new Date('2024-03-15T11:00:00.000Z')
                    },
                    universityEnrollment: {
                        status: 'pending',
                        uploadDate: new Date('2024-03-16T09:15:00.000Z')
                    },
                    identityCard: {
                        status: 'verified',
                        uploadDate: new Date('2024-03-15T14:20:00.000Z')
                    },
                    transportationLicense: {
                        status: 'verified',
                        uploadDate: new Date('2024-03-15T15:45:00.000Z')
                    }
                },
                violations: [],
                suspensions: []
            });
            
            console.log('✅ Test driver created:', testDriver._id);
        } else {
            console.log('✅ Test driver already exists:', testDriver._id);
        }
        
        // Test the virtual fields
        console.log('\n📊 Account Status Test:');
        console.log('Verification Progress:', testDriver.verificationProgress + '%');
        console.log('Account Age:', testDriver.accountAge + ' days');
        console.log('Member Since:', testDriver.memberSince);
        
        const accountStatus = testDriver.accountStatus;
        console.log('\n📋 Full Account Status:');
        console.log(JSON.stringify(accountStatus, null, 2));
        
        // Test API endpoint URLs
        console.log('\n🔗 Test these API endpoints:');
        console.log(`GET http://localhost:3001/api/user/${testDriver._id}/status`);
        console.log(`GET http://localhost:3001/api/user/${testDriver._id}/join-date`);
        console.log(`GET http://localhost:3001/api/driver/status (requires auth)`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the test
createTestDriver();

