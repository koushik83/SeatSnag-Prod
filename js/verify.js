// Import Firebase services from central config
import { db, auth } from './firebase-init.js';

// Import Firestore functions
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc,
  setDoc,
  query, 
  where, 
  serverTimestamp, 
  deleteDoc 
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// Get URL parameters
function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    token: urlParams.get('token'),
    company: urlParams.get('company')
  };
}

// Verify email and activate trial
async function verifyEmail() {
  const params = getUrlParams();
  
  if (!params.token || !params.company) {
    showError('Invalid verification link. Missing required parameters.');
    return;
  }

  try {
    console.log('🔍 Verifying token:', params.token, 'for company:', params.company);

    // Get company document
    const companyDoc = await getDoc(doc(db, 'companies', params.company));
    
    if (!companyDoc.exists()) {
      showError('Company not found. The link may be invalid.');
      return;
    }

    const companyData = companyDoc.data();

    // Check if token matches
    if (companyData.verificationToken !== params.token) {
      showError('Invalid verification token. The link may have been used already.');
      return;
    }

    // Check if already verified
    if (companyData.emailVerified) {
      showError('This email has already been verified. You can proceed to login.');
      return;
    }

    // Calculate trial dates
    const now = new Date();
    const trialStart = now;
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 14); // 14 days from now

    // Update company to verified and activate trial
    await updateDoc(doc(db, 'companies', params.company), {
      emailVerified: true,
      verificationToken: null, // Clear the token
      trialStatus: 'active',
      trialStartDate: trialStart,
      trialEndDate: trialEnd,
      isActive: true,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Email verified and trial activated!');

    // Send welcome email (NO PIN - use email instead)
    await sendWelcomeEmail({
      email: companyData.adminEmail,
      firstName: companyData.adminFirstName,
      companyName: companyData.name,
      trialEndDate: trialEnd
    });

    // Show success (with email instead of PIN)
    showSuccess({
      companyName: companyData.name,
      adminEmail: companyData.adminEmail,
      trialExpiry: trialEnd.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    });

  } catch (error) {
    console.error('❌ Verification error:', error);
    showError(`Verification failed: ${error.message}`);
  }
}

// Send welcome email
async function sendWelcomeEmail(data) {
  try {
    console.log('📧 Sending welcome email to:', data.email);
    
    await addDoc(collection(db, 'mail'), {
      to: [data.email],
      message: {
        subject: '🎉 Welcome to SeatSnag - Your Trial is Active!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #667eea;">Welcome to SeatSnag, ${data.firstName}! 🎉</h1>
            <p>Your email has been verified and your 14-day free trial is now active!</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Your Account Details:</h3>
              <p><strong>Company:</strong> ${data.companyName}</p>
              <p><strong>Login Email:</strong> <code style="background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${data.email}</code></p>
              <p><strong>Trial Expires:</strong> ${data.trialEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <div style="margin: 30px 0;">
              <a href="https://seatsnag-sso-dev.web.app/admin.html" 
                style="background: #667eea; color: white; padding: 16px 32px; 
                        text-decoration: none; border-radius: 8px; display: inline-block;
                        font-weight: 600;">
                Access Admin Panel →
              </a>
            </div>
            
            <div style="background: #e0f2fe; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #0369a1; margin-bottom: 8px;">🔐 Login Instructions:</h4>
              <p style="color: #0c4a6e; margin: 8px 0;">
                Use your <strong>email address</strong> and the <strong>password you created during signup</strong> to log into the admin panel.
              </p>
              <p style="color: #0c4a6e; margin: 8px 0; font-size: 14px;">
                Forgot your password? Click "Forgot Password" on the login page to reset it.
              </p>
            </div>
            
            <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #92400e; margin-bottom: 8px;">🚀 Next Steps:</h4>
              <ol style="color: #78350f; margin-left: 20px;">
                <li>Log in to the admin panel with your email and password</li>
                <li>Set up your office locations</li>
                <li>Configure seat capacities</li>
                <li>Generate access codes for your team</li>
                <li>Start managing bookings!</li>
              </ol>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Need help getting started? Check out our <a href="https://seatsnag.com/docs" style="color: #667eea;">documentation</a> 
              or <a href="mailto:emma@seatsnag.io" style="color: #667eea;">contact support</a>.
            </p>
          </div>
        `
      }
    });
    
    console.log('✅ Welcome email sent successfully');
    
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    // Don't throw - email failure shouldn't stop verification
  }
}

// Show success state
function showSuccess(data) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('successState').style.display = 'block';
  
  document.getElementById('companyName').textContent = data.companyName;
  document.getElementById('adminEmail').textContent = data.adminEmail;
  document.getElementById('trialExpiry').textContent = data.trialExpiry;
}

// Show error state
function showError(message) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('successState').style.display = 'none';
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('errorMessage').textContent = message;
}

// Retry verification
window.retryVerification = function() {
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('loadingState').style.display = 'block';
  setTimeout(() => verifyEmail(), 1000);
};

// Start verification on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Starting email verification process...');
  verifyEmail();
});