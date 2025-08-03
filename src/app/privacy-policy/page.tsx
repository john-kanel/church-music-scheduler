'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border p-8 prose prose-gray max-w-none">
          <h2>Overview</h2>
          <p>
            This Privacy Policy describes how Church Music Pro ("we," "our," or "us") collects, uses, and protects your personal information when you use our church music scheduling service.
          </p>

          <h2>Information We Collect</h2>
          
          <h3>Personal Information</h3>
          <p>When you create an account or use our service, we may collect:</p>
          <ul>
            <li><strong>Contact Information:</strong> Name, email address, phone number</li>
            <li><strong>Church Information:</strong> Church name, address, role/position</li>
            <li><strong>Profile Information:</strong> Musical skills, availability preferences, timezone</li>
            <li><strong>Usage Data:</strong> How you interact with our service, features used</li>
          </ul>

          <h3>Automatically Collected Information</h3>
          <ul>
            <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
            <li><strong>Usage Analytics:</strong> Pages visited, time spent, feature usage</li>
            <li><strong>Cookies:</strong> Session management and preference storage</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and maintain our music scheduling service</li>
            <li>Send notifications about events, assignments, and updates</li>
            <li>Facilitate communication between church staff and musicians</li>
            <li>Improve our service and develop new features</li>
            <li>Provide customer support and respond to inquiries</li>
            <li>Send administrative information and service updates</li>
          </ul>

          <h2>Information Sharing</h2>
          <p>We may share your information:</p>
          <ul>
            <li><strong>Within Your Church:</strong> With authorized church staff and musicians for scheduling purposes</li>
            <li><strong>Service Providers:</strong> With trusted third-party providers who assist in service delivery</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, sale, or transfer of assets</li>
          </ul>
          <p><strong>We do not sell your personal information to third parties.</strong></p>

          <h2>Third-Party Services</h2>
          <p>Our service integrates with:</p>
          <ul>
            <li><strong>Email Services:</strong> For sending notifications and communications</li>
            <li><strong>SMS Services:</strong> For text message notifications (if enabled)</li>
            <li><strong>Payment Processing:</strong> For subscription billing</li>
            <li><strong>Analytics:</strong> For service improvement and usage insights</li>
          </ul>

          <h2>Data Security</h2>
          <p>We implement appropriate security measures to protect your information:</p>
          <ul>
            <li>Encryption of data in transit and at rest</li>
            <li>Regular security assessments and updates</li>
            <li>Access controls and authentication requirements</li>
            <li>Employee training on data protection practices</li>
          </ul>

          <h2>Your Rights and Choices</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal information</li>
            <li><strong>Update:</strong> Modify your account information and preferences</li>
            <li><strong>Delete:</strong> Request deletion of your account and data</li>
            <li><strong>Opt-out:</strong> Unsubscribe from non-essential communications</li>
            <li><strong>Data Portability:</strong> Request your data in a portable format</li>
          </ul>

          <h2>Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide services. 
            After account deletion, we may retain certain information for legal compliance, fraud prevention, 
            and legitimate business purposes.
          </p>

          <h2>Children's Privacy</h2>
          <p>
            Our service is not intended for children under 13. We do not knowingly collect personal information 
            from children under 13. If you become aware that a child has provided us with personal information, 
            please contact us.
          </p>

          <h2>International Users</h2>
          <p>
            Our service is hosted in the United States. If you are accessing our service from outside the US, 
            your information may be transferred to, stored, and processed in the US where our servers are located.
          </p>

          <h2>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material changes 
            by posting the new policy on this page and updating the "Last updated" date. Your continued use 
            of our service after such changes constitutes acceptance of the updated policy.
          </p>

          <h2>Contact Us</h2>
          <p>If you have questions about this Privacy Policy or our data practices, please contact us:</p>
          <ul>
            <li><strong>Email:</strong> privacy@churchmusicpro.com</li>
            <li><strong>Support:</strong> Through our in-app support system</li>
          </ul>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-0">
              <strong>Note:</strong> This privacy policy template should be reviewed by legal counsel 
              and customized for your specific business practices and applicable laws.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}