const axios = require('axios');

class AIVerificationService {
    constructor() {
        this.apiKey = process.env.AI_VERIFICATION_API_KEY;
        this.apiUrl = process.env.AI_VERIFICATION_API_URL || 'https://api.openai.com/v1/chat/completions';
        this.enabled = process.env.AI_VERIFICATION_ENABLED === 'true';
    }

    /**
     * Verify a document using AI analysis
     * @param {string} documentUrl - URL of the document to verify
     * @param {string} documentType - Type of document (studentId, profilePhoto, etc.)
     * @returns {Promise<Object>} Verification result
     */
    async verifyDocument(documentUrl, documentType) {
        try {
            if (!this.enabled) {
                console.log('🤖 AI verification is disabled, returning mock result');
                return this.getMockVerificationResult(documentType);
            }

            if (!this.apiKey) {
                console.log('🤖 No AI API key configured, returning mock result');
                return this.getMockVerificationResult(documentType);
            }

            console.log(`🤖 Starting AI verification for ${documentType} document:`, documentUrl);

            // Analyze the document based on its type
            const analysisResult = await this.analyzeDocument(documentUrl, documentType);

            // Process the analysis result
            const verificationResult = this.processAnalysisResult(analysisResult, documentType);

            console.log(`✅ AI verification completed for ${documentType}:`, verificationResult);

            return verificationResult;

        } catch (error) {
            console.error(`❌ AI verification failed for ${documentType}:`, error);

            // Return a safe fallback result
            return {
                isValid: false,
                confidence: 0,
                reason: `AI verification failed: ${error.message}`,
                analysis: null,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Analyze a document using AI
     * @param {string} documentUrl - URL of the document
     * @param {string} documentType - Type of document
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeDocument(documentUrl, documentType) {
        const prompts = {
            studentId: `Analyze this student ID document. Check for:
1. Legibility and clarity of text
2. Presence of student ID number
3. University name and logo
4. Expiration date validity
5. Overall document authenticity
6. Any signs of tampering or forgery

Return a JSON response with:
- isValid: boolean
- confidence: number (0-100)
- reason: string explaining the result
- details: object with specific findings`,

            profilePhoto: `Analyze this profile photo. Check for:
1. Face clarity and visibility
2. Professional appearance
3. Appropriate background
4. Image quality and resolution
5. No inappropriate content
6. Matches driver profile requirements

Return a JSON response with:
- isValid: boolean
- confidence: number (0-100)
- reason: string explaining the result
- details: object with specific findings`,

            passportPhoto: `Analyze this passport photo or national identity card. Check for:
1. Government-issued format (passport or national ID)
2. Clear photo and personal details
3. Valid expiration date (if applicable)
4. Security features and watermarks
5. Document authenticity
6. No signs of tampering or alteration
7. Proper lighting and image quality

Return a JSON response with:
- isValid: boolean
- confidence: number (0-100)
- reason: string explaining the result
- details: object with specific findings`,


        };

        const prompt = prompts[documentType] || prompts.studentId;

        const response = await axios.post(this.apiUrl, {
            model: 'gpt-4-vision-preview',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: documentUrl
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const analysisText = response.data.choices[0].message.content;

        // Try to parse JSON from the response
        try {
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (parseError) {
            console.log('Failed to parse AI response as JSON, using text analysis');
        }

        // Fallback: analyze the text response
        return this.analyzeTextResponse(analysisText, documentType);
    }

    /**
     * Analyze text response when JSON parsing fails
     * @param {string} text - AI response text
     * @param {string} documentType - Type of document
     * @returns {Object} Analysis result
     */
    analyzeTextResponse(text, documentType) {
        const lowerText = text.toLowerCase();

        // Look for positive indicators
        const positiveIndicators = ['valid', 'authentic', 'genuine', 'legitimate', 'clear', 'good', 'acceptable'];
        const negativeIndicators = ['invalid', 'fake', 'forged', 'tampered', 'unclear', 'poor', 'unacceptable'];

        const positiveCount = positiveIndicators.filter(indicator => lowerText.includes(indicator)).length;
        const negativeCount = negativeIndicators.filter(indicator => lowerText.includes(indicator)).length;

        const isValid = positiveCount > negativeCount;
        const confidence = Math.min(100, Math.max(0, (positiveCount - negativeCount) * 20 + 50));

        return {
            isValid,
            confidence,
            reason: isValid ? 'Document appears valid based on AI analysis' : 'Document appears invalid based on AI analysis',
            details: {
                positiveIndicators: positiveCount,
                negativeIndicators: negativeCount,
                analysis: text
            }
        };
    }

    /**
     * Process the analysis result into a standardized format
     * @param {Object} analysisResult - Raw analysis result
     * @param {string} documentType - Type of document
     * @returns {Object} Standardized verification result
     */
    processAnalysisResult(analysisResult, documentType) {
        return {
            isValid: analysisResult.isValid || false,
            confidence: analysisResult.confidence || 0,
            reason: analysisResult.reason || 'No specific reason provided',
            analysis: analysisResult.details || analysisResult,
            documentType,
            timestamp: new Date().toISOString(),
            verifiedBy: 'ai'
        };
    }

    /**
     * Get a mock verification result for testing
     * @param {string} documentType - Type of document
     * @returns {Object} Mock verification result
     */
    getMockVerificationResult(documentType) {
        const mockResults = {
            studentId: {
                isValid: true,
                confidence: 85,
                reason: 'Student ID appears valid with clear university branding and student information',
                analysis: {
                    universityName: 'Cyprus West University',
                    studentIdNumber: '20223056',
                    expirationDate: '2025-12-31',
                    authenticity: 'high'
                }
            },
            profilePhoto: {
                isValid: true,
                confidence: 90,
                reason: 'Profile photo meets requirements with clear face visibility and professional appearance',
                analysis: {
                    faceClarity: 'excellent',
                    background: 'appropriate',
                    quality: 'high',
                    professional: true
                }
            },
            passportPhoto: {
                isValid: true,
                confidence: 94,
                reason: 'Passport photo appears to be a valid government-issued document',
                analysis: {
                    documentType: 'Passport/National ID',
                    expirationDate: '2028-05-15',
                    securityFeatures: 'present',
                    authenticity: 'verified',
                    photoQuality: 'clear'
                }
            },

        };

        const result = mockResults[documentType] || mockResults.studentId;

        return {
            ...result,
            documentType,
            timestamp: new Date().toISOString(),
            verifiedBy: 'ai_mock'
        };
    }

    /**
     * Verify multiple documents in batch
     * @param {Array} documents - Array of {documentUrl, documentType} objects
     * @returns {Promise<Array>} Array of verification results
     */
    async verifyDocumentsBatch(documents) {
        const results = [];

        for (const document of documents) {
            try {
                const result = await this.verifyDocument(document.documentUrl, document.documentType);
                results.push({
                    ...result,
                    documentUrl: document.documentUrl
                });
            } catch (error) {
                results.push({
                    documentUrl: document.documentUrl,
                    documentType: document.documentType,
                    isValid: false,
                    confidence: 0,
                    reason: `Verification failed: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return results;
    }
}

module.exports = new AIVerificationService();
