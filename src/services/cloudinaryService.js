const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

// Cloudinary Service for image upload management

// Configure Cloudinary with environment variables only
const cloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
};

cloudinary.config(cloudinaryConfig);

// Verify configuration
const isCloudinaryReady = () => {
    return !!(cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret);
};

if (isCloudinaryReady()) {
    console.log('✅ Cloudinary configured successfully with cloud:', cloudinaryConfig.cloud_name);
} else {
    console.warn('⚠️  Cloudinary configuration incomplete');
}

class CloudinaryService {
    // Upload image with compression and optimization
    static async uploadImage(file, folder = 'driver-profiles') {
        try {
            // Check if Cloudinary is ready
            if (!isCloudinaryReady()) {
                throw new Error('Cloudinary configuration is incomplete');
            }

            console.log('📸 Uploading image to Cloudinary...');

            // Convert buffer to stream
            const stream = Readable.from(file.buffer);

            // Upload with optimization settings (no preset needed)
            const result = await new Promise((resolve, reject) => {
                const uploadOptions = {
                    folder: folder,
                    resource_type: 'auto', // Let Cloudinary detect the resource type
                    use_filename: true,
                    unique_filename: true,
                    overwrite: false,
                    // Apply transformations after upload
                    eager: [
                        { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto:good', fetch_format: 'auto' }
                    ],
                    eager_async: true // Process transformations asynchronously
                };

                const uploadStream = cloudinary.uploader.upload_stream(
                    uploadOptions,
                    (error, result) => {
                        if (error) {
                            console.error('Cloudinary upload stream error:', error);
                            reject(error);
                        } else {
                            console.log('✅ Upload successful to Cloudinary:', result.public_id);
                            resolve(result);
                        }
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
            // Skip deletion for demo images
            if (publicId && publicId.startsWith('demo_')) {
                console.log('📸 Demo mode: Skipping image deletion for:', publicId);
                return {
                    success: true,
                    result: 'demo_skipped'
                };
            }

            // Check if Cloudinary is ready
            if (!isCloudinaryReady()) {
                console.warn('⚠️  Cloudinary not configured, skipping image deletion');
                return {
                    success: true,
                    result: 'skipped_no_config'
                };
            }

            const result = await cloudinary.uploader.destroy(publicId);
            console.log('✅ Image deleted from Cloudinary:', publicId);
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