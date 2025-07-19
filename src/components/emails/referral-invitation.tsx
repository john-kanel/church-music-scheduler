import React from 'react'
import { getEmailLogoHtml } from './email-logo'

interface ReferralInvitationEmailProps {
  referrerName: string
  referrerChurchName: string
  referralCode: string
  recipientName: string
}

export function ReferralInvitationEmail({
  referrerName,
  referrerChurchName,
  referralCode,
  recipientName
}: ReferralInvitationEmailProps) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      {/* Logo Section */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        textAlign: 'center', 
        borderRadius: '8px 8px 0 0', 
        borderBottom: '3px solid #660033'
      }}>
        <div dangerouslySetInnerHTML={{ __html: getEmailLogoHtml() }} />
        <h1 style={{ color: '#333', margin: '10px 0 0 0', fontSize: '28px' }}>🎁 You're Invited!</h1>
      </div>

      {/* Main content */}
      <div style={{ background: 'white', padding: '40px 20px', borderRadius: '0 0 8px 8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <h1 style={{ 
          color: '#1F2937', 
          fontSize: '28px', 
          fontWeight: 'bold', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          Join {referrerChurchName} on Church Music Pro!
        </h1>

        <p style={{ 
          fontSize: '16px', 
          lineHeight: '1.6', 
          color: '#374151', 
          marginBottom: '20px' 
        }}>
          Hi {recipientName},
        </p>

        <p style={{ 
          fontSize: '16px', 
          lineHeight: '1.6', 
          color: '#374151', 
          marginBottom: '20px' 
        }}>
          <strong>{referrerName}</strong> from <strong>{referrerChurchName}</strong> has invited you to try Church Music Pro - the easiest way to organize your church's music ministry!
        </p>

        {/* Benefits section */}
        <div style={{ 
          backgroundColor: '#F3F4F6', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '25px' 
        }}>
          <h2 style={{ 
            color: '#1F2937', 
            fontSize: '20px', 
            fontWeight: 'bold', 
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            🎁 Special Offer Just for You!
          </h2>
          
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: '#10B981',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '10px'
            }}>
              Get 60 Days FREE Trial!
            </div>
          </div>

          <p style={{ 
            fontSize: '14px', 
            color: '#6B7280', 
            textAlign: 'center',
            marginBottom: '0'
          }}>
            That's 30 days standard trial + 30 days referral bonus! Plus, {referrerName} will receive one free month as our thank you!
          </p>
        </div>

        {/* Referral code */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '25px',
          padding: '20px',
          backgroundColor: '#FDF2F8',
          borderRadius: '8px',
          border: '2px dashed #660033'
        }}>
          <p style={{ 
            fontSize: '16px', 
            color: '#1F2937', 
            marginBottom: '10px',
            fontWeight: 'bold'
          }}>
            Your Referral Code:
          </p>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#660033',
            fontFamily: 'Courier, monospace',
            letterSpacing: '2px',
            marginBottom: '10px'
          }}>
            {referralCode}
          </div>
          <p style={{ 
            fontSize: '14px', 
            color: '#6B7280', 
            marginBottom: '0'
          }}>
            Simply enter this code when you sign up!
          </p>
        </div>

        {/* Benefits list */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ 
            color: '#1F2937', 
            fontSize: '18px', 
            fontWeight: 'bold', 
            marginBottom: '15px' 
          }}>
            Why Church Music Pro?
          </h3>
          
          <ul style={{ 
            fontSize: '14px', 
            lineHeight: '1.6', 
            color: '#374151',
            paddingLeft: '20px'
          }}>
            <li style={{ marginBottom: '8px' }}>📅 <strong>Easy Scheduling:</strong> Create and manage music events effortlessly</li>
            <li style={{ marginBottom: '8px' }}>👥 <strong>Musician Management:</strong> Organize your choir and musicians in one place</li>
            <li style={{ marginBottom: '8px' }}>💬 <strong>Communication Tools:</strong> Send messages and updates instantly</li>
            <li style={{ marginBottom: '8px' }}>📱 <strong>Mobile Friendly:</strong> Access everything from any device</li>
            <li style={{ marginBottom: '8px' }}>💰 <strong>Affordable:</strong> Starting at just $34/month for unlimited musicians</li>
          </ul>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <a 
                            href={`${process.env.NEXT_PUBLIC_APP_URL || 'https://churchmusicpro.com'}/auth/signup?ref=${referralCode}`}
            style={{
              display: 'inline-block',
              backgroundColor: '#660033',
              color: 'white',
              padding: '12px 30px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Start Your 60-Day Free Trial
          </a>
        </div>

        <p style={{ 
          fontSize: '14px', 
          lineHeight: '1.6', 
          color: '#6B7280', 
          textAlign: 'center',
          marginBottom: '0'
        }}>
          Questions? Reply to this email and we'll be happy to help!
        </p>
      </div>

      {/* Footer */}
      <div style={{ 
        backgroundColor: '#F9FAFB', 
        padding: '20px', 
        textAlign: 'center',
        borderTop: '1px solid #E5E7EB'
      }}>
        <p style={{ 
          fontSize: '12px', 
          color: '#6B7280', 
          marginBottom: '0' 
        }}>
          © 2024 Church Music Pro. All rights reserved.
        </p>
      </div>
    </div>
  )
} 