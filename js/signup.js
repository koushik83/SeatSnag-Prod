// Import Firebase services from central config
import { db, auth } from './firebase-init.js';

// Import Firestore functions
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc, 
  query, 
  where, 
  serverTimestamp, 
  deleteDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// Import Firebase Auth functions
import { 
  createUserWithEmailAndPassword 
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

// Test Firebase connection
console.log('🔥 Firebase ready from central config');
console.log('🗄️ Firestore:', db);

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  setupPasswordValidation();
  setupRealTimeValidation();
  
  // Show validation tips
  console.log('🔒 SeatSnag Signup - Enhanced Security Active');
  console.log('✅ Email validation with typo detection');
  console.log('✅ Password strength validation');
  console.log('✅ Input sanitization and profanity filtering');
  console.log('✅ Rate limiting protection');
  console.log('✅ Duplicate prevention across all fields');
});

function showError(message) {
  const errorDiv = document.getElementById('errorFeedback');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  // Auto-hide after 8 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 8000);
}

// ========================================
// PASSWORD VALIDATION
// ========================================

function validatePassword(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password)
  };
}

function isPasswordStrong(password) {
  const validation = validatePassword(password);
  return validation.length && validation.uppercase && validation.lowercase && validation.number;
}

function setupPasswordValidation() {
  const passwordInput = document.getElementById('adminPassword');
  const confirmInput = document.getElementById('adminPasswordConfirm');
  const matchDiv = document.getElementById('passwordMatch');
  
  // Real-time password strength validation
  passwordInput.addEventListener('input', function() {
    const password = this.value;
    const validation = validatePassword(password);
    
    // Update each requirement indicator
    document.getElementById('req-length').classList.toggle('met', validation.length);
    document.getElementById('req-uppercase').classList.toggle('met', validation.uppercase);
    document.getElementById('req-lowercase').classList.toggle('met', validation.lowercase);
    document.getElementById('req-number').classList.toggle('met', validation.number);
    
    // Also check password match if confirm field has value
    if (confirmInput.value.length > 0) {
      checkPasswordMatch();
    }
  });
  
  // Real-time password match validation
  confirmInput.addEventListener('input', checkPasswordMatch);
  
  function checkPasswordMatch() {
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    
    if (confirm.length === 0) {
      matchDiv.className = 'password-match';
      matchDiv.textContent = '';
      return;
    }
    
    if (password === confirm) {
      matchDiv.textContent = '✓ Passwords match';
      matchDiv.className = 'password-match match';
    } else {
      matchDiv.textContent = '✗ Passwords do not match';
      matchDiv.className = 'password-match no-match';
    }
  }
}

// ========================================
// VALIDATION FUNCTIONS
// ========================================

function validateEmail(email) {
  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }

  // Check for common typos in domains
  const commonTypos = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com'
  };

  const domain = email.split('@')[1]?.toLowerCase();
  if (commonTypos[domain]) {
    return { 
      valid: false, 
      message: `Did you mean ${email.replace(domain, commonTypos[domain])}?` 
    };
  }

  // Warn about personal email domains
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
  if (personalDomains.includes(domain)) {
    return { 
      valid: true, 
      warning: 'Consider using your company email address for better organization' 
    };
  }

  return { valid: true };
}

function validateCompanyName(name) {
  // Length check
  if (name.length < 2) {
    return { valid: false, message: 'Company name must be at least 2 characters' };
  }
  if (name.length > 100) {
    return { valid: false, message: 'Company name must be less than 100 characters' };
  }

  // Basic profanity filter (extend this list as needed)
  const profanityList = ['test', 'fuck', 'shit', 'damn', 'fake', 'scam', 'spam'];
  const lowerName = name.toLowerCase();
  for (const word of profanityList) {
    if (lowerName.includes(word)) {
      return { valid: false, message: 'Please enter a professional company name' };
    }
  }

  // Check for suspicious patterns
  if (/^\d+$/.test(name)) {
    return { valid: false, message: 'Company name cannot be only numbers' };
  }

  if (/^[^a-zA-Z0-9\s&.-]+$/.test(name)) {
    return { valid: false, message: 'Company name contains invalid characters' };
  }

  return { valid: true };
}

