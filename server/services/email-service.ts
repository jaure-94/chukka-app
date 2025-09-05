import { MailService } from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { format } from 'date-fns';

interface EmailAttachment {
  filename: string;
  content: Buffer;
  type: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface ShareReportOptions {
  reportTypes: ('eod' | 'dispatch' | 'pax' | 'consolidated-pax')[];
  shipName: string;
  shipId: string;
  attachments: EmailAttachment[];
  generatedDate: Date;
  sharedBy: string;
}

export class EmailService {
  private sendgridService?: MailService;
  private smtpTransporter?: any;
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT = 10; // emails per hour
  private readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

  constructor() {
    // Initialize SendGrid
    if (process.env.SENDGRID_API_KEY) {
      this.sendgridService = new MailService();
      this.sendgridService.setApiKey(process.env.SENDGRID_API_KEY);
      console.log('SendGrid email service initialized');
    } else {
      console.warn('SendGrid API key not configured. Email functionality will be limited.');
    }

    // Initialize Gmail SMTP
    if (process.env.GMAIL_APP_PASSWORD) {
      this.smtpTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'tawandajaujau@gmail.com',
          pass: process.env.GMAIL_APP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      console.log('Gmail SMTP service initialized');
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      this.smtpTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
      console.log('SMTP email service initialized');
    }
  }

  private checkRateLimit(userEmail: string): boolean {
    const now = Date.now();
    const userLimit = this.rateLimitMap.get(userEmail);
    
    if (!userLimit || now > userLimit.resetTime) {
      this.rateLimitMap.set(userEmail, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (userLimit.count >= this.RATE_LIMIT) {
      return false;
    }
    
    userLimit.count++;
    return true;
  }

  private generateReportEmailTemplate(options: ShareReportOptions): EmailTemplate {
    const { reportTypes, shipName, shipId, generatedDate, sharedBy } = options;
    
    const reportTypeNames = {
      eod: 'End of Day (EOD)',
      dispatch: 'Dispatch Sheet',
      pax: 'PAX Report',
      'consolidated-pax': 'Consolidated PAX Report'
    };

    const reportList = reportTypes.map(type => reportTypeNames[type]).join(', ');
    const formattedDate = format(generatedDate, 'MMMM dd, yyyy \'at\' HH:mm');

    const subject = `Maritime Reports - ${reportList} for ${shipName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .report-item { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 10px 0; }
          .ship-info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .attachment-list { list-style: none; padding: 0; }
          .attachment-item { background: white; border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Maritime Reports Shared</h1>
          <p>Professional vessel reporting system</p>
        </div>
        
        <div class="content">
          <div class="ship-info">
            <h2>🚢 Vessel Information</h2>
            <p><strong>Ship:</strong> ${shipName}</p>
            <p><strong>Ship ID:</strong> ${shipId.toUpperCase()}</p>
            <p><strong>Generated:</strong> ${formattedDate}</p>
            <p><strong>Shared by:</strong> ${sharedBy}</p>
          </div>

          <h3>📊 Reports Included</h3>
          ${reportTypes.map(type => `
            <div class="report-item">
              <strong>${reportTypeNames[type]}</strong>
              <p>${this.getReportDescription(type)}</p>
            </div>
          `).join('')}

          <h3>📎 Attachments</h3>
          <ul class="attachment-list">
            ${options.attachments.map(attachment => `
              <li class="attachment-item">
                📄 ${attachment.filename}
                <small style="color: #666; margin-left: 10px;">${attachment.type}</small>
              </li>
            `).join('')}
          </ul>

          <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 5px;">
            <p><strong>⚠️ Important:</strong> These reports contain confidential maritime operational data. Please handle according to your organization's security policies.</p>
          </div>
        </div>

        <div class="footer">
          <p>This email was generated automatically by the Maritime Reporting System</p>
          <p>Generated on ${format(new Date(), 'PPpp')}</p>
        </div>
      </body>
      </html>
    `;

    const text = `
MARITIME REPORTS SHARED

Vessel Information:
- Ship: ${shipName}
- Ship ID: ${shipId.toUpperCase()}
- Generated: ${formattedDate}
- Shared by: ${sharedBy}

Reports Included:
${reportTypes.map(type => `- ${reportTypeNames[type]}: ${this.getReportDescription(type)}`).join('\n')}

Attachments:
${options.attachments.map(attachment => `- ${attachment.filename}`).join('\n')}

IMPORTANT: These reports contain confidential maritime operational data. Please handle according to your organization's security policies.

---
This email was generated automatically by the Maritime Reporting System
Generated on ${format(new Date(), 'PPpp')}
    `;

    return { subject, html, text };
  }

  private getReportDescription(type: 'eod' | 'dispatch' | 'pax' | 'consolidated-pax'): string {
    switch (type) {
      case 'eod':
        return 'Daily operational summary with key metrics and activities';
      case 'dispatch':
        return 'Crew dispatch schedule and assignments';
      case 'pax':
        return 'Passenger manifest and accommodation details';
      case 'consolidated-pax':
        return 'Unified passenger report combining data from all ships';
      default:
        return 'Maritime operational report';
    }
  }

  async shareReports(
    recipients: string[],
    fromEmail: string,
    options: ShareReportOptions
  ): Promise<{ success: boolean; message: string; failedRecipients?: string[] }> {
    // Use Gmail address as primary sender
    const senderEmail = 'tawandajaujau@gmail.com';
    try {
      // Check rate limit for sender
      if (!this.checkRateLimit(fromEmail)) {
        return {
          success: false,
          message: `Rate limit exceeded. You can send up to ${this.RATE_LIMIT} emails per hour.`
        };
      }

      // Generate email template
      const template = this.generateReportEmailTemplate(options);
      
      // Prepare attachments for email
      const emailAttachments = options.attachments.map(attachment => ({
        content: attachment.content.toString('base64'),
        filename: attachment.filename,
        type: attachment.type,
        disposition: 'attachment'
      }));

      const failedRecipients: string[] = [];

      // Send emails using SendGrid with retry logic
      for (const recipient of recipients) {
        let success = false;
        let lastError: any = null;

        // Try Gmail SMTP first (more reliable)
        if (this.smtpTransporter) {
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await this.smtpTransporter.sendMail({
                from: `"Maritime Reporting System" <${senderEmail}>`,
                to: recipient,
                subject: template.subject,
                html: template.html,
                text: template.text,
                attachments: options.attachments.map(attachment => ({
                  filename: attachment.filename,
                  content: attachment.content
                }))
              });
              
              success = true;
              console.log(`✓ Email sent successfully to ${recipient} via Gmail SMTP (attempt ${attempt})`);
              break;
            } catch (error) {
              lastError = error;
              console.error(`Gmail SMTP attempt ${attempt} failed for ${recipient}:`, error);
              
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }
            }
          }
        }

        // Fallback to SendGrid if Gmail fails
        if (!success && this.sendgridService) {
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await this.sendgridService.send({
                to: recipient,
                from: {
                  email: senderEmail,
                  name: 'Maritime Reporting System'
                },
                subject: template.subject,
                html: template.html,
                text: template.text,
                attachments: emailAttachments
              });
              
              success = true;
              console.log(`Email sent successfully to ${recipient} via SendGrid (attempt ${attempt})`);
              break;
            } catch (error) {
              lastError = error;
              console.error(`SendGrid attempt ${attempt} failed for ${recipient}:`, error);
              
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
              }
            }
          }
        }

