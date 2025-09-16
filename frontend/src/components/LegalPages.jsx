import React from 'react'
import '../styles/legal-pages.css'

function BackButton({ onClick }) {
  return (
    <button className="legal-back-btn" onClick={onClick} title="Back to chat">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
      </svg>
      Back to chat
    </button>
  )
}

function TermsOfService({ onBack }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-header">
          <BackButton onClick={onBack} />
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated: [DATE]</p>
        </div>

        <div className="legal-content">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>By accessing and using L.U.C.I.A. ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>L.U.C.I.A. (Logical Understanding & Clarification of Interpersonal Agendas) is an AI assistant designed to provide context and strategic insights for interpersonal situations. The service is provided for informational purposes only.</p>
          </section>

          <section>
            <h2>3. User Responsibilities</h2>
            <p>You are responsible for:</p>
            <ul>
              <li>Providing accurate information when using the service</li>
              <li>Using the service in compliance with all applicable laws</li>
              <li>Not sharing harmful, illegal, or inappropriate content</li>
              <li>Understanding that AI advice should not replace professional counsel</li>
            </ul>
          </section>

          <section>
            <h2>4. Service Limitations</h2>
            <p>L.U.C.I.A. provides strategic insights and context, not therapy or professional advice. Users are responsible for their own decisions and actions. The service should not be considered a substitute for professional consultation in legal, medical, financial, or psychological matters.</p>
          </section>

          <section>
            <h2>5. Privacy and Data</h2>
            <p>Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information.</p>
          </section>

          <section>
            <h2>6. Account Terms</h2>
            <p>You are responsible for maintaining the security of your account and password. We cannot and will not be liable for any loss or damage from your failure to comply with this security obligation.</p>
          </section>

          <section>
            <h2>7. Prohibited Uses</h2>
            <p>You may not use the service to:</p>
            <ul>
              <li>Violate any laws or regulations</li>
              <li>Harm, threaten, or harass others</li>
              <li>Generate spam or unsolicited messages</li>
              <li>Attempt to gain unauthorized access to systems</li>
              <li>Share malicious code or content</li>
            </ul>
          </section>

          <section>
            <h2>8. Service Availability</h2>
            <p>We strive to provide reliable service but cannot guarantee 100% uptime. The service may be temporarily unavailable due to maintenance, updates, or technical issues.</p>
          </section>

          <section>
            <h2>9. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Users will be notified of significant changes. Continued use of the service after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2>10. Termination</h2>
            <p>We may terminate or suspend your account at our sole discretion, without prior notice, for conduct that we believe violates these Terms of Service or is harmful to other users or the service.</p>
          </section>

          <section>
            <h2>11. Disclaimer</h2>
            <p>The service is provided "as is" without warranty of any kind. We disclaim all warranties, whether express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
          </section>

          <section>
            <h2>12. Contact Information</h2>
            <p>If you have questions about these Terms of Service, please contact us at [CONTACT EMAIL].</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function PrivacyPolicy({ onBack }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-header">
          <BackButton onClick={onBack} />
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: [DATE]</p>
        </div>

        <div className="legal-content">
          <section>
            <h2>1. Information We Collect</h2>
            <h3>Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul>
              <li>Email address</li>
              <li>Display name (if provided)</li>
              <li>Account preferences</li>
            </ul>
            
            <h3>Usage Information</h3>
            <p>We collect information about how you use our service:</p>
            <ul>
              <li>Messages and conversations with L.U.C.I.A.</li>
              <li>Usage patterns and feature interactions</li>
              <li>Technical information (device type, browser, IP address)</li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide and improve the L.U.C.I.A. service</li>
              <li>Maintain your account and preferences</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Send important service updates</li>
              <li>Analyze usage patterns to improve our service</li>
            </ul>
          </section>

          <section>
            <h2>3. Information Sharing</h2>
            <p>We do not sell, trade, or otherwise transfer your personal information to third parties, except:</p>
            <ul>
              <li>With your explicit consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and safety</li>
              <li>With service providers who assist in our operations (under strict confidentiality agreements)</li>
            </ul>
          </section>

          <section>
            <h2>4. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
            <p>Your conversations are encrypted in transit and at rest. We use industry-standard security practices to protect your data.</p>
          </section>

          <section>
            <h2>5. Data Retention</h2>
            <p>We retain your personal information for as long as necessary to provide our services and comply with legal obligations. You can delete your conversations and account at any time through your account settings.</p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and data</li>
              <li>Export your data</li>
              <li>Opt out of non-essential communications</li>
            </ul>
          </section>

          <section>
            <h2>7. Cookies and Tracking</h2>
            <p>We use cookies and similar technologies to:</p>
            <ul>
              <li>Maintain your login session</li>
              <li>Remember your preferences</li>
              <li>Analyze service usage</li>
            </ul>
            <p>You can control cookie settings through your browser preferences.</p>
          </section>

          <section>
            <h2>8. Third-Party Services</h2>
            <p>Our service may integrate with third-party providers (such as authentication services). These providers have their own privacy policies, and we encourage you to review them.</p>
          </section>

          <section>
            <h2>9. International Users</h2>
            <p>If you are accessing our service from outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States where our servers are located.</p>
          </section>

          <section>
            <h2>10. Children's Privacy</h2>
            <p>Our service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will take steps to delete it promptly.</p>
          </section>

          <section>
            <h2>11. Changes to Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify users of significant changes by email or through our service. Your continued use of the service after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2>12. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices, please contact us at [CONTACT EMAIL].</p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default function LegalPages({ page, onBack }) {
  if (page === 'terms') {
    return <TermsOfService onBack={onBack} />
  }
  
  if (page === 'privacy') {
    return <PrivacyPolicy onBack={onBack} />
  }
  
  return null
}