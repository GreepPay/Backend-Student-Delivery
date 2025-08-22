const axios = require('axios');

async function testRemittanceCancelAPI() {
    try {
        // First, let's find a pending remittance to cancel
        console.log('🔍 Finding pending remittances...');

        const listResponse = await axios.get('http://localhost:3001/api/admin/remittances?status=pending&limit=5', {
            headers: {
                'Authorization': 'Bearer test-token-for-demo'
            }
        });

        if (!listResponse.data.success || !listResponse.data.data.remittances.length) {
            console.log('❌ No pending remittances found for testing');
            return;
        }

        const pendingRemittance = listResponse.data.data.remittances[0];
        console.log('✅ Found pending remittance for testing:', {
            id: pendingRemittance._id,
            referenceNumber: pendingRemittance.referenceNumber,
            amount: pendingRemittance.amount,
            status: pendingRemittance.status
        });

        // Test 1: Try to cancel without reason (should fail)
        console.log('\n🧪 Test 1: Cancelling without reason (should fail)...');
        try {
            await axios.put(`http://localhost:3001/api/admin/remittances/${pendingRemittance._id}/cancel`, {}, {
                headers: {
                    'Authorization': 'Bearer test-token-for-demo'
                }
            });
            console.log('❌ Test 1 failed: Should have returned 400 error');
        } catch (error) {
            if (error.response?.status === 400 && error.response?.data?.error === '"reason" is not allowed to be empty') {
                console.log('✅ Test 1 passed: Correctly rejected empty reason');
            } else {
                console.log('❌ Test 1 failed: Unexpected error:', error.response?.data);
            }
        }

        // Test 2: Try to cancel with empty reason (should fail)
        console.log('\n🧪 Test 2: Cancelling with empty reason (should fail)...');
        try {
            await axios.put(`http://localhost:3001/api/admin/remittances/${pendingRemittance._id}/cancel`, { reason: '' }, {
                headers: {
                    'Authorization': 'Bearer test-token-for-demo'
                }
            });
            console.log('❌ Test 2 failed: Should have returned 400 error');
        } catch (error) {
            if (error.response?.status === 400 && error.response?.data?.error === '"reason" is not allowed to be empty') {
                console.log('✅ Test 2 passed: Correctly rejected empty reason');
            } else {
                console.log('❌ Test 2 failed: Unexpected error:', error.response?.data);
            }
        }

        // Test 3: Try to cancel with valid reason (should succeed)
        console.log('\n🧪 Test 3: Cancelling with valid reason (should succeed)...');
        try {
            const cancelResponse = await axios.put(`http://localhost:3001/api/admin/remittances/${pendingRemittance._id}/cancel`, {
                reason: 'Test cancellation via API - valid reason'
            }, {
                headers: {
                    'Authorization': 'Bearer test-token-for-demo'
                }
            });

            if (cancelResponse.data.success) {
                console.log('✅ Test 3 passed: Remittance cancelled successfully');
                console.log('📋 Response:', {
                    success: cancelResponse.data.success,
                    message: cancelResponse.data.message,
                    remittanceStatus: cancelResponse.data.data.remittance.status,
                    cancelledAt: cancelResponse.data.data.remittance.cancelledAt,
                    cancelReason: cancelResponse.data.data.remittance.cancelReason
                });
            } else {
                console.log('❌ Test 3 failed: Unexpected response:', cancelResponse.data);
            }
        } catch (error) {
            console.log('❌ Test 3 failed:', error.response?.data || error.message);
        }

        // Test 4: Try to cancel already cancelled remittance (should fail)
        console.log('\n🧪 Test 4: Cancelling already cancelled remittance (should fail)...');
        try {
            await axios.put(`http://localhost:3001/api/admin/remittances/${pendingRemittance._id}/cancel`, {
                reason: 'Test cancellation of already cancelled remittance'
            }, {
                headers: {
                    'Authorization': 'Bearer test-token-for-demo'
                }
            });
            console.log('❌ Test 4 failed: Should have returned 400 error');
        } catch (error) {
            if (error.response?.status === 400 && error.response?.data?.error === 'Only pending remittances can be cancelled') {
                console.log('✅ Test 4 passed: Correctly rejected cancellation of non-pending remittance');
            } else {
                console.log('❌ Test 4 failed: Unexpected error:', error.response?.data);
            }
        }

    } catch (error) {
        console.error('❌ Error testing remittance cancellation API:', error.response?.data || error.message);
    }
}

testRemittanceCancelAPI();
