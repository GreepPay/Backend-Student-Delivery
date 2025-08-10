# Image Upload API Documentation

## Overview

The Image Upload API provides secure, optimized image upload functionality using Cloudinary for storage and automatic optimization. It supports profile pictures and document uploads with automatic resizing, format conversion, and validation.

## Cloudinary Configuration ✅

Your Cloudinary is now configured and ready with:

- **Cloud Name**: `YOUR_CLOUD_NAME`
- **Storage**: Automatic optimization and WebP conversion
- **Folders**: Organized by type (driver-profiles, documents)
- **Transformations**: Auto-resize to 400x400, face detection cropping

## Endpoints

### 1. Upload Profile Picture

**POST** `/driver/profile-picture`

**Authentication:** Required (Driver token)

**Content-Type:** `multipart/form-data`

**Body:**

- `profilePicture` (file): Image file (JPEG, PNG, WebP)

**Response:**

```json
{
  "success": true,
  "message": "Profile picture uploaded successfully",
  "data": {
    "profilePicture": "https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v1642...jpg",
"optimizedUrl": "https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/w_400,h_400,c_fill,g_face,q_auto:good,f_webp/v1642...jpg",
    "uploadInfo": {
      "width": 400,
      "height": 400,
      "bytes": 45678,
      "public_id": "driver-profiles/673b123..."
    }
  }
}
```

### 2. Upload Document

**POST** `/driver/documents/:documentType/upload`

**Authentication:** Required (Driver token)

**Content-Type:** `multipart/form-data`

**Document Types:**

- `studentId` - Student ID Card
- `profilePhoto` - Profile Photo
- `universityEnrollment` - University Enrollment Certificate
- `identityCard` - Identity Card
- `transportationLicense` - Transportation License (for car/motorcycle)

**Body:**

- File field name should match the document type (e.g., `studentId`, `profilePhoto`)

**Response:**

```json
{
  "success": true,
  "message": "Document uploaded successfully and pending verification",
  "data": {
    "documentType": "studentId",
    "status": "pending",
    "uploadDate": "2025-01-21T12:00:00Z",
    "message": "Document uploaded and pending admin verification"
  }
}
```

## Image Processing Features

### Automatic Optimizations

- ✅ **Resize**: All images resized to 400x400px
- ✅ **Face Detection**: Smart cropping using gravity: face
- ✅ **Format Conversion**: Auto-convert to WebP for smaller file sizes
- ✅ **Quality**: Auto-optimized quality settings
- ✅ **Compression**: Lossless optimization

### Validation Rules

- **File Types**: JPEG, PNG, WebP only
- **File Size**: Maximum 5MB
- **Dimensions**: Any size (auto-resized)
- **Security**: Validated mime types and file headers

### Storage Organization

```
YOUR_CLOUD_NAME.cloudinary.com/
├── driver-profiles/          # Profile pictures
│   ├── 673b123_profile.webp
│   └── 674c456_profile.webp
└── documents/               # Document uploads
    ├── 673b123_studentId.webp
    └── 673b123_identity.webp
```

## Frontend Integration

### Upload Profile Picture

```javascript
// HTML
<input type="file" id="profilePicture" accept="image/*" />;

// JavaScript
const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append("profilePicture", file);

  try {
    const response = await fetch("/api/driver/profile-picture", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${driverToken}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      console.log("✅ Upload successful!");
      console.log("Original URL:", result.data.profilePicture);
      console.log("Optimized URL:", result.data.optimizedUrl);

      // Update UI with new profile picture
      document.getElementById("profileImg").src = result.data.optimizedUrl;
    } else {
      console.error("❌ Upload failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Upload error:", error);
  }
};

// File input change handler
document.getElementById("profilePicture").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadProfilePicture(file);
  }
});
```

### Upload Document

