import React from 'react'

interface ReferralSuccessNotificationProps {
  referrerName: string
  referrerChurchName: string
  referredPersonName: string
  referredChurchName: string
  monthlyReward: number
  totalRewardsEarned: number
  totalMoneySaved: number
}

export function ReferralSuccessNotification({
  referrerName,
  referrerChurchName,
  referredPersonName,
  referredChurchName,
  monthlyReward,
  totalRewardsEarned,
  totalMoneySaved
}: ReferralSuccessNotificationProps) {
  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      maxWidth: '600px', 
      margin: '0 auto',
      backgroundColor: '#ffffff'
    }}>
      {/* Logo Section */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        textAlign: 'center', 
        borderRadius: '8px 8px 0 0', 
        borderBottom: '3px solid #10B981' 
      }}>
        <div style={{
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <img 
            src={`${process.env.NEXTAUTH_URL || 'https://churchmusicscheduler.com'}/big-logo-maroon.png`}
            alt="Church Music Scheduler" 
            style={{ height: '60px', width: 'auto' }} 
          />
        </div>
        <h1 style={{ 
          color: '#333', 
          margin: '0', 
          fontSize: '28px',
          fontWeight: 'bold'
        }}>
          🎉 Congratulations!
        </h1>
        <p style={{ 
          color: '#6B7280', 
          margin: '10px 0 0 0',
          fontSize: '16px'
        }}>
          Your referral was successful!
        </p>
      </div>
      
      <div style={{ 
        backgroundColor: 'white', 
        padding: '40px 30px', 
        borderRadius: '0 0 8px 8px', 
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' 
      }}>
        {/* Greeting */}
        <h2 style={{ 
          color: '#1F2937', 
          marginBottom: '20px',
          fontSize: '22px'
        }}>
          Hello {referrerName}!
        </h2>
        
        <p style={{ 
          color: '#374151', 
          lineHeight: '1.6', 
          fontSize: '16px',
          marginBottom: '25px'
        }}>
          Great news! <strong>{referredPersonName}</strong> has successfully signed up for Church Music Scheduler using your referral code and completed their first subscription payment.
        </p>

        {/* Success Details */}
        <div style={{ 
          backgroundColor: '#F0FDF4', 
          padding: '25px', 
          borderRadius: '8px', 
          marginBottom: '25px',
          border: '2px solid #10B981'
        }}>
          <h3 style={{ 
            color: '#065F46', 
            fontSize: '18px', 
            fontWeight: 'bold', 
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            🏆 Referral Success Details
          </h3>
          
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <p style={{ 
              fontSize: '14px', 
              color: '#065F46', 
              marginBottom: '5px'
            }}>
              <strong>Referred Church:</strong> {referredChurchName}
            </p>
            <p style={{ 
              fontSize: '14px', 
              color: '#065F46', 
              marginBottom: '0'
            }}>
              <strong>Contact Person:</strong> {referredPersonName}
            </p>
          </div>
        </div>

        {/* Reward Information */}
        <div style={{ 
          backgroundColor: '#FDF2F8', 
          padding: '25px', 
          borderRadius: '8px', 
          marginBottom: '25px',
          border: '2px solid #660033'
        }}>
          <h3 style={{ 
            color: '#660033', 
            fontSize: '18px', 
            fontWeight: 'bold', 
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            💰 Your Reward
          </h3>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: '#660033',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '15px'
            }}>
              +1 FREE MONTH (${monthlyReward.toFixed(2)} value)
            </div>
            
            <p style={{ 
              fontSize: '14px', 
              color: '#660033', 
              marginBottom: '0'
            }}>
              This reward has been automatically applied to your account!
            </p>
          </div>
        </div>

        {/* Total Rewards Summary */}
        <div style={{ 
          backgroundColor: '#F3F4F6', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '25px'
        }}>
          <h3 style={{ 
            color: '#1F2937', 
            fontSize: '16px', 
            fontWeight: 'bold', 
            marginBottom: '15px',
            textAlign: 'center'
          }}>
            📊 Your Total Referral Rewards
          </h3>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-around',
            textAlign: 'center'
          }}>
            <div>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#10B981',
                marginBottom: '5px'
              }}>
                {totalRewardsEarned}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Free Months
              </div>
            </div>
            
            <div>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#660033',
                marginBottom: '5px'
              }}>
                ${totalMoneySaved.toFixed(2)}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Money Saved
              </div>
            </div>
          </div>
        </div>

        {/* How the reward works */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ 
            color: '#1F2937', 
            fontSize: '16px', 
            fontWeight: 'bold', 
            marginBottom: '15px' 
          }}>
            How Your Reward Works:
          </h3>
          
          <ul style={{ 
            fontSize: '14px', 
            lineHeight: '1.6', 
            color: '#374151',
            paddingLeft: '20px',
            marginBottom: '0'
          }}>
            <li style={{ marginBottom: '8px' }}>💳 <strong>Credit Applied:</strong> Your account has been credited with ${monthlyReward.toFixed(2)}</li>
            <li style={{ marginBottom: '8px' }}>📅 <strong>Next Payment:</strong> Your next billing cycle will be skipped automatically</li>
            <li style={{ marginBottom: '8px' }}>🔄 <strong>No Action Needed:</strong> The reward is applied automatically - just keep using the service!</li>
            <li style={{ marginBottom: '0' }}>🎯 <strong>Keep Referring:</strong> Earn more free months by referring other churches</li>
          </ul>
        </div>

        {/* CTA to refer more */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '25px',
          padding: '20px',
          backgroundColor: '#FEF3C7',
          borderRadius: '8px',
          border: '2px dashed #F59E0B'
        }}>
          <h3 style={{ 
            color: '#92400E', 
            fontSize: '16px', 
            fontWeight: 'bold', 
            marginBottom: '10px' 
          }}>
            Want to earn more free months?
          </h3>
          <p style={{ 
            fontSize: '14px', 
            color: '#78350F', 
            marginBottom: '15px'
          }}>
            Keep sharing your referral code with other churches and earn unlimited free months!
          </p>
          <a 
            href="https://church-music-scheduler-production.up.railway.app/rewards"
            style={{
              display: 'inline-block',
              backgroundColor: '#660033',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            View My Rewards Dashboard
          </a>
        </div>

        {/* Thank you message */}
        <div style={{ 
          textAlign: 'center',
          padding: '20px',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{ 
            fontSize: '16px', 
            color: '#374151',
            marginBottom: '10px',
            fontStyle: 'italic'
          }}>
            "Thank you for helping other churches discover Church Music Scheduler. Together, we're making church music ministry easier and more organized!"
          </p>
          <p style={{ 
            fontSize: '14px', 
            color: '#6B7280',
            margin: '0'
          }}>
            - The Church Music Scheduler Team
          </p>
        </div>

        {/* Footer */}
        <div style={{ 
          borderTop: '1px solid #E5E7EB', 
          paddingTop: '20px', 
          textAlign: 'center' 
        }}>
          <p style={{ 
            color: '#9CA3AF', 
            fontSize: '12px', 
            margin: '0' 
          }}>
            This email was sent to you because someone successfully used your referral code.<br/>
            You can manage your referral settings in your account dashboard.
          </p>
        </div>
      </div>
    </div>
  )
} 