function validateCompanyCode(code) {
  // Length check
  if (code.length < 2) {
    return { valid: false, message: 'Company code must be at least 2 characters' };
  }
  if (code.length > 6) {
    return { valid: false, message: 'Company code must be 6 characters or less' };
  }

  // Format check - alphanumeric only
  if (!/^[A-Z0-9]+$/.test(code)) {
    return { valid: false, message: 'Company code can only contain letters and numbers' };
  }

  // Reserved codes
  const reservedCodes = ['ADMIN', 'TEST', 'API', 'WWW', 'FTP', 'MAIL', 'DEMO', 'NULL', 'ROOT'];
  if (reservedCodes.includes(code)) {
    return { valid: false, message: 'This company code is reserved. Please choose another.' };
  }

  return { valid: true };
}

function validatePersonName(name, fieldName) {
  if (name.length < 1) {
    return { valid: false, message: `${fieldName} is required` };
  }
  if (name.length > 50) {
    return { valid: false, message: `${fieldName} must be less than 50 characters` };
  }

  // Only letters, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z\s'-]+$/.test(name)) {
    return { valid: false, message: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
  }

  // No consecutive spaces or special chars
  if (/\s{2,}|'{2,}|-{2,}/.test(name)) {
    return { valid: false, message: `${fieldName} cannot have consecutive special characters` };
  }

  return { valid: true };
}