```javascript
const uploadDocument = async (documentType, file) => {
  const formData = new FormData();
  formData.append(documentType, file); // Field name matches document type

  try {
    const response = await fetch(
      `/api/driver/documents/${documentType}/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${driverToken}`,
        },
        body: formData,
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log("✅ Document uploaded successfully!");
      console.log("Status:", result.data.status);

      // Update UI to show pending verification
      updateDocumentStatus(documentType, "pending");
    } else {
      console.error("❌ Upload failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Upload error:", error);
  }
};

// Example usage
const fileInput = document.getElementById("studentIdFile");
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadDocument("studentId", file);
  }
});
```

### React/Vue Example

```javascript
// React Hook for file upload
const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadImage = async (
    file,
    endpoint = "/api/driver/profile-picture"
  ) => {
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("profilePicture", file);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      setUploadProgress(100);

      return result;
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading, uploadProgress };
};
```

## Error Handling

### Common Error Responses

#### 400 - Validation Error

```json
{
  "success": false,
  "error": "Invalid file type. Please upload JPEG, PNG, or WebP images only."
}
```

#### 400 - File Size Error

```json
{
  "success": false,
  "error": "File size too large. Please upload images smaller than 5MB."
}
```

#### 400 - No File

```json
{
  "success": false,
  "error": "No image file provided"
}
```

#### 401 - Authentication Error

```json
{
  "success": false,
  "error": "Access token required"
}
```

#### 500 - Upload Error

```json
{
  "success": false,
  "error": "Failed to upload image: Cloudinary error message"
}
```

## Security Features

### File Validation

- ✅ **Mime Type Check**: Validates actual file type
- ✅ **File Extension**: Checks file extension
- ✅ **File Size Limit**: 5MB maximum
- ✅ **Image Headers**: Validates image file headers

### Access Control

- ✅ **Authentication Required**: Valid driver token needed
- ✅ **User Scoped**: Drivers can only upload to their own profile
- ✅ **Rate Limited**: Cloudinary provides built-in rate limiting

### Data Protection

- ✅ **Secure URLs**: HTTPS-only image URLs
- ✅ **Auto Deletion**: Old profile pictures automatically deleted
- ✅ **Optimized Storage**: Automatic compression and optimization

## Performance Optimizations

### Cloudinary Features

- **Auto Format**: Serves WebP to supported browsers, JPEG to others
- **Auto Quality**: Optimizes quality based on content
- **Responsive Images**: Can generate multiple sizes on-demand
- **CDN Delivery**: Global CDN for fast image loading

### Backend Optimizations

- **Stream Processing**: Images processed as streams (no temp files)
- **Parallel Processing**: Multiple uploads handled concurrently
- **Memory Efficient**: Uses memory storage with immediate upload

### Frontend Best Practices

```javascript
// Optimize image display with responsive URLs
const getResponsiveImageUrl = (baseUrl, width = 400) => {
  if (!baseUrl || !baseUrl.includes("cloudinary.com")) return baseUrl;

  const responsive = baseUrl.replace(
    "/upload/",
    `/upload/w_${width},h_${width},c_fill,g_face,q_auto:good,f_auto/`
  );

  return responsive;
};

// Usage
<img
  src={getResponsiveImageUrl(profilePicture, 200)}
  alt="Profile"
  loading="lazy"
/>;
```

## Testing Your Setup

Your Cloudinary configuration is ready! Test with:

1. **Profile Picture Upload**:

   ```bash
   curl -X POST http://localhost:3001/api/driver/profile-picture \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "profilePicture=@test-image.jpg"
   ```

2. **Document Upload**:
   ```bash
   curl -X POST http://localhost:3001/api/driver/documents/studentId/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "studentId=@student-id-card.jpg"
   ```

## Monitoring and Analytics

### Cloudinary Dashboard

- Access: [cloudinary.com/console](https://cloudinary.com/console)
- Monitor: Upload statistics, bandwidth usage, storage
- Analytics: Popular transformations, format conversions

### Application Logs

- ✅ Upload success/failure logs
- ✅ File validation logs
- ✅ Cloudinary response logs
- ✅ Performance metrics

Your image upload system is now fully configured and ready for production use! 🎉
