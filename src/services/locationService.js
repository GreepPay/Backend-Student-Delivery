const Driver = require('../models/Driver');

class LocationService {
    /**
     * Extract coordinates from Google Maps link
     * Supports various Google Maps URL formats
     */
    static extractCoordinatesFromGoogleMapsLink(googleMapsLink) {
        try {
            if (!googleMapsLink || typeof googleMapsLink !== 'string') {
                throw new Error('Invalid Google Maps link provided');
            }

            let lat, lng;

            // Handle different Google Maps URL formats
            if (googleMapsLink.includes('@')) {
                // Format: https://www.google.com/maps/place/.../@35.1234,33.5678,15z/...
                const match = googleMapsLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (match) {
                    lat = parseFloat(match[1]);
                    lng = parseFloat(match[2]);
                }
            } else if (googleMapsLink.includes('maps.google.com') && googleMapsLink.includes('q=')) {
                // Format: https://maps.google.com/?q=35.1234,33.5678
                const match = googleMapsLink.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (match) {
                    lat = parseFloat(match[1]);
                    lng = parseFloat(match[2]);
                }
            } else if (googleMapsLink.includes('maps.google.com') && googleMapsLink.includes('ll=')) {
                // Format: https://maps.google.com/?ll=35.1234,33.5678
                const match = googleMapsLink.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (match) {
                    lat = parseFloat(match[1]);
                    lng = parseFloat(match[2]);
                }
            }

            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                throw new Error('Could not extract valid coordinates from Google Maps link');
            }

            return { lat, lng };
        } catch (error) {
            console.error('❌ Error extracting coordinates from Google Maps link:', error);
            throw new Error(`Failed to extract coordinates: ${error.message}`);
        }
    }

    /**
     * Calculate distance between two points using Haversine formula
     * Returns distance in kilometers
     */
    static calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Find drivers within a specified radius of pickup location
     * Simple and reliable distance-based search
     */
    static async findNearbyDrivers(pickupLat, pickupLng, radiusKm = 10, limit = 20) {
        try {
            console.log(`🔍 Finding drivers within ${radiusKm}km of pickup location (${pickupLat}, ${pickupLng})`);

            // Get all active and online drivers
            const allDrivers = await Driver.find({
                isActive: true,
                isOnline: true,
                isSuspended: false
            }).select('_id name email area phone isOnline lastKnownLocation');

            console.log(`📊 Found ${allDrivers.length} active online drivers`);

            // Calculate distances and filter by radius
            const nearbyDrivers = [];

            for (const driver of allDrivers) {
                // Use driver's area as fallback if no specific coordinates
                let driverLat, driverLng;

                if (driver.lastKnownLocation && driver.lastKnownLocation.lat && driver.lastKnownLocation.lng) {
                    driverLat = driver.lastKnownLocation.lat;
                    driverLng = driver.lastKnownLocation.lng;
                } else {
                    // Use area-based coordinates as fallback
                    const areaCoords = this.getAreaCoordinates(driver.area);
                    driverLat = areaCoords.lat;
                    driverLng = areaCoords.lng;
                }

                const distance = this.calculateDistance(pickupLat, pickupLng, driverLat, driverLng);

                if (distance <= radiusKm) {
                    nearbyDrivers.push({
                        driver: driver,
                        distance: distance,
                        distanceFormatted: `${distance.toFixed(1)}km`
                    });
                }
            }

            // Sort by distance (closest first)
            nearbyDrivers.sort((a, b) => a.distance - b.distance);

            // Limit results
            const limitedDrivers = nearbyDrivers.slice(0, limit);

            console.log(`✅ Found ${limitedDrivers.length} drivers within ${radiusKm}km radius`);

            return limitedDrivers;
        } catch (error) {
            console.error('❌ Error finding nearby drivers:', error);
            throw error;
        }
    }

    /**
     * Get approximate coordinates for driver areas
     * This provides a fallback when drivers don't have specific coordinates
     */
    static getAreaCoordinates(area) {
        const areaCoordinates = {
            'Gonyeli': { lat: 35.2167, lng: 33.3333 },
            'Kucuk': { lat: 35.1833, lng: 33.3667 },
            'Lefkosa': { lat: 35.1856, lng: 33.3823 },
            'Famagusta': { lat: 35.1167, lng: 33.9167 },
            'Kyrenia': { lat: 35.3333, lng: 33.3167 },
            'Other': { lat: 35.1856, lng: 33.3823 } // Default to Lefkosa
        };

        return areaCoordinates[area] || areaCoordinates['Other'];
    }

    /**
     * Validate Google Maps link format
     */
    static validateGoogleMapsLink(link) {
        if (!link || typeof link !== 'string') {
            return { isValid: false, error: 'Link is required' };
        }

        const googleMapsPatterns = [
            /maps\.google\.com/,
            /google\.com\/maps/,
            /goo\.gl\/maps/,
            /maps\.app\.goo\.gl/
        ];

        const isValidFormat = googleMapsPatterns.some(pattern => pattern.test(link));

        if (!isValidFormat) {
            return { isValid: false, error: 'Invalid Google Maps link format' };
        }

        try {
            const coords = this.extractCoordinatesFromGoogleMapsLink(link);
            return {
                isValid: true,
                coordinates: coords,
                message: 'Valid Google Maps link with coordinates extracted'
            };
        } catch (error) {
            return {
                isValid: false,
                error: `Could not extract coordinates: ${error.message}`
            };
        }
    }

    /**
     * Get formatted address from coordinates (reverse geocoding)
     * This can be used to show human-readable addresses
     */
    static async getAddressFromCoordinates(lat, lng) {
        try {
            // For now, return a simple formatted string
            // In production, you could integrate with Google Geocoding API
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (error) {
            console.error('❌ Error getting address from coordinates:', error);
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }
}

module.exports = LocationService;
