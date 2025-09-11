const { successResponse, errorResponse, catchAsync } = require('../middleware/errorHandler');

class PublicController {
    /**
     * Get profile options for driver registration/profile setup
     */
    static getProfileOptions = catchAsync(async (req, res) => {
        const profileOptions = {
            universities: [
                'Eastern Mediterranean University (EMU)',
                'Near East University (NEU)',
                'Cyprus International University (CIU)',
                'Girne American University (GAU)',
                'University of Kyrenia (UoK)',
                'European University of Lefke (EUL)',
                'Middle East Technical University (METU) – Northern Cyprus Campus',
                'Final International University (FIU)',
                'Bahçeşehir Cyprus University (BAU)',
                'University of Mediterranean Karpasia (UMK)',
                'Cyprus Health and Social Science University',
                'Arkin University of Creative Arts & Design',
                'Cyprus West University'
            ],
            areas: [
                'Lefkosa'
            ],
            transportationTypes: [
                'bicycle',
                'motorcycle',
                'scooter',
                'car',
                'walking',
                'other'
            ],
            addressOptions: [
                'Gonyeli',
                'Kucuk',
                'Lefkosa',
                'Famagusta',
                'Kyrenia',
                'Girne',
                'Other'
            ]
        };

        return successResponse(res, profileOptions, 'Profile options retrieved successfully');
    });
}

module.exports = PublicController;
