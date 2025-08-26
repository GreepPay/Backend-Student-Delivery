/**
 * Calculate profit margin safely, handling division by zero
 * @param {number} netProfit - Net profit amount
 * @param {number} totalRevenue - Total revenue amount
 * @param {boolean} returnPercentage - Whether to return as percentage (default: true)
 * @returns {number|string|null} - Profit margin as percentage, 'N/A' for zero revenue, or null for invalid
 */
function calculateProfitMargin(netProfit, totalRevenue, returnPercentage = true) {
    // Validate inputs
    if (typeof netProfit !== 'number' || typeof totalRevenue !== 'number') {
        return null;
    }

    // Handle zero revenue case
    if (totalRevenue === 0) {
        return 'N/A';
    }

    // Calculate profit margin
    const profitMargin = (netProfit / totalRevenue) * 100;

    // Return formatted result
    if (returnPercentage) {
        return Math.round(profitMargin * 10) / 10; // Round to 1 decimal place
    }

    return profitMargin / 100; // Return as decimal
}

/**
 * Format profit margin for display
 * @param {number|string|null} profitMargin - Profit margin value
 * @param {string} defaultValue - Default value to show if profitMargin is null/undefined
 * @returns {string} - Formatted profit margin for display
 */
function formatProfitMargin(profitMargin, defaultValue = 'N/A') {
    if (profitMargin === null || profitMargin === undefined) {
        return defaultValue;
    }

    if (typeof profitMargin === 'string') {
        return profitMargin;
    }

    if (typeof profitMargin === 'number') {
        return `${profitMargin.toFixed(1)}%`;
    }

    return defaultValue;
}

module.exports = {
    calculateProfitMargin,
    formatProfitMargin
};
