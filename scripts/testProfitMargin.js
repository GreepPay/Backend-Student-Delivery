const { calculateProfitMargin, formatProfitMargin } = require('../src/utils/helpers');

console.log('🧮 Testing Profit Margin Calculations\n');

// Test cases
const testCases = [
    { netProfit: 100, totalRevenue: 1000, description: 'Normal case' },
    { netProfit: 0, totalRevenue: 1000, description: 'Zero profit' },
    { netProfit: 100, totalRevenue: 0, description: 'Zero revenue' },
    { netProfit: 0, totalRevenue: 0, description: 'Zero profit and revenue' },
    { netProfit: -50, totalRevenue: 1000, description: 'Negative profit' },
    { netProfit: 100, totalRevenue: 100, description: '100% profit margin' },
    { netProfit: 33.33, totalRevenue: 100, description: '33.33% profit margin' }
];

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`  Net Profit: ₺${testCase.netProfit}`);
    console.log(`  Total Revenue: ₺${testCase.totalRevenue}`);

    const profitMargin = calculateProfitMargin(testCase.netProfit, testCase.totalRevenue);
    const formattedMargin = formatProfitMargin(profitMargin);

    console.log(`  Raw Profit Margin: ${profitMargin}`);
    console.log(`  Formatted Profit Margin: ${formattedMargin}`);
    console.log('');
});

console.log('✅ Profit margin calculation tests completed!');
