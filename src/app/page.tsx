'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { Menu, X, Calendar, Music2, MessageSquare } from 'lucide-react'
import { Logo } from '@/components/ui/logo'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (session && isClient) {
      router.push('/dashboard')
    }
  }, [session, router, isClient])

  // Show loading during hydration to prevent mismatch
  if (!isClient || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo size="xl" />
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <a href="#features" className="text-gray-700 hover:text-brand-600 transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-gray-700 hover:text-brand-600 transition-colors">
                Pricing
              </a>
              <a 
                href="/auth/signin" 
                className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors"
              >
                Sign In
              </a>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-700 hover:text-brand-600 transition-colors p-2"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 py-4">
              <div className="flex flex-col space-y-4">
                                  <a 
                    href="#features"
                    className="text-gray-700 hover:text-brand-600 transition-colors px-2 py-1"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Features
                </a>
                                  <a 
                    href="#pricing"
                    className="text-gray-700 hover:text-brand-600 transition-colors px-2 py-1"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </a>
                <a 
                  href="/auth/signin" 
                  className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors text-center mx-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column - Marketing Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
                Simple Music Scheduling for Your 
                <span className="text-brand-600"> Church</span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Effortlessly coordinate musicians, manage events, and keep your music ministry organized. 
                Built specifically for church music directors who want to focus on worship, not scheduling.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-brand-600">$35</div>
                <div className="text-sm text-gray-600">per month</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-success-600">30</div>
                <div className="text-sm text-gray-600">day free trial</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm border-2 border-success-400">
                <div className="text-2xl font-bold text-success-600">$200</div>
                <div className="text-xs text-success-700 font-medium">annually (save $220!)</div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Perfect for:</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                  <span className="text-gray-700">Catholic & Protestant Churches</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                  <span className="text-gray-700">Music Directors & Worship Leaders</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                  <span className="text-gray-700">Volunteer Musicians & Choirs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Login Form */}
          <div className="lg:pl-8">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Sign In to Your Church
                </h2>
                <p className="text-gray-600">
                  Welcome back! Enter your credentials to continue.
                </p>
              </div>
              
              <LoginForm />

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <a href="/auth/signup" className="text-brand-600 hover:text-brand-700 font-medium">
                    Start your free trial
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Organize Your Music Ministry
            </h2>
            <p className="text-lg text-gray-600">
              Powerful features designed specifically for church music scheduling
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-brand-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Scheduling</h3>
              <p className="text-gray-600">
                Create events, assign musicians, and manage recurring services with ease.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Music2 className="h-6 w-6 text-success-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Music Library</h3>
              <p className="text-gray-600">
                Upload and share music files with your musicians for each service.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-secondary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Communication</h3>
              <p className="text-gray-600">
                Send updates and reminders via email and SMS to keep everyone informed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Simple, Affordable Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Choose monthly or save big with annual billing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto md:grid-rows-1 pt-4">
            {/* Monthly Plan */}
                          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col h-full">
              <div className="text-center flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Monthly Plan</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-brand-600">$35</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-gray-600 mb-4">
                  Complete church music scheduling solution
                </p>
                <div className="bg-brand-50 text-brand-700 text-sm font-medium px-3 py-1 rounded-full inline-block mb-4">
                  One month free trial included!
                </div>
                <p className="text-gray-600 mb-6">
                  Get started with full access today!
                </p>

                <div className="space-y-3 mb-8 min-h-[144px] flex flex-col justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">One month free trial</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Unlimited musicians</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Unlimited events</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Email & SMS messaging</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Music file sharing</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Priority support</span>
                  </div>
                </div>

                <div className="mt-auto">
                  <a href="/auth/signup" className="w-full bg-brand-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-brand-700 transition-colors block text-center">
                    Start 30-Day Free Trial
                  </a>
                </div>
              </div>
            </div>

            {/* Annual Plan */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-success-500 relative flex flex-col h-full overflow-visible md:overflow-hidden pt-12 md:pt-8">
              <div className="absolute -top-5 md:-top-3 left-1/2 transform -translate-x-1/2 z-10">
                <span className="bg-success-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Best Value - Save 52%
                </span>
              </div>
              <div className="text-center flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Annual Plan</h3>
                <div className="mb-2">
                  <div className="text-lg text-gray-500 line-through">$420/year</div>
                  <div className="text-4xl font-bold text-success-600">$200</div>
                  <div className="text-gray-600">/year</div>
                </div>
                <div className="bg-success-50 text-success-700 text-sm font-medium px-3 py-1 rounded-full inline-block mb-4">
                  Save $220 per year!
                </div>
                <p className="text-gray-600 mb-6">
                  Everything included - 2 months free!
                </p>

                <div className="space-y-3 mb-8 min-h-[144px] flex flex-col justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
                    <span className="text-gray-700">Two month free trial</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
                    <span className="text-gray-700">Unlimited musicians</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
                    <span className="text-gray-700">Unlimited events</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
                    <span className="text-gray-700">Email & SMS messaging</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
                    <span className="text-gray-700">Music file sharing</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
                    <span className="text-gray-700">Priority support</span>
                  </div>
                </div>

                <div className="mt-auto -mb-1">
                  <a
                    href="/auth/signup"
                    className="w-full bg-success-600 text-white font-medium py-3 px-6 rounded-lg hover:bg-success-700 transition-colors inline-block text-center"
                  >
                    Start 30-Day Free Trial
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
                              <Logo size="sm" textClassName="text-brand-400" />
            </div>
            <p className="text-gray-400">
              © 2024 Church Music Scheduler. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
