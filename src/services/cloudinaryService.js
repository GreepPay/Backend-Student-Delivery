const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryService {
    // Upload image with compression and optimization
    static async uploadImage(file, folder = 'driver-profiles') {
        try {
            // Convert buffer to stream
            const stream = Readable.from(file.buffer);

            // Upload with optimization settings
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: folder,
                        transformation: [
                            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                            { quality: 'auto:good', fetch_format: 'auto' }
                        ],
                        resource_type: 'image',
                        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                        format: 'webp'
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );

                stream.pipe(uploadStream);
            });

            return {
                success: true,
                url: result.secure_url,
                public_id: result.public_id,
                width: result.width,
                height: result.height,
                bytes: result.bytes
            };
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Delete image from Cloudinary
    static async deleteImage(publicId) {
        try {
            const result = await cloudinary.uploader.destroy(publicId);
            return {
                success: true,
                result: result
            };
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generate optimized URL with transformations
    static getOptimizedUrl(url, options = {}) {
        if (!url) return null;

        const {
            width = 400,
            height = 400,
            crop = 'fill',
            gravity = 'face',
            quality = 'auto:good',
            format = 'auto'
        } = options;

        // If it's already a Cloudinary URL, add transformations
        if (url.includes('cloudinary.com')) {
            const baseUrl = url.split('/upload/')[0] + '/upload/';
            const imagePath = url.split('/upload/')[1];

            const transformations = `w_${width},h_${height},c_${crop},g_${gravity},q_${quality},f_${format}`;

            return `${baseUrl}${transformations}/${imagePath}`;
        }

        return url;
    }

    // Validate image file
    static validateImage(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!allowedTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: 'Invalid file type. Please upload JPEG, PNG, or WebP images only.'
            };
        }

        if (file.size > maxSize) {
            return {
                valid: false,
                error: 'File size too large. Please upload images smaller than 5MB.'
            };
        }

        return {
            valid: true
        };
    }
}

module.exports = CloudinaryService; 