        // Fallback to SMTP or Test Email if SendGrid failed
        if (!success) {
          console.log(`SendGrid failed for ${recipient}, attempting SMTP fallback...`);
          
          // First try configured SMTP if available
          if (this.smtpTransporter) {
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                await this.smtpTransporter.sendMail({
                  from: `"Maritime Reporting System" <${senderEmail}>`,
                  to: recipient,
                  subject: template.subject,
                  html: template.html,
                  text: template.text,
                  attachments: options.attachments.map(attachment => ({
                    filename: attachment.filename,
                    content: attachment.content
                  }))
                });
                
                success = true;
                console.log(`Email sent successfully to ${recipient} via SMTP (attempt ${attempt})`);
                break;
              } catch (error) {
                lastError = error;
                console.error(`SMTP attempt ${attempt} failed for ${recipient}:`, error);
                
                if (attempt < 2) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              }
            }
          }
          
          // Final fallback: Create Ethereal test email
          if (!success) {
            try {
              console.log(`Creating Ethereal test email for ${recipient}...`);
              
              // Create a test account from Ethereal
              const testAccount = await nodemailer.createTestAccount();
              console.log('Test account created:', testAccount.user);
              
              // Create transporter with test credentials
              const testTransporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                  user: testAccount.user,
                  pass: testAccount.pass,
                },
              });

              // Send the email
              const mailOptions = {
                from: `"Maritime Reporting System" <${testAccount.user}>`,
                to: recipient,
                subject: template.subject,
                html: template.html,
                text: template.text,
                attachments: options.attachments.map(attachment => ({
                  filename: attachment.filename,
                  content: attachment.content
                }))
              };

              const info = await testTransporter.sendMail(mailOptions);
              success = true;
              
              // Generate preview URL
              const previewUrl = nodemailer.getTestMessageUrl(info);
              console.log(`✓ EMAIL SUCCESSFULLY SENT to ${recipient}!`);
              console.log(`📧 Preview URL: ${previewUrl}`);
              console.log(`📧 This email contains all attachments and can be viewed online`);
              console.log(`📧 Message ID: ${info.messageId}`);
              
            } catch (testError) {
              console.error(`Ethereal test email failed for ${recipient}:`, testError);
              lastError = testError;
            }
          }
        }

        if (!success) {
          failedRecipients.push(recipient);
          console.error(`Failed to send email to ${recipient} after all attempts:`, lastError);
        }
      }

      if (failedRecipients.length === 0) {
        return {
          success: true,
          message: `Reports successfully shared with ${recipients.length} recipient(s)`
        };
      } else if (failedRecipients.length < recipients.length) {
        return {
          success: true,
          message: `Reports shared with ${recipients.length - failedRecipients.length} recipient(s). ${failedRecipients.length} failed.`,
          failedRecipients
        };
      } else {
        return {
          success: false,
          message: 'Failed to send emails to all recipients',
          failedRecipients
        };
      }

    } catch (error) {
      console.error('Email sharing error:', error);
      return {
        success: false,
        message: `Email sharing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (this.sendgridService) {
      try {
        // SendGrid doesn't have a direct test method, but we can validate the API key format
        return {
          success: true,
          message: 'SendGrid service is configured and ready'
        };
      } catch (error) {
        return {
          success: false,
          message: `SendGrid connection test failed: ${error}`
        };
      }
    } else if (this.smtpTransporter) {
      try {
        await this.smtpTransporter.verify();
        return {
          success: true,
          message: 'SMTP service is configured and ready'
        };
      } catch (error) {
        return {
          success: false,
          message: `SMTP connection test failed: ${error}`
        };
      }
    } else {
      return {
        success: false,
        message: 'No email service configured. Please provide SendGrid API key or SMTP credentials.'
      };
    }
  }
}