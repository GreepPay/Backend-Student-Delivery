# Document Upload Guide - Complete Your Verification

## 📋 **Required Documents for 100% Verification**

Based on your current status (63% profile completion, 20% documents), you need to upload **5 documents** to complete your verification:

### **Required Documents:**

1. **📷 Student ID** - `studentId`
2. **📸 Profile Photo** - `profilePhoto`
3. **🎓 University Enrollment Certificate** - `universityEnrollment`
4. **🆔 Identity Card** - `identityCard`
5. **🚗 Transportation License** - `transportationLicense` (only if using car/motorcycle)

## 🔧 **How to Upload Documents**

### **API Endpoints Available:**

```
POST /api/driver/documents/:documentType/upload
```

### **Valid Document Types:**

- `studentId`
- `profilePhoto`
- `universityEnrollment`
- `identityCard`
- `transportationLicense`

## 📤 **Frontend Implementation**

### **1. Document Upload Form:**

```javascript
// Example React component for document upload
const DocumentUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !documentType) {
      alert("Please select a file and document type");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("document", selectedFile);

    try {
      const response = await fetch(
        `/api/driver/documents/${documentType}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        alert("Document uploaded successfully! Pending verification.");
        // Refresh profile data to update completion percentage
        window.location.reload();
      } else {
        alert("Upload failed: " + data.error);
      }
    } catch (error) {
      alert("Upload error: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="document-upload">
      <h3>Upload Required Documents</h3>

      <div className="upload-section">
        <label>Document Type:</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
        >
          <option value="">Select document type</option>
          <option value="studentId">Student ID</option>
          <option value="profilePhoto">Profile Photo</option>
          <option value="universityEnrollment">
            University Enrollment Certificate
          </option>
          <option value="identityCard">Identity Card</option>
          <option value="transportationLicense">Transportation License</option>
        </select>
      </div>

      <div className="upload-section">
        <label>Select File:</label>
        <input type="file" accept="image/*,.pdf" onChange={handleFileSelect} />
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading || !selectedFile || !documentType}
      >
        {uploading ? "Uploading..." : "Upload Document"}
      </button>
    </div>
  );
};
```

### **2. Document Status Display:**

```javascript
// Component to show document upload status
const DocumentStatus = ({ documents }) => {
  const documentTypes = [
    { key: "studentId", label: "Student ID", required: true },
    { key: "profilePhoto", label: "Profile Photo", required: true },
    {
      key: "universityEnrollment",
      label: "University Enrollment",
      required: true,
    },
    { key: "identityCard", label: "Identity Card", required: true },
    {
      key: "transportationLicense",
      label: "Transportation License",
      required: false,
    },
  ];

  return (
    <div className="document-status">
      <h3>Document Verification Status</h3>

      {documentTypes.map((doc) => (
        <div key={doc.key} className="document-item">
          <div className="document-info">
            <span className="document-name">{doc.label}</span>
            <span
              className={`status ${documents[doc.key]?.status || "pending"}`}
            >
              {documents[doc.key]?.status || "Not uploaded"}
            </span>
          </div>

          {documents[doc.key]?.status === "rejected" && (
            <div className="rejection-reason">
              Reason: {documents[doc.key].rejectionReason}
            </div>
          )}

          {(!documents[doc.key] ||
            documents[doc.key].status === "rejected") && (
            <button onClick={() => handleUploadDocument(doc.key)}>
              Upload {doc.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
```

## 📊 **Current Status Analysis**

### **Your Current Progress:**

- **Profile Completion:** 63% (Personal Details, Student Info, Transportation = 100%)
- **Documents:** 20% (1/5 documents uploaded)
- **Verification:** 33% (1/3 verification steps complete)

### **What You Need to Upload:**

1. **✅ Already Done:** Profile Photo (if uploaded)
2. **❌ Missing:** Student ID
3. **❌ Missing:** University Enrollment Certificate
4. **❌ Missing:** Identity Card
5. **❌ Missing:** Transportation License (if using car/motorcycle)

## 🎯 **Steps to Complete Verification:**

### **Step 1: Upload Student ID**

```bash
POST /api/driver/documents/studentId/upload
Content-Type: multipart/form-data
Authorization: Bearer YOUR_TOKEN

Body: FormData with 'document' file
```

### **Step 2: Upload University Enrollment Certificate**

```bash
POST /api/driver/documents/universityEnrollment/upload
Content-Type: multipart/form-data
Authorization: Bearer YOUR_TOKEN

Body: FormData with 'document' file
```

### **Step 3: Upload Identity Card**

```bash
POST /api/driver/documents/identityCard/upload
Content-Type: multipart/form-data
Authorization: Bearer YOUR_TOKEN

Body: FormData with 'document' file
```

### **Step 4: Upload Transportation License (if applicable)**

```bash
POST /api/driver/documents/transportationLicense/upload
Content-Type: multipart/form-data
Authorization: Bearer YOUR_TOKEN

Body: FormData with 'document' file
```

## 🔍 **Document Status Tracking**

### **Status Values:**

- `pending` - Document uploaded, waiting for admin verification
- `verified` - Document approved by admin
- `rejected` - Document rejected (check rejectionReason)

### **Expected Response:**

```javascript
{
    "success": true,
    "message": "Document uploaded successfully and pending verification",
    "data": {
        "documentType": "studentId",
        "status": "pending",
        "uploadDate": "2025-01-15T10:30:00.000Z"
    }
}
```

## ⚠️ **Important Notes:**

### **File Requirements:**

- **Accepted formats:** JPEG, PNG, WebP, PDF
- **File size limit:** 5MB per document
- **Image optimization:** Automatically processed by Cloudinary

### **Verification Process:**

1. **Upload document** → Status becomes `pending`
2. **Admin reviews** → Status changes to `verified` or `rejected`
3. **If rejected** → Check `rejectionReason` and re-upload
4. **All documents verified** → Profile completion increases

### **Profile Completion Impact:**

- Each verified document increases your completion percentage
- All 5 documents verified = 100% document completion
- Combined with other sections = 100% overall profile completion

## 🚀 **Quick Start:**

1. **Add document upload UI** to your frontend
2. **Implement file selection** and upload functionality
3. **Show document status** with upload buttons for missing documents
4. **Handle upload responses** and update UI accordingly
5. **Refresh profile data** after successful uploads

Once you upload all required documents and they're verified by an admin, your profile completion will reach 100% and you'll be ready for deliveries! 🎯
