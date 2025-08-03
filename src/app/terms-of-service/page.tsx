'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-gray-600 mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border p-8 prose prose-gray max-w-none">
          <h2>Agreement to Terms</h2>
          <p>
            By accessing and using Church Music Pro ("Service," "we," "us," or "our"), operated by VERITAS FUND, LLC, you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
          </p>

          <h2>Description of Service</h2>
          <p>
            Church Music Pro is a web-based platform designed to help churches manage music scheduling, 
            musician assignments, and related communications. Our Service includes:
          </p>
          <ul>
            <li>Event planning and scheduling tools</li>
            <li>Musician assignment and availability management</li>
            <li>Communication features (email and SMS notifications)</li>
            <li>Document and music library management</li>
            <li>Reporting and analytics features</li>
          </ul>

          <h2>User Accounts</h2>
          
          <h3>Account Creation</h3>
          <ul>
            <li>You must provide accurate and complete information when creating an account</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
            <li>You may not share your account with others or create multiple accounts</li>
          </ul>

          <h3>Account Types</h3>
          <ul>
            <li><strong>Directors:</strong> Full administrative access to church scheduling and management</li>
            <li><strong>Musicians:</strong> Access to view assignments, update availability, and communicate</li>
            <li><strong>Pastors:</strong> Access to reports and oversight features</li>
          </ul>

          <h2>Acceptable Use</h2>
          <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
          <ul>
            <li>Use the Service for any illegal or unauthorized purpose</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Upload or transmit viruses, malware, or malicious code</li>
            <li>Attempt to gain unauthorized access to the Service or other accounts</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Use the Service to send spam or unsolicited communications</li>
            <li>Violate the intellectual property rights of others</li>
          </ul>

          <h2>Subscription and Payment</h2>
          
          <h3>Billing</h3>
          <ul>
            <li>Subscription fees are billed in advance on a recurring basis</li>
            <li>All fees are non-refundable except as required by law</li>
            <li>We reserve the right to change pricing with 30 days' notice</li>
            <li>Failure to pay may result in service suspension or termination</li>
          </ul>

          <h3>Free Trials</h3>
          <ul>
            <li>Free trials are subject to limitations and may require payment information</li>
            <li>Trials automatically convert to paid subscriptions unless cancelled</li>
            <li>Trial abuse may result in immediate termination</li>
          </ul>

          <h2>Content and Data</h2>
          
          <h3>Your Content</h3>
          <ul>
            <li>You retain ownership of content you upload or create using the Service</li>
            <li>You grant us a license to use your content to provide the Service</li>
            <li>You are responsible for ensuring you have rights to any content you upload</li>
            <li>You must not upload copyrighted material without permission</li>
          </ul>

          <h3>Data Backup and Loss</h3>
          <ul>
            <li>We perform regular backups but cannot guarantee against data loss</li>
            <li>You are responsible for maintaining your own backups of important data</li>
            <li>We are not liable for any data loss or corruption</li>
          </ul>

          <h2>Privacy and Communications</h2>
          <ul>
            <li>Your privacy is governed by our Privacy Policy</li>
            <li>You consent to receive communications related to the Service via email and SMS (if enabled)</li>
            <li>Communications are sent through third-party services including Resend (email) and TextMagic (SMS)</li>
            <li>You may opt out of non-essential communications through your account settings</li>
            <li>Emergency, security, or billing notifications cannot be opted out of</li>
            <li>Data retention period is up to 5 years after account deletion for legal compliance</li>
          </ul>

          <h2>Service Availability</h2>
          <ul>
            <li>We strive for high availability but cannot guarantee 100% uptime</li>
            <li>Planned maintenance will be announced in advance when possible</li>
            <li>We are not liable for service interruptions or downtime</li>
            <li>Some features may be temporarily unavailable during updates</li>
          </ul>

          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Church Music Pro shall not be liable for any indirect, 
            incidental, special, consequential, or punitive damages, including but not limited to loss of 
            profits, data, or use, arising out of or related to your use of the Service.
          </p>

          <h2>Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Church Music Pro from any claims, damages, losses, 
            and expenses arising from your use of the Service or violation of these Terms.
          </p>

          <h2>Termination</h2>
          
          <h3>By You</h3>
          <ul>
            <li>You may terminate your account at any time through account settings</li>
            <li>Termination does not entitle you to a refund of prepaid fees</li>
            <li>Your data may be deleted after account termination</li>
          </ul>

          <h3>By Us</h3>
          <ul>
            <li>We may terminate accounts for violation of these Terms</li>
            <li>We may suspend service for non-payment</li>
            <li>We may discontinue the Service with reasonable notice</li>
          </ul>

          <h2>Intellectual Property</h2>
          <ul>
            <li>The Service and its content are protected by intellectual property laws</li>
            <li>You may not copy, modify, or distribute our software or content</li>
            <li>Our trademarks and logos may not be used without permission</li>
            <li>We respect the intellectual property rights of others</li>
          </ul>

          <h2>Dispute Resolution</h2>
          <ul>
            <li>Any disputes will be resolved through binding arbitration</li>
            <li>Class action lawsuits are waived</li>
            <li>These Terms are governed by Nebraska, USA law</li>
            <li>Disputes must be filed within one year of the claim arising</li>
            <li>Arbitration proceedings will be conducted in Nebraska</li>
          </ul>

          <h2>Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Material changes will be communicated 
            via email or through the Service. Your continued use after changes constitutes acceptance of 
            the updated Terms.
          </p>

          <h2>Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will 
            remain in full force and effect.
          </p>

          <h2>Contact Information</h2>
          <p>If you have questions about these Terms, please contact us:</p>
          <ul>
            <li><strong>Email:</strong> support@churchmusicpro.com</li>
            <li><strong>Support:</strong> Through our in-app support system</li>
            <li><strong>Company:</strong> VERITAS FUND, LLC (Nebraska)</li>
          </ul>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-0">
              <strong>Note:</strong> This terms of service template should be reviewed by legal counsel 
              and customized for your specific business model, applicable laws, and jurisdiction.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}