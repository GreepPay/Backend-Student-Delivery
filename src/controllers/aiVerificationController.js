const Driver = require('../models/Driver');
const { catchAsync, successResponse, errorResponse } = require('../middleware/errorHandler');
const CloudinaryService = require('../services/cloudinaryService');

class AIVerificationController {
    // Complete verification pipeline
    static verifyDocument = catchAsync(async (req, res) => {
        const { documentType, documentUrl, driverId } = req.body;

        try {
            console.log('🤖 AI Verification Pipeline Started:', { documentType, driverId });

            // Step 1: Classify document
            const classification = await this.classifyDocument(documentUrl, documentType);

            // Step 2: Extract text (OCR)
            const extractedText = await this.extractTextFromDocument(documentUrl);

            // Step 3: Detect face (for ID cards and profile photos)
            const faceDetection = documentType === 'identityCard' || documentType === 'profilePhoto'
                ? await this.detectFaceInDocument(documentUrl)
                : { facesDetected: 0, confidence: 0 };

            // Step 4: Verify authenticity
            const authenticity = await this.verifyDocumentAuthenticity(documentUrl, documentType);

            // Step 5: Detect fraud
            const fraudDetection = await this.detectDocumentFraud(documentUrl, documentType);

            // Step 6: Determine overall verification result
            const verificationResult = this.determineVerificationResult({
                classification,
                extractedText,
                faceDetection,
                authenticity,
                fraudDetection,
                documentType
            });

            // Step 7: Update driver document status
            const driver = await Driver.findById(driverId);
            if (driver) {
                if (!driver.documents) driver.documents = {};
                if (!driver.documents[documentType]) driver.documents[documentType] = {};

                driver.documents[documentType] = {
                    status: verificationResult.verified ? 'verified' : 'rejected',
                    uploadDate: new Date(),
                    verificationDate: new Date(),
                    rejectionReason: verificationResult.verified ? undefined : verificationResult.reason,
                    aiVerification: {
                        classification: classification,
                        extractedText: extractedText,
                        faceDetection: faceDetection,
                        authenticity: authenticity,
                        fraudDetection: fraudDetection,
                        confidence: verificationResult.confidence
                    }
                };

                driver.markModified('documents');
                await driver.save();

                console.log('✅ AI Verification completed for driver:', driverId);
            }

            successResponse(res, {
                documentType,
                driverId,
                verified: verificationResult.verified,
                confidence: verificationResult.confidence,
                reason: verificationResult.reason,
                details: {
                    classification,
                    extractedText,
                    faceDetection,
                    authenticity,
                    fraudDetection
                }
            }, 'AI verification completed successfully');

        } catch (error) {
            console.error('AI Verification Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Document classification
    static classifyDocument = catchAsync(async (req, res) => {
        const { documentUrl, expectedType } = req.body;

        try {
            console.log('🔍 AI Document Classification:', { documentUrl, expectedType });

            const classification = await this.performDocumentClassification(documentUrl, expectedType);

            successResponse(res, {
                documentUrl,
                expectedType,
                classifiedType: classification.type,
                confidence: classification.confidence,
                isCorrect: classification.type === expectedType
            }, 'Document classification completed');

        } catch (error) {
            console.error('Document Classification Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // OCR text extraction
    static extractText = catchAsync(async (req, res) => {
        const { documentUrl, documentType } = req.body;

        try {
            console.log('📝 AI Text Extraction:', { documentUrl, documentType });

            const extractedText = await this.performTextExtraction(documentUrl, documentType);

            successResponse(res, {
                documentUrl,
                documentType,
                extractedText: extractedText.text,
                confidence: extractedText.confidence,
                fields: extractedText.fields
            }, 'Text extraction completed');

        } catch (error) {
            console.error('Text Extraction Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Face detection
    static detectFace = catchAsync(async (req, res) => {
        const { documentUrl, documentType } = req.body;

        try {
            console.log('👤 AI Face Detection:', { documentUrl, documentType });

            const faceDetection = await this.performFaceDetection(documentUrl, documentType);

            successResponse(res, {
                documentUrl,
                documentType,
                facesDetected: faceDetection.facesDetected,
                confidence: faceDetection.confidence,
                faceQuality: faceDetection.quality,
                isAcceptable: faceDetection.isAcceptable
            }, 'Face detection completed');

        } catch (error) {
            console.error('Face Detection Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Authenticity verification
    static verifyAuthenticity = catchAsync(async (req, res) => {
        const { documentUrl, documentType } = req.body;

        try {
            console.log('🔐 AI Authenticity Verification:', { documentUrl, documentType });

            const authenticity = await this.performAuthenticityVerification(documentUrl, documentType);

            successResponse(res, {
                documentUrl,
                documentType,
                isAuthentic: authenticity.isAuthentic,
                confidence: authenticity.confidence,
                securityFeatures: authenticity.securityFeatures,
                tamperingDetected: authenticity.tamperingDetected
            }, 'Authenticity verification completed');

        } catch (error) {
            console.error('Authenticity Verification Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Fraud detection
    static detectFraud = catchAsync(async (req, res) => {
        const { documentUrl, documentType } = req.body;

        try {
            console.log('🚨 AI Fraud Detection:', { documentUrl, documentType });

            const fraudDetection = await this.performFraudDetection(documentUrl, documentType);

            successResponse(res, {
                documentUrl,
                documentType,
                fraudDetected: fraudDetection.fraudDetected,
                confidence: fraudDetection.confidence,
                fraudType: fraudDetection.fraudType,
                riskLevel: fraudDetection.riskLevel
            }, 'Fraud detection completed');

        } catch (error) {
            console.error('Fraud Detection Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Status checking
    static getVerificationStatus = catchAsync(async (req, res) => {
        const { id } = req.params;

        try {
            console.log('📊 AI Verification Status Check:', { id });

            // In a real implementation, this would check against an AI service queue
            // For now, we'll simulate status checking
            const status = await this.getVerificationStatusById(id);

            successResponse(res, {
                verificationId: id,
                status: status.status,
                progress: status.progress,
                estimatedCompletion: status.estimatedCompletion,
                results: status.results
            }, 'Verification status retrieved');

        } catch (error) {
            console.error('Status Check Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Batch verification
    static verifyBatch = catchAsync(async (req, res) => {
        const { documents } = req.body;

        try {
            console.log('📦 AI Batch Verification:', { documentCount: documents.length });

            const batchResults = [];

            for (const doc of documents) {
                const result = await this.verifyDocument({
                    body: {
                        documentType: doc.documentType,
                        documentUrl: doc.documentUrl,
                        driverId: doc.driverId
                    }
                }, { status: () => ({ json: () => { } }) });

                batchResults.push({
                    documentId: doc.documentId,
                    driverId: doc.driverId,
                    documentType: doc.documentType,
                    verified: result.verified,
                    confidence: result.confidence,
                    reason: result.reason
                });
            }

            successResponse(res, {
                totalDocuments: documents.length,
                processedDocuments: batchResults.length,
                results: batchResults,
                summary: {
                    verified: batchResults.filter(r => r.verified).length,
                    rejected: batchResults.filter(r => !r.verified).length,
                    averageConfidence: batchResults.reduce((sum, r) => sum + r.confidence, 0) / batchResults.length
                }
            }, 'Batch verification completed');

        } catch (error) {
            console.error('Batch Verification Error:', error);
            errorResponse(res, error, 500);
        }
    });

    // Helper methods for AI processing (simulated for now)
    static async performDocumentClassification(documentUrl, expectedType) {
        // Simulate AI classification
        const types = ['studentId', 'profilePhoto', 'universityEnrollment', 'identityCard', 'transportationLicense'];
        const detectedType = types[Math.floor(Math.random() * types.length)];

        return {
            type: detectedType,
            confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
            isCorrect: detectedType === expectedType
        };
    }

    static async performTextExtraction(documentUrl, documentType) {
        // Simulate OCR text extraction
        const sampleTexts = {
            studentId: 'Student ID: 20230001\nName: John Doe\nUniversity: EMU',
            identityCard: 'ID Card\nName: John Doe\nDOB: 1995-01-01\nID: TR123456789',
            universityEnrollment: 'Enrollment Certificate\nStudent: John Doe\nProgram: Computer Science',
            transportationLicense: 'Driver License\nName: John Doe\nLicense: TR123456789',
            profilePhoto: 'Profile Photo - No text to extract'
        };

        return {
            text: sampleTexts[documentType] || 'Text extracted from document',
            confidence: Math.random() * 0.2 + 0.8, // 80-100% confidence
            fields: {
                name: 'John Doe',
                id: '20230001',
                university: 'EMU'
            }
        };
    }

    static async performFaceDetection(documentUrl, documentType) {
        // Simulate face detection
        const facesDetected = documentType === 'profilePhoto' ? 1 :
            documentType === 'identityCard' ? 1 : 0;

        return {
            facesDetected,
            confidence: Math.random() * 0.2 + 0.8,
            quality: 'high',
            isAcceptable: facesDetected > 0
        };
    }

    static async performAuthenticityVerification(documentUrl, documentType) {
        // Simulate authenticity verification
        return {
            isAuthentic: Math.random() > 0.1, // 90% authentic
            confidence: Math.random() * 0.2 + 0.8,
            securityFeatures: ['watermark', 'hologram', 'microtext'],
            tamperingDetected: false
        };
    }

    static async performFraudDetection(documentUrl, documentType) {
        // Simulate fraud detection
        const fraudDetected = Math.random() > 0.95; // 5% fraud rate

        return {
            fraudDetected,
            confidence: Math.random() * 0.2 + 0.8,
            fraudType: fraudDetected ? 'digital_manipulation' : null,
            riskLevel: fraudDetected ? 'high' : 'low'
        };
    }

    static async getVerificationStatusById(id) {
        // Simulate status checking
        return {
            status: 'completed',
            progress: 100,
            estimatedCompletion: new Date(),
            results: {
                verified: true,
                confidence: 0.95
            }
        };
    }

    static determineVerificationResult(aiResults) {
        const { classification, extractedText, faceDetection, authenticity, fraudDetection, documentType } = aiResults;

        // Calculate overall confidence
        const confidences = [
            classification.confidence,
            extractedText.confidence,
            faceDetection.confidence,
            authenticity.confidence,
            fraudDetection.confidence
        ].filter(c => c > 0);

        const averageConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

        // Determine verification result
        let verified = true;
        let reason = null;

        // Check classification accuracy
        if (!classification.isCorrect) {
            verified = false;
            reason = 'Document type mismatch';
        }

        // Check face detection for relevant documents
        if ((documentType === 'profilePhoto' || documentType === 'identityCard') && !faceDetection.isAcceptable) {
            verified = false;
            reason = 'No clear face detected';
        }

        // Check authenticity
        if (!authenticity.isAuthentic) {
            verified = false;
            reason = 'Document authenticity verification failed';
        }

        // Check fraud detection
        if (fraudDetection.fraudDetected) {
            verified = false;
            reason = 'Potential fraud detected';
        }

        // Minimum confidence threshold
        if (averageConfidence < 0.7) {
            verified = false;
            reason = 'Low confidence in AI verification';
        }

        return {
            verified,
            confidence: averageConfidence,
            reason
        };
    }
}

module.exports = AIVerificationController;