function sanitizeInput(input) {
  // Remove potential XSS and trim
  return input.trim()
    .replace(/[<>"']/g, '')
    .replace(/\s+/g, ' ');
}

// ========================================
// REAL-TIME VALIDATION
// ========================================

function setupRealTimeValidation() {
  const companyNameField = document.getElementById('companyName');
  const companyCodeField = document.getElementById('companyCode');
  const emailField = document.getElementById('adminEmail');
  const firstNameField = document.getElementById('adminFirstName');
  const lastNameField = document.getElementById('adminLastName');

  // Company name validation
  companyNameField.addEventListener('blur', function() {
    const validation = validateCompanyName(this.value.trim());
    if (!validation.valid) {
      this.style.borderColor = '#ef4444';
      showFieldError(this, validation.message);
    } else {
      this.style.borderColor = '#22c55e';
      clearFieldError(this);
    }
  });

  // Company code validation
  companyCodeField.addEventListener('blur', function() {
    const validation = validateCompanyCode(this.value.trim());
    if (!validation.valid) {
      this.style.borderColor = '#ef4444';
      showFieldError(this, validation.message);
    } else {
      this.style.borderColor = '#22c55e';
      clearFieldError(this);
    }
  });

  // Email validation
  emailField.addEventListener('blur', function() {
    const validation = validateEmail(this.value.trim());
    if (!validation.valid) {
      this.style.borderColor = '#ef4444';
      showFieldError(this, validation.message);
    } else if (validation.warning) {
      this.style.borderColor = '#f59e0b';
      showFieldWarning(this, validation.warning);
    } else {
      this.style.borderColor = '#22c55e';
      clearFieldError(this);
    }
  });

  // Name validations
  firstNameField.addEventListener('blur', function() {
    const validation = validatePersonName(this.value.trim(), 'First name');
    if (!validation.valid) {
      this.style.borderColor = '#ef4444';
      showFieldError(this, validation.message);
    } else {
      this.style.borderColor = '#22c55e';
      clearFieldError(this);
    }
  });

  lastNameField.addEventListener('blur', function() {
    const validation = validatePersonName(this.value.trim(), 'Last name');
    if (!validation.valid) {
      this.style.borderColor = '#ef4444';
      showFieldError(this, validation.message);
    } else {
      this.style.borderColor = '#22c55e';
      clearFieldError(this);
    }
  });
}

function showFieldError(field, message) {
  clearFieldError(field);
  const errorSpan = document.createElement('span');
  errorSpan.className = 'field-error';
  errorSpan.textContent = message;
  errorSpan.style.color = '#ef4444';
  errorSpan.style.fontSize = '0.85em';
  errorSpan.style.marginTop = '4px';
  errorSpan.style.display = 'block';
  field.parentElement.appendChild(errorSpan);
}

function showFieldWarning(field, message) {
  clearFieldError(field);
  const warningSpan = document.createElement('span');
  warningSpan.className = 'field-error';
  warningSpan.textContent = message;
  warningSpan.style.color = '#f59e0b';
  warningSpan.style.fontSize = '0.85em';
  warningSpan.style.marginTop = '4px';
  warningSpan.style.display = 'block';
  field.parentElement.appendChild(warningSpan);
}

function clearFieldError(field) {
  const existingError = field.parentElement.querySelector('.field-error');
  if (existingError) {
    existingError.remove();
  }
  field.style.borderColor = '';
}

// ========================================
// RATE LIMITING
// ========================================

function checkRateLimit() {
  const lastAttempt = localStorage.getItem('lastSignupAttempt');
  const attemptCount = parseInt(localStorage.getItem('signupAttempts') || '0');
  
  if (lastAttempt) {
    const timeSinceLastAttempt = Date.now() - parseInt(lastAttempt);
    const oneHour = 60 * 60 * 1000;
    
    // Reset counter after 1 hour
    if (timeSinceLastAttempt > oneHour) {
      localStorage.removeItem('signupAttempts');
      localStorage.removeItem('lastSignupAttempt');
      return;
    }
    
    // Check if too many attempts
    if (attemptCount >= 5) {
      throw new Error('Too many signup attempts. Please try again in an hour.');
    }
  }
}

function recordSignupAttempt() {
  const currentAttempts = parseInt(localStorage.getItem('signupAttempts') || '0');
  localStorage.setItem('signupAttempts', (currentAttempts + 1).toString());
  localStorage.setItem('lastSignupAttempt', Date.now().toString());
}

// ========================================
// DUPLICATE CHECKING
// ========================================

async function checkDuplicates(companyName, companyCode, email) {
  try {
    console.log('🔍 Checking for duplicates...');
    
    // Check for duplicate company names
    const nameQuery = query(
      collection(db, 'companies'),
      where('name', '==', companyName)
    );
    const nameSnapshot = await getDocs(nameQuery);
    if (!nameSnapshot.empty) {
      throw new Error('A company with this name already exists');
    }

    // Check for duplicate company codes
    const codeQuery = query(
      collection(db, 'companies'),
      where('companyCode', '==', companyCode)
    );
    const codeSnapshot = await getDocs(codeQuery);
    if (!codeSnapshot.empty) {
      throw new Error('A company with this code already exists. Please choose a different code.');
    }

    // Check for duplicate email addresses
    const emailQuery = query(
      collection(db, 'companies'),
      where('adminEmail', '==', email)
    );
    const emailSnapshot = await getDocs(emailQuery);
    if (!emailSnapshot.empty) {
      throw new Error('An account with this email address already exists');
    }

    console.log('✅ No duplicates found');

  } catch (error) {
    throw error;
  }
}

// ========================================
// FIREBASE AUTH USER CREATION
// ========================================

async function createFirebaseAuthUser(email, password) {
  try {
    console.log('🔐 Creating Firebase Auth user...');
    
    // Create user account in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ Firebase Auth user created:', user.uid);
    console.log('   Email:', user.email);
    
    return {
      uid: user.uid,
      email: user.email
    };
    
  } catch (error) {
    console.error('❌ Firebase Auth error:', error);
    
    // Handle specific Firebase Auth errors
    let errorMessage = 'Failed to create account. ';
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage += 'This email is already registered.';
        break;
      case 'auth/invalid-email':
        errorMessage += 'Invalid email address.';
        break;
      case 'auth/weak-password':
        errorMessage += 'Password is too weak.';
        break;
      case 'auth/network-request-failed':
        errorMessage += 'Network error. Please check your connection.';
        break;
      default:
        errorMessage += error.message;
    }
    
    throw new Error(errorMessage);
  }
}

// ========================================
// COMPANY CREATION
// ========================================

async function createUnverifiedCompany(data) {
  try {
    console.log('📝 Creating company document...');

    // Generate verification token
    const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Extract domain from admin email for Google Workspace SSO
    const emailDomain = data.email.split('@')[1].toLowerCase();
    console.log('📧 Extracted domain:', emailDomain);

    // Create company document with authUid (NOT PIN!)
    const companyData = {
      name: data.name,
      companyCode: data.code,
      adminFirstName: data.firstName,
      adminLastName: data.lastName,
      adminEmail: data.email,
      domain: emailDomain, // For Google Workspace SSO employee matching
      authUid: data.authUid, // Link to Firebase Auth user
      teamSize: data.teamSize,

      // Verification status
      emailVerified: false,
      verificationToken: verificationToken,

      // Trial status (will be activated on verification)
      trialStatus: 'pending',
      trialStartDate: null,
      trialEndDate: null,

      // Status
      isActive: false, // Activated after email verification

      // Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Use setDoc with the authUid as the document ID
    // This makes it easy to find the company by the authenticated user's UID
    await setDoc(doc(db, 'companies', data.authUid), companyData);
    
    console.log('✅ Company created with ID:', data.authUid);
    
    return {
      companyId: data.authUid,
      verificationToken: verificationToken
    };
    
  } catch (error) {
    console.error('❌ Error creating company:', error);
    throw new Error('Failed to create company: ' + error.message);
  }
}

// ========================================
// EMAIL SENDING
// ========================================

async function sendVerificationEmail(data, verificationToken) {
  try {
    console.log('📧 Sending verification email...');
    console.log('   To:', data.email);
    console.log('   Company:', data.name);
    console.log('   Token:', verificationToken);
    
    const verificationLink = `${window.location.origin}/verify.html?token=${verificationToken}&company=${data.companyId}`;
    console.log('   Link:', verificationLink);
    
    const mailDoc = await addDoc(collection(db, 'mail'), {
      to: [data.email],
      message: {
        subject: '✉️ Verify Your Email - SeatSnag',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #667eea;">Welcome to SeatSnag, ${data.firstName}! 🚀</h1>
            <p>Thank you for signing up! Please verify your email address to activate your 14-day free trial.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Account Details:</h3>
              <p><strong>Company:</strong> ${data.name}</p>
              <p><strong>Email:</strong> ${data.email}</p>
            </div>
            
            <div style="margin: 30px 0;">
              <a href="${verificationLink}" 
                style="background: #667eea; color: white; padding: 16px 32px; 
                        text-decoration: none; border-radius: 8px; display: inline-block;
                        font-weight: 600;">
                Verify Email & Start Trial →
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              This link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.
            </p>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Need help? <a href="mailto:emma@seatsnag.io" style="color: #667eea;">Contact support</a>
            </p>
          </div>
        `
      }
    });
    
    console.log('✅ Verification email queued in Firestore');
    console.log('   Mail document ID:', mailDoc.id);
    console.log('   Check Firebase Console → Firestore → mail collection');
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('   Error details:', error.message);
    // Don't throw - email failure shouldn't stop signup
    console.warn('⚠️ Continuing despite email error');
  }
}

// ========================================
// MAIN SIGNUP HANDLER
// ========================================

window.handleSignup = async function(event) {
  event.preventDefault();
  
  try {
    console.log('🚀 Starting signup process...');
    
    // Rate limiting check
    checkRateLimit();

    // Get and sanitize form data
    const companyName = sanitizeInput(document.getElementById('companyName').value);
    const companyCode = sanitizeInput(document.getElementById('companyCode').value.toUpperCase());
    const teamSize = document.getElementById('teamSize').value;
    const firstName = sanitizeInput(document.getElementById('adminFirstName').value);
    const lastName = sanitizeInput(document.getElementById('adminLastName').value);
    const email = sanitizeInput(document.getElementById('adminEmail').value.toLowerCase());
    const password = document.getElementById('adminPassword').value; // Don't sanitize password
    const passwordConfirm = document.getElementById('adminPasswordConfirm').value;

    console.log('📋 Form data collected:', { companyName, companyCode, teamSize, firstName, lastName, email });

    // Comprehensive validation
    const companyNameValidation = validateCompanyName(companyName);
    if (!companyNameValidation.valid) {
      throw new Error(companyNameValidation.message);
    }

    const companyCodeValidation = validateCompanyCode(companyCode);
    if (!companyCodeValidation.valid) {
      throw new Error(companyCodeValidation.message);
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.message);
    }

    const firstNameValidation = validatePersonName(firstName, 'First name');
    if (!firstNameValidation.valid) {
      throw new Error(firstNameValidation.message);
    }

    const lastNameValidation = validatePersonName(lastName, 'Last name');
    if (!lastNameValidation.valid) {
      throw new Error(lastNameValidation.message);
    }

    if (!teamSize) {
      throw new Error('Please select your team size');
    }

    // Password validation
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (!isPasswordStrong(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    if (password !== passwordConfirm) {
      throw new Error('Passwords do not match');
    }

    console.log('✅ All validations passed');

    // Show loading state
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loadingState = document.getElementById('loadingState');
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    loadingState.style.display = 'flex';

    // Check for duplicates (email, company name, code)
    await checkDuplicates(companyName, companyCode, email);

    // Step 1: Create Firebase Auth user account
    const authUser = await createFirebaseAuthUser(email, password);

    // Step 2: Create company document linked to auth user
    const result = await createUnverifiedCompany({
      name: companyName,
      code: companyCode,
      firstName: firstName,
      lastName: lastName,
      email: email,
      authUid: authUser.uid, // Link company to Firebase Auth user
      teamSize: teamSize
    });

    // Step 3: Send verification email
    await sendVerificationEmail({
      companyId: result.companyId,
      name: companyName,
      firstName: firstName,
      lastName: lastName,
      email: email
    }, result.verificationToken);
    
    // Record successful signup
    localStorage.removeItem('signupAttempts');
    localStorage.removeItem('lastSignupAttempt');

    console.log('🎉 Signup completed successfully!');

    // Show verification success state
    showVerificationSuccessState({
      companyName: companyName,
      email: email
    });

  } catch (error) {
    console.error('❌ Signup error:', error);
    recordSignupAttempt();
    
    showError(error.message || 'Failed to create your account. Please try again.');
    
    // Reset button state
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loadingState = document.getElementById('loadingState');
    
    submitBtn.disabled = false;
    btnText.style.display = 'block';
    loadingState.style.display = 'none';
  }
};

// ========================================
// SUCCESS STATE
// ========================================

function showVerificationSuccessState(data) {
  document.getElementById('signupForm').style.display = 'none';
  document.getElementById('successState').style.display = 'block';
  
  // Update the success message for verification flow
  document.getElementById('successState').innerHTML = `
    <div class="success-icon">📧</div>
    <h2 class="success-title">Check Your Email!</h2>
    <p class="success-message">
      We've sent a verification email to <strong>${data.email}</strong>. 
      Click the verification link to activate your 14-day free trial.
    </p>
    
    <div class="success-details">
      <div class="success-details-title">🚀 What's Next?</div>
      <div class="detail-item">
        <span class="detail-label">
          <span>✉️</span>
          Check your email:
        </span>
        <span class="detail-value">${data.email}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">
          <span>🔗</span>
          Click the verification link
        </span>
        <span class="detail-value">Activate Trial</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">
          <span>⏰</span>
          Link expires in:
        </span>
        <span class="detail-value">24 hours</span>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <p style="color: #64748b; margin: 16px 0;">
        Can't find the email? Check your spam folder or 
        <a href="#" onclick="location.reload()" style="color: #667eea;">try signing up again</a>.
      </p>
    </div>
    
    <div class="signup-footer">
      <p>Need help? <a href="mailto:emma@seatsnag.io">Contact our support team</a></p>
    </div>
  `;
}

// ========================================
// AUTO-GENERATE COMPANY CODE
// ========================================

// Auto-generate company code from company name
document.getElementById('companyName').addEventListener('input', function() {
  const name = this.value.trim();
  const codeField = document.getElementById('companyCode');
  
  if (name && !codeField.value) {
    // Generate code from company name (first 4-6 chars, uppercase, alphanumeric only)
    let code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6);
    if (code.length < 2) {
      code = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    }
    codeField.value = code;
  }
});