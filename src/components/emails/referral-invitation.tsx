import React from 'react'

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
      {/* Logo placeholder section */}
      <div style={{ 
        textAlign: 'center', 
        padding: '30px 20px 20px 20px', 
        backgroundColor: '#F8F9FA',
        borderBottom: '2px solid #E5E7EB' 
      }}>
        <div style={{
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <img 
            src={`${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/logo.png`}
            alt="Church Music Scheduler" 
            style={{ height: '60px', width: 'auto' }} 
          />
        </div>
        <div style={{ 
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#1F2937',
          marginBottom: '5px'
        }}>
          Church Music Scheduler
        </div>
        <div style={{ 
          fontSize: '14px',
          color: '#6B7280'
        }}>
          Organizing Your Church's Music Ministry
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: '30px 20px' }}>
        <h1 style={{ 
          color: '#1F2937', 
          fontSize: '28px', 
          fontWeight: 'bold', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          Join {referrerChurchName} on Church Music Scheduler!
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
          <strong>{referrerName}</strong> from <strong>{referrerChurchName}</strong> has invited you to try Church Music Scheduler - the easiest way to organize your church's music ministry!
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
              Get Your First Month FREE!
            </div>
          </div>

          <p style={{ 
            fontSize: '14px', 
            color: '#6B7280', 
            textAlign: 'center',
            marginBottom: '0'
          }}>
            Plus, {referrerName} will also receive one free month as our thank you!
          </p>
        </div>

        {/* Referral code */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '25px',
          padding: '20px',
          backgroundColor: '#EFF6FF',
          borderRadius: '8px',
          border: '2px dashed #3B82F6'
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
            color: '#3B82F6',
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
            Why Church Music Scheduler?
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
            href={`https://church-music-scheduler-production.up.railway.app/auth/signup?ref=${referralCode}`}
            style={{
              display: 'inline-block',
              backgroundColor: '#3B82F6',
              color: 'white',
              padding: '12px 30px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            Start Your Free Month Now
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
          © 2024 Church Music Scheduler. All rights reserved.
        </p>
      </div>
    </div>
  )
} 