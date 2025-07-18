'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { Menu, X, Calendar, Music2, MessageSquare, Mail, Users } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import Image from 'next/image'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{src: string, alt: string} | null>(null)

  const openImageModal = (src: string, alt: string) => {
    setSelectedImage({ src, alt })
    setShowImageModal(true)
  }

  const closeImageModal = () => {
    setShowImageModal(false)
    setSelectedImage(null)
  }

  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showImageModal) {
        closeImageModal()
      }
    }

    if (showImageModal) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden' // Prevent scrolling when modal is open
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset' // Restore scrolling
    }
  }, [showImageModal])

  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  // Show loading only during actual loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-2">
            <div>
              <Logo size="xl" />
            </div>
            
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
              <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
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
                <div className="text-3xl font-bold text-blue-800">30</div>
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
                  <span className="text-gray-700">Churches of any denomination</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                  <span className="text-gray-700">Pastors, Music Directors, & Worship Leaders</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-brand-600 rounded-full mr-3"></div>
                  <span className="text-gray-700">Volunteer Musicians & Choirs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sign Up Form */}
          <div className="lg:pl-8">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Start Your Free Trial
                </h2>
                <p className="text-gray-600">
                  Start saving time and energy with just a few clicks today.
                </p>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.target as HTMLFormElement)
                const email = formData.get('email') as string
                const churchName = formData.get('churchName') as string
                window.location.href = `/signup?email=${encodeURIComponent(email)}&church=${encodeURIComponent(churchName)}`
              }} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="churchName" className="block text-sm font-medium text-gray-700 mb-2">
                    Church Name
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 flex items-center justify-center">
                      ⛪
                    </div>
                    <input
                      id="churchName"
                      name="churchName"
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900"
                      placeholder="Enter your church name"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                >
                  Sign Up
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <a href="/signin" className="text-brand-600 hover:text-brand-700 font-medium">
                    Sign in
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built by Music Directors, for Music Directors
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Stop wasting hours on scheduling and organization. Our platform solves the real problems music directors face every week, saving you time and energy.
            </p>
          </div>

          {/* Feature 1: PDF Upload - Left Image, Right Content */}
          <div className="mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative">
                {/* Screenshot Placeholder */}
                <div className="bg-gray-100 rounded-2xl shadow-2xl aspect-[4/3] flex items-center justify-center border">
                  <span className="text-gray-500 text-lg">PDF Upload Screenshot</span>
                </div>
                {/* Colored Icon Bubble */}
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="lg:pl-8">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Cut Your Scheduling Time in Half
                </h3>
                <p className="text-xl text-gray-600 mb-6">
                  Upload a PDF of the songs for any event and watch the titles automatically populate. No more typing hymn numbers or copying service orders by hand.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Intelligent PDF parsing extracts song titles</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Auto-creates service parts and music assignments</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Works with any service order format</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: Automated Notifications - Right Image, Left Content */}
          <div className="mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="lg:pr-8 order-2 lg:order-1">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Never Chase Down Musicians Again
                </h3>
                <p className="text-xl text-gray-600 mb-6">
                  Automated email reminders ensure everyone knows their role and shows up prepared. No more last-minute "Did you get my message?" conversations.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Smart reminders 1 week and 1 day before events</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Automatic pastor notifications</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Assign musicians manually or automatically</span>
                  </div>
                </div>
              </div>
              <div className="relative order-1 lg:order-2">
                {/* Screenshot Placeholder */}
                <div className="bg-gray-100 rounded-2xl shadow-2xl aspect-[4/3] flex items-center justify-center border">
                  <span className="text-gray-500 text-lg">Email Notifications Screenshot</span>
                </div>
                {/* Colored Icon Bubble */}
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3: Smart Scheduling - Left Image, Right Content */}
          <div className="mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative">
                {/* Calendar View Screenshot */}
                <div className="relative rounded-2xl shadow-2xl overflow-hidden cursor-pointer" onClick={() => openImageModal("/calendar view.png", "Calendar view showing church events and scheduling")}>
                  <Image
                    src="/calendar view.png"
                    alt="Calendar view showing church events and scheduling"
                    width={600}
                    height={450}
                    className="w-full h-auto object-contain rounded-2xl"
                    style={{ backgroundColor: '#f8f9fa' }}
                  />
                </div>
                {/* Colored Icon Bubble */}
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="lg:pl-8">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Handle Complex Schedules Effortlessly
                </h3>
                <p className="text-xl text-gray-600 mb-6">
                  Create recurring events, manage substitute musicians, and coordinate special services. Built to handle real church scheduling challenges.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Recurring events with flexible patterns</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Easy substitute management</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Visual calendar shows conflicts instantly</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 4: Unlimited Scale - Right Image, Left Content */}
          <div className="mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="lg:pr-8 order-2 lg:order-1">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Grow Your Music Ministry Without Limits
                </h3>
                <p className="text-xl text-gray-600 mb-6">
                  Add unlimited musicians and events. Whether you have 5 musicians or 50, manage contemporary services, traditional liturgy, and special events all in one place.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Unlimited musicians and roles</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Unlimited events and services</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-success-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Multiple service types and styles</span>
                  </div>
                </div>
              </div>
              <div className="relative order-1 lg:order-2">
                {/* Musicians List Screenshot */}
                <div className="relative rounded-2xl shadow-2xl overflow-hidden cursor-pointer" onClick={() => openImageModal("/musicians list pic.png", "Musicians list view showing unlimited musicians and their details")}>
                  <Image
                    src="/musicians list pic.png"
                    alt="Musicians list view showing unlimited musicians and their details"
                    width={600}
                    height={450}
                    className="w-full h-auto object-contain rounded-2xl"
                    style={{ backgroundColor: '#f8f9fa' }}
                  />
                </div>
                {/* Colored Icon Bubble */}
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-success-600 rounded-full flex items-center justify-center shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Feature 5: Pastor Reports - Left Image, Right Content */}
          <div className="mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative">
                {/* Pastor Notifications Screenshot */}
                <div className="relative rounded-2xl shadow-2xl overflow-hidden max-w-md mx-auto cursor-pointer" onClick={() => openImageModal("/Pastor notifications.png", "Pastor notifications settings and automated email reports")}>
                  <Image
                    src="/Pastor notifications.png"
                    alt="Pastor notifications settings and automated email reports"
                    width={400}
                    height={600}
                    className="w-full h-auto object-contain rounded-2xl"
                    style={{ backgroundColor: '#f8f9fa' }}
                  />
                </div>
                {/* Colored Icon Bubble */}
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-secondary-600 rounded-full flex items-center justify-center shadow-lg">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="lg:pl-8">
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Keep Leadership Informed Automatically
                </h3>
                <p className="text-xl text-gray-600 mb-6">
                  Automated weekly reports keep your pastor and staff updated on music ministry activities, attendance, and upcoming events without extra work from you.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-secondary-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Weekly activity summaries for leadership</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-secondary-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Musician participation tracking</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-secondary-600 rounded-full mr-3"></div>
                    <span className="text-gray-700">Upcoming events and needs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>



          {/* CTA Section */}
          <div className="text-center bg-gradient-to-br from-brand-50 to-brand-100 rounded-3xl p-12">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Ready to Transform Your Music Ministry?
            </h3>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Reclaim your weekends and reduce scheduling stress.
            </p>
            <a 
              href="/auth/signup" 
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-lg"
            >
              Start Free Trial
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <p className="text-sm text-gray-600 mt-4">
              30-day free trial • No credit card required • Cancel anytime
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
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
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-success-500 relative flex flex-col h-full overflow-visible pt-12 md:pt-10">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                <span className="bg-success-500 text-white px-4 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                  Best Value - Save 52%
                </span>
              </div>
              <div className="text-center flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Annual Plan</h3>
                <div className="mb-2">
                  <div className="text-lg text-gray-500 line-through">$420/year</div>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-success-600">$200</span>
                    <span className="text-gray-600">/year</span>
                  </div>
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
      <footer className="bg-brand-600 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Image
                src="/whitetransparent.png"
                alt="Church Music Pro Logo"
                width={30}
                height={30}
                className="object-contain"
              />
              <span className="ml-3 font-bold text-white text-lg">
                Church Music Pro
              </span>
            </div>
            <p className="text-white opacity-90">
              © 2024 Church Music Pro. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black bg-opacity-75"
          onClick={closeImageModal}
        >
          <div className="relative w-[90vw] h-[95vh] flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 z-10 p-2 bg-white bg-opacity-90 hover:bg-white rounded-full shadow-lg transition-all duration-200"
              aria-label="Close image"
            >
              <X className="h-6 w-6 text-gray-800" />
            </button>
            
            {/* Image Container */}
            <div 
              className="relative bg-white rounded-lg shadow-2xl overflow-hidden w-full h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt}
                width={1800}
                height={1350}
                className="w-full h-full object-contain"
                priority
              />
              
              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-4">
                <p className="text-sm md:text-base text-center">{selectedImage.alt}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
