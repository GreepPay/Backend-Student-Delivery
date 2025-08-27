const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.zeptomail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.ZEPTO_MAIL_USER,
        pass: process.env.ZEPTO_MAIL_PASSWORD
      }
    });
  }

  // Test email connection
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('📧 Email service is ready');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error.message);
      return false;
    }
  }

  // Send OTP email
  async sendOTP(email, otp, userType) {
    const subject = 'Your Login OTP - Student Delivery System';
    const html = this.getOTPTemplate(otp, userType);

    try {
      // For development mode, always log OTP to console instead of sending email
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔐 DEVELOPMENT OTP for ${email} (${userType}): ${otp}`);
        console.log(`📧 Would send email to: ${email}`);
        return { success: true, messageId: 'dev-otp-' + Date.now() };
      }

      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Student Delivery'}" <${process.env.ZEPTO_MAIL_USER}>`,
        to: email,
        subject,
        html
      });

      console.log(`📧 OTP sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send OTP:', error.message);
      throw new Error('Failed to send OTP email');
    }
  }

  // Send driver invitation email
  async sendDriverInvitation(email, name, invitedBy) {
    const subject = 'Welcome to Student Delivery Team!';
    const html = this.getDriverInvitationTemplate(name, invitedBy);

    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Student Delivery'}" <${process.env.ZEPTO_MAIL_USER}>`,
        to: email,
        subject,
        html
      });

      console.log(`📧 Driver invitation sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send driver invitation:', error.message);
      throw new Error('Failed to send invitation email');
    }
  }

  // Send driver invitation email (new OTP-based system)
  async sendDriverInvitationEmail(emailData) {
    const { name, activationLink, supportWhatsApp, supportInstagram, expiresAt } = emailData.data;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Welcome to Greep SDS</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              .steps { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .step { margin: 10px 0; padding: 10px; background: #f3f4f6; border-radius: 4px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🚀 Welcome to Greep SDS!</h1>
                  <p>You've been invited to join our delivery team</p>
              </div>
              
              <div class="content">
                  <h2>Hi ${name},</h2>
                  
                  <p>You've been invited to join <strong>Greep SDS</strong> as a delivery driver!</p>
                  
                  <p>To activate your account and start accepting delivery requests, please follow these steps:</p>
                  
                  <div class="steps">
                      <div class="step">1. <strong>Click the activation link below</strong></div>
                      <div class="step">2. <strong>Set your password</strong></div>
                      <div class="step">3. <strong>Complete your profile information</strong></div>
                      <div class="step">4. <strong>Upload required documents</strong></div>
                      <div class="step">5. <strong>Start accepting deliveries!</strong></div>
                  </div>
                  
                  <div style="text-align: center;">
                      <a href="${activationLink}" class="button">Activate Your Account</a>
                  </div>
                  
                  <p><strong>Important:</strong> This invitation expires on <strong>${expiresAt}</strong></p>
                  
                  <p>If you have any questions or need assistance, contact us:</p>
                  <ul>
                      <li>📱 WhatsApp: <strong>${supportWhatsApp}</strong></li>
                      <li>📸 Instagram: <strong>${supportInstagram}</strong></li>
                  </ul>
                  
                  <p>Welcome to the team!</p>
                  
                  <p>Best regards,<br>
                  <strong>Greep SDS Team</strong></p>
              </div>
              
              <div class="footer">
                  <p>This is an automated message. Please do not reply to this email.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const textContent = `
Welcome to Greep SDS!

Hi ${name},

You've been invited to join Greep SDS as a delivery driver!

To activate your account and start accepting delivery requests, please:

1. Click this activation link: ${activationLink}
2. Set your password
3. Complete your profile information
4. Upload required documents
5. Start accepting deliveries!

Important: This invitation expires on ${expiresAt}

If you have any questions, contact us:
- WhatsApp: ${supportWhatsApp}
- Instagram: ${supportInstagram}

Welcome to the team!

Best regards,
Greep SDS Team
    `;

    try {
      // For development without email credentials, log email details instead of sending
      if (process.env.NODE_ENV === 'development' && !process.env.ZEPTO_MAIL_USER) {
        console.log(`📧 DEVELOPMENT: Driver invitation email would be sent to ${emailData.to}`);
        console.log(`📧 Subject: ${emailData.subject}`);
        console.log(`📧 Activation Link: ${activationLink}`);
        return { success: true, messageId: 'dev-invitation-' + Date.now() };
      }

      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Greep SDS'}" <${process.env.ZEPTO_MAIL_USER}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: htmlContent,
        text: textContent
      });

      console.log(`📧 Driver invitation email sent to ${emailData.to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send driver invitation email:', error.message);
      throw new Error('Failed to send invitation email');
    }
  }

  // Send driver welcome email (new OTP-based system)
  async sendDriverWelcomeEmail(emailData) {
    const { name, loginUrl, supportWhatsApp, supportInstagram } = emailData.data;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Welcome to Greep SDS - Account Ready!</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              .success { background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎉 Welcome to Greep SDS!</h1>
                  <p>Your account is ready to go</p>
              </div>
              
              <div class="content">
                  <h2 class="capitalize">Hi ${name},</h2>
                  
                  <div class="success">
                      <h3>✅ Your account has been successfully activated!</h3>
                      <p>You're now ready to start accepting delivery requests and earning money.</p>
                  </div>
                  
                  <p>Here's what you can do now:</p>
                  <ul>
                      <li>📱 <strong>Log in to your account</strong> and complete your profile</li>
                      <li>📋 <strong>Upload required documents</strong> for verification</li>
                      <li>🚚 <strong>Start accepting deliveries</strong> in your area</li>
                      <li>💰 <strong>Earn money</strong> for each successful delivery</li>
                  </ul>
                  
                  <div style="text-align: center;">
                      <a href="${loginUrl}" class="button">Log In to Your Account</a>
                  </div>
                  
                  <p><strong>Need help?</strong> Our support team is here for you:</p>
                  <ul>
                      <li>📱 WhatsApp: <strong>${supportWhatsApp}</strong></li>
                      <li>📸 Instagram: <strong>${supportInstagram}</strong></li>
                  </ul>
                  
                  <p>Welcome to the Greep SDS family!</p>
                  
                  <p>Best regards,<br>
                  <strong>Greep SDS Team</strong></p>
              </div>
              
              <div class="footer">
                  <p>This is an automated message. Please do not reply to this email.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const textContent = `
Welcome to Greep SDS - Account Ready!

Hi ${name},

✅ Your account has been successfully activated!

You're now ready to start accepting delivery requests and earning money.

Here's what you can do now:
- Log in to your account and complete your profile
- Upload required documents for verification
- Start accepting deliveries in your area
- Earn money for each successful delivery

Log in to your account: ${loginUrl}

Need help? Our support team is here for you:
- WhatsApp: ${supportWhatsApp}
- Instagram: ${supportInstagram}

Welcome to the Greep SDS family!

Best regards,
Greep SDS Team
    `;

    try {
      // For development without email credentials, log email details instead of sending
      if (process.env.NODE_ENV === 'development' && !process.env.ZEPTO_MAIL_USER) {
        console.log(`📧 DEVELOPMENT: Driver welcome email would be sent to ${emailData.to}`);
        console.log(`📧 Subject: ${emailData.subject}`);
        console.log(`📧 Login URL: ${loginUrl}`);
        return { success: true, messageId: 'dev-welcome-' + Date.now() };
      }

      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Greep SDS'}" <${process.env.ZEPTO_MAIL_USER}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: htmlContent,
        text: textContent
      });

      console.log(`📧 Driver welcome email sent to ${emailData.to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send driver welcome email:', error.message);
      throw new Error('Failed to send welcome email');
    }
  }

  // Send admin invitation email
  async sendAdminInvitation(email, name, invitedBy) {
    const subject = 'Welcome to Student Delivery Admin Team!';
    const html = this.getAdminInvitationTemplate(name, invitedBy);

    console.log('🔍 Debug: Admin invitation template generated for:', name);
    console.log('🔍 Debug: Template preview (first 200 chars):', html.substring(0, 200));

    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Student Delivery'}" <${process.env.ZEPTO_MAIL_USER}>`,
        to: email,
        subject,
        html
      });

      console.log(`📧 Admin invitation sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send admin invitation:', error.message);
      throw new Error('Failed to send admin invitation email');
    }
  }

  // Send delivery assignment notification
  async sendDeliveryAssignment(driverEmail, driverName, delivery) {
    const subject = `New Delivery Assignment - ${delivery.deliveryCode}`;
    const html = this.getDeliveryAssignmentTemplate(driverName, delivery);

    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Student Delivery'}" <${process.env.ZEPTO_MAIL_USER}>`,
        to: driverEmail,
        subject,
        html
      });

      console.log(`📧 Delivery assignment sent to ${driverEmail}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send delivery assignment:', error.message);
      // Don't throw error for delivery assignments as it's not critical
      return { success: false, error: error.message };
    }
  }

  // Send delivery unassignment notification
  async sendDeliveryUnassignment(driverEmail, driverName, delivery) {
    const subject = `Delivery Unassigned - ${delivery.deliveryCode}`;
    const html = this.getDeliveryUnassignmentTemplate(driverName, delivery);

    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Student Delivery'}" <${process.env.ZEPTO_MAIL_USER}>`,
        to: driverEmail,
        subject,
        html
      });

      console.log(`📧 Delivery unassignment sent to ${driverEmail}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send delivery unassignment:', error.message);
      // Don't throw error for delivery unassignments as it's not critical
      return { success: false, error: error.message };
    }
  }

  // Send monthly earnings report
  async sendMonthlyReport(driverEmail, driverName, reportData) {
    const subject = `Monthly Earnings Report - ${reportData.month}/${reportData.year}`;
    const html = this.getMonthlyReportTemplate(driverName, reportData);

    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Student Delivery'}" <${process.env.ZEPTO_MAIL_USER}>`,
        to: driverEmail,
        subject,
        html
      });

      console.log(`📧 Monthly report sent to ${driverEmail}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send monthly report:', error.message);
      return { success: false, error: error.message };
    }
  }

  // OTP Email Template
  getOTPTemplate(otp, userType) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-box { background: white; border: 2px solid #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Student Delivery System</h1>
            <p>Secure Login Verification</p>
          </div>
          <div class="content">
            <h2>Hello ${userType === 'admin' ? 'Admin' : 'Driver'}!</h2>
            <p>You requested to login to your Student Delivery System account. Please use the OTP code below:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <p><strong>This code expires in 10 minutes</strong></p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this OTP with anyone. Our team will never ask for your OTP.
            </div>
            
            <p>If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>© 2025 Student Delivery System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Driver Invitation Template
  getDriverInvitationTemplate(name, invitedBy) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px; }
          .welcome-box { background: white; border: 2px solid #10b981; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .benefits { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .benefit-item { margin: 10px 0; padding: 10px; background: #ecfdf5; border-radius: 6px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to the Team!</h1>
            <p>Student Delivery System</p>
          </div>
          <div class="content">
            <div class="welcome-box">
              <h2>Hello ${name}!</h2>
              <p><strong>Congratulations! You've been added as a delivery driver.</strong></p>
              <p>Added by: ${invitedBy}</p>
            </div>
            
            <div class="benefits">
              <h3>🚀 What you can expect:</h3>
              <div class="benefit-item">💰 <strong>Earn 100₺ per delivery</strong> - Keep 100₺ from each 150₺ delivery fee</div>
              <div class="benefit-item">📱 <strong>Flexible Schedule</strong> - Work when it suits your student life</div>
              <div class="benefit-item">📊 <strong>Track Your Progress</strong> - Monitor your earnings and delivery stats</div>
              <div class="benefit-item">🎯 <strong>Area-Based Work</strong> - Deliveries in your preferred area</div>
              <div class="benefit-item">👥 <strong>Student Community</strong> - Join other student drivers</div>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Use this email address to login to your driver dashboard</li>
              <li>You'll receive an OTP code for secure login</li>
              <li>Complete your profile setup</li>
              <li>Start receiving delivery assignments!</li>
            </ol>
            
            <p>Welcome aboard and happy delivering! 🚀</p>
          </div>
          <div class="footer">
            <p>© 2025 Student Delivery System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Admin Invitation Template
  getAdminInvitationTemplate(name, invitedBy) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #faf5ff; padding: 30px; border-radius: 0 0 8px 8px; }
          .welcome-box { background: white; border: 2px solid #7c3aed; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .benefits { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .benefit-item { margin: 10px 0; padding: 10px; background: #f3e8ff; border-radius: 6px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Admin Team!</h1>
            <p>Student Delivery System</p>
          </div>
          <div class="content">
            <div class="welcome-box">
              <h2>Hello ${name}!</h2>
              <p><strong>Congratulations! You've been added as a platform administrator.</strong></p>
              <p>Added by: ${invitedBy}</p>
            </div>
            
            <div class="benefits">
              <h3>🔧 What you can do:</h3>
              <div class="benefit-item">📦 <strong>Manage Deliveries</strong> - Create, edit, and track all deliveries</div>
              <div class="benefit-item">👥 <strong>Manage Drivers</strong> - Add, edit, and monitor driver accounts</div>
              <div class="benefit-item">📊 <strong>View Analytics</strong> - Access detailed system reports and insights</div>
              <div class="benefit-item">💰 <strong>Earnings Management</strong> - Configure driver earnings and rules</div>
              <div class="benefit-item">🔔 <strong>System Notifications</strong> - Send announcements to drivers</div>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Use this email address to login to your admin dashboard</li>
              <li>You'll receive an OTP code for secure login</li>
              <li>Complete your profile setup</li>
              <li>Start managing the platform!</li>
            </ol>
            
            <p>Welcome to the admin team! 🚀</p>
          </div>
          <div class="footer">
            <p>© 2025 Student Delivery System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Delivery Assignment Template
  getDeliveryAssignmentTemplate(driverName, delivery) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fffbeb; padding: 30px; border-radius: 0 0 8px 8px; }
          .delivery-box { background: white; border: 2px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px; background: #fef3c7; border-radius: 4px; }
          .earning-highlight { background: #10b981; color: white; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 New Delivery Assignment</h1>
            <p>You've got a new delivery!</p>
          </div>
          <div class="content">
            <h2>Hi ${driverName}!</h2>
            <p>You have been assigned a new delivery. Here are the details:</p>
            
            <div class="delivery-box">
              <h3>Delivery ${delivery.deliveryCode}</h3>
              <div class="detail-row">
                <strong>Pickup:</strong>
                <span>${delivery.pickupLocation}</span>
              </div>
              <div class="detail-row">
                <strong>Delivery:</strong>
                <span>${delivery.deliveryLocation}</span>
              </div>
              <div class="detail-row">
                <strong>Customer:</strong>
                <span>${delivery.customerName || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <strong>Phone:</strong>
                <span>${delivery.customerPhone || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <strong>Payment:</strong>
                <span>${delivery.paymentMethod.toUpperCase()}</span>
              </div>
              ${delivery.notes ? `<div class="detail-row"><strong>Notes:</strong><span>${delivery.notes}</span></div>` : ''}
            </div>
            
            <div class="earning-highlight">
              <h3>💰 You'll earn: ${delivery.driverEarning}₺</h3>
            </div>
            
            <p><strong>Please:</strong></p>
            <ul>
              <li>Login to your dashboard to confirm and track the delivery</li>
              <li>Contact the customer if needed</li>
              <li>Update the status once picked up and delivered</li>
              <li>Collect the payment as specified</li>
            </ul>
            
            <p>Good luck with your delivery! 🚀</p>
          </div>
          <div class="footer">
            <p>© 2025 Student Delivery System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Delivery Unassignment Template
  getDeliveryUnassignmentTemplate(driverName, delivery) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fef2f2; padding: 30px; border-radius: 0 0 8px 8px; }
          .delivery-box { background: white; border: 2px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px; background: #fee2e2; border-radius: 4px; }
          .notice-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Delivery Unassigned</h1>
            <p>Delivery has been removed from your account</p>
          </div>
          <div class="content">
            <h2>Hi ${driverName}!</h2>
            <p>The following delivery has been unassigned from your account:</p>
            
            <div class="delivery-box">
              <h3>Delivery ${delivery.deliveryCode}</h3>
              <div class="detail-row">
                <strong>Pickup:</strong>
                <span>${delivery.pickupLocation}</span>
              </div>
              <div class="detail-row">
                <strong>Delivery:</strong>
                <span>${delivery.deliveryLocation}</span>
              </div>
              <div class="detail-row">
                <strong>Customer:</strong>
                <span>${delivery.customerName || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <strong>Status:</strong>
                <span>Unassigned</span>
              </div>
            </div>
            
            <div class="notice-box">
              <h3>⚠️ Notice</h3>
              <p>This delivery has been removed from your account by an administrator. You are no longer responsible for this delivery.</p>
            </div>
            
            <p><strong>What this means:</strong></p>
            <ul>
              <li>You are no longer responsible for this delivery</li>
              <li>The delivery has been returned to the pending queue</li>
              <li>You will not receive payment for this delivery</li>
              <li>Please check your dashboard for new assignments</li>
            </ul>
            
            <p>If you have any questions, please contact support.</p>
          </div>
          <div class="footer">
            <p>© 2025 Student Delivery System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Monthly Report Template
  getMonthlyReportTemplate(driverName, reportData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #faf5ff; padding: 30px; border-radius: 0 0 8px 8px; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .stat-box { background: white; padding: 20px; text-align: center; border-radius: 8px; border: 2px solid #8b5cf6; }
          .stat-number { font-size: 24px; font-weight: bold; color: #8b5cf6; }
          .earnings-box { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Monthly Report</h1>
            <p>${reportData.month}/${reportData.year}</p>
          </div>
          <div class="content">
            <h2>Hi ${driverName}!</h2>
            <p>Here's your monthly performance summary:</p>
            
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-number">${reportData.totalDeliveries}</div>
                <div>Total Deliveries</div>
              </div>
              <div class="stat-box">
                <div class="stat-number">${reportData.averagePerDay.toFixed(1)}</div>
                <div>Avg per Day</div>
              </div>
            </div>
            
            <div class="earnings-box">
              <h3>💰 Total Earnings: ${reportData.totalEarnings}₺</h3>
              <p>Average per delivery: ${(reportData.totalEarnings / reportData.totalDeliveries || 0).toFixed(0)}₺</p>
            </div>
            
            <p><strong>Keep up the great work!</strong> Your consistency and dedication make our delivery service reliable for customers.</p>
            
            <p>Login to your dashboard to see detailed daily breakdowns and track your progress.</p>
          </div>
          <div class="footer">
            <p>© 2025 Student Delivery System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Send remittance completed email
  async sendRemittanceCompletedEmail(email, name, remittanceData) {
    const subject = 'Remittance Completed';
    const html = this.getRemittanceCompletedTemplate(name, remittanceData);
    return await this.sendEmail(email, subject, html);
  }

  getRemittanceCompletedTemplate(name, remittanceData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px; }
          .remittance-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #059669; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: bold; color: #374151; }
          .detail-value { color: #059669; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Remittance Completed</h1>
            <p>Student Delivery System</p>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Your remittance has been successfully completed and processed.</p>
            
            <div class="remittance-details">
              <h3 style="color: #059669; margin-top: 0;">Remittance Details</h3>
              <div class="detail-row">
                <span class="detail-label">Reference Number:</span>
                <span class="detail-value">${remittanceData.referenceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Amount:</span>
                <span class="detail-value">₺${remittanceData.amount}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Method:</span>
                <span class="detail-value">${remittanceData.paymentMethod}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Handled By:</span>
                <span class="detail-value">${remittanceData.handledByName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Completed At:</span>
                <span class="detail-value">${new Date(remittanceData.handledAt).toLocaleString()}</span>
              </div>
              ${remittanceData.notes ? `
              <div class="detail-row">
                <span class="detail-label">Notes:</span>
                <span class="detail-value">${remittanceData.notes}</span>
              </div>
              ` : ''}
            </div>
            
            <p><strong>Thank you for your service!</strong></p>
          </div>
          <div class="footer">
            <p>© 2025 Student Delivery System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Send remittance notification email to driver
  async sendRemittanceNotificationEmail(driverEmail, driverName, remittanceData) {
    try {
      const subject = `Remittance Due - Reference: ${remittanceData.referenceNumber}`;

      const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Remittance Due Notice</h2>
                    
                    <p>Dear ${driverName},</p>
                    
                    <p>This is to notify you that you have a remittance payment due to Greep SDS.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #e74c3c; margin-top: 0;">Remittance Details:</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Reference Number:</strong> ${remittanceData.referenceNumber}</li>
                            <li><strong>Amount Due:</strong> ₺${remittanceData.amount}</li>
                            <li><strong>Due Date:</strong> ${new Date(remittanceData.dueDate).toLocaleDateString()}</li>
                            <li><strong>Delivery Count:</strong> ${remittanceData.deliveryCount} deliveries</li>
                            <li><strong>Period:</strong> ${new Date(remittanceData.period.startDate).toLocaleDateString()} - ${new Date(remittanceData.period.endDate).toLocaleDateString()}</li>
                        </ul>
                    </div>
                    
                    <p><strong>Please ensure payment is made by the due date to avoid any penalties.</strong></p>
                    
                    <p>If you have any questions, please contact our support team.</p>
                    
                    <p>Best regards,<br>Greep SDS Team</p>
                </div>
            `;

      await this.sendEmail(driverEmail, subject, htmlContent);
      console.log(`Remittance notification email sent to ${driverEmail}`);
    } catch (error) {
      console.error('Error sending remittance notification email:', error);
      throw error;
    }
  }

  // Send remittance reminder email to driver
  async sendRemittanceReminderEmail(driverEmail, driverName, remittanceData) {
    try {
      const subject = `Remittance Reminder - Overdue Payment`;

      const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #e74c3c;">Remittance Payment Reminder</h2>
                    
                    <p>Dear ${driverName},</p>
                    
                    <p>This is a reminder that your remittance payment is overdue.</p>
                    
                    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                        <h3 style="color: #856404; margin-top: 0;">Overdue Remittance:</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Reference Number:</strong> ${remittanceData.referenceNumber}</li>
                            <li><strong>Amount Due:</strong> ₺${remittanceData.amount}</li>
                            <li><strong>Due Date:</strong> ${new Date(remittanceData.dueDate).toLocaleDateString()}</li>
                            <li><strong>Days Overdue:</strong> ${remittanceData.overdueDays} days</li>
                            <li><strong>Delivery Count:</strong> ${remittanceData.deliveryCount} deliveries</li>
                        </ul>
                    </div>
                    
                    <p><strong>Please make payment immediately to avoid further penalties.</strong></p>
                    
                    <p>If you have any questions, please contact our support team.</p>
                    
                    <p>Best regards,<br>Greep SDS Team</p>
                </div>
            `;

      await this.sendEmail(driverEmail, subject, htmlContent);
      console.log(`Remittance reminder email sent to ${driverEmail}`);
    } catch (error) {
      console.error('Error sending remittance reminder email:', error);
      throw error;
    }
  }

  // Send remittance completion email to driver
  async sendRemittanceCompletionEmail(driverEmail, driverName, remittanceData) {
    try {
      const subject = `Remittance Payment Confirmed - Reference: ${remittanceData.referenceNumber}`;

      const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #27ae60;">Remittance Payment Confirmed</h2>
                    
                    <p>Dear ${driverName},</p>
                    
                    <p>Your remittance payment has been successfully received and processed.</p>
                    
                    <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                        <h3 style="color: #155724; margin-top: 0;">Payment Details:</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Reference Number:</strong> ${remittanceData.referenceNumber}</li>
                            <li><strong>Amount Paid:</strong> ₺${remittanceData.amount}</li>
                            <li><strong>Payment Date:</strong> ${new Date(remittanceData.paymentDate).toLocaleDateString()}</li>
                            <li><strong>Payment Reference:</strong> ${remittanceData.paymentReference || 'N/A'}</li>
                        </ul>
                    </div>
                    
                    <p>Thank you for your prompt payment. Your account is now up to date.</p>
                    
                    <p>If you have any questions, please contact our support team.</p>
                    
                    <p>Best regards,<br>Greep SDS Team</p>
                </div>
            `;

      await this.sendEmail(driverEmail, subject, htmlContent);
      console.log(`Remittance completion email sent to ${driverEmail}`);
    } catch (error) {
      console.error('Error sending remittance completion email:', error);
      throw error;
    }
  }

  // Send admin invitation email
  async sendAdminInvitation(adminEmail, adminName, invitedBy, tempPassword) {
    try {
      const subject = `Admin Invitation - Greep SDS`;

      const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2c3e50;">Admin Invitation</h2>
              
              <p>Dear ${adminName},</p>
              
              <p>You have been invited to join the Greep SDS admin team by ${invitedBy}.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #2c3e50; margin-top: 0;">Your Login Credentials:</h3>
                  <ul style="list-style: none; padding: 0;">
                      <li><strong>Email:</strong> ${adminEmail}</li>
                      <li><strong>Temporary Password:</strong> ${tempPassword}</li>
                  </ul>
              </div>
              
              <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
              
              <p>You can access the admin panel at: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin">Admin Panel</a></p>
              
              <p>If you have any questions, please contact the system administrator.</p>
              
              <p>Best regards,<br>Greep SDS Team</p>
          </div>
      `;

      await this.sendEmail(adminEmail, subject, htmlContent);
      console.log(`Admin invitation email sent to ${adminEmail}`);
    } catch (error) {
      console.error('Error sending admin invitation email:', error);
      throw error;
    }
  }

  // Send admin password reset email
  async sendAdminPasswordReset(adminEmail, adminName, tempPassword) {
    try {
      const subject = `Password Reset - Greep SDS Admin`;

      const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e74c3c;">Password Reset</h2>
              
              <p>Dear ${adminName},</p>
              
              <p>Your admin password has been reset by a super administrator.</p>
              
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                  <h3 style="color: #856404; margin-top: 0;">Your New Temporary Password:</h3>
                  <p style="font-size: 18px; font-weight: bold; color: #856404;">${tempPassword}</p>
              </div>
              
              <p><strong>Security Notice:</strong> Please change this password immediately after logging in.</p>
              
              <p>You can access the admin panel at: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin">Admin Panel</a></p>
              
              <p>If you did not request this password reset, please contact the system administrator immediately.</p>
              
              <p>Best regards,<br>Greep SDS Team</p>
          </div>
      `;

      await this.sendEmail(adminEmail, subject, htmlContent);
      console.log(`Admin password reset email sent to ${adminEmail}`);
    } catch (error) {
      console.error('Error sending admin password reset email:', error);
      throw error;
    }
  }


}

module.exports = new EmailService();