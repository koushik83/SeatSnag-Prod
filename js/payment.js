// Import Firebase services from central config
import { db, auth } from './firebase-init.js';

// Import Firestore functions
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// Import Firebase Auth functions
import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

// Global variables
let currentUser = null;
let companyData = null;
let selectedPlan = null;
let selectedPrice = null;

// ========================================
// TRIAL STATUS CALCULATION
// ========================================

function getTrialStatus(company) {
  const now = new Date();
  const trialEnd = company.trialEndDate?.toDate ? company.trialEndDate.toDate() : new Date(company.trialEndDate);

  // Not yet started
  if (!company.trialStartDate) {
    return {
      status: 'pending',
      text: 'Trial not started',
      class: 'pending'
    };
  }

  // Calculate days remaining
  const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

  // Active trial (more than 3 days)
  if (daysLeft > 3) {
    return {
      status: 'active',
      text: `${daysLeft} days left in trial`,
      class: 'active'
    };
  }

  // Trial ending soon (3 days or less)
  if (daysLeft > 0) {
    return {
      status: 'expiring',
      text: `Only ${daysLeft} day${daysLeft > 1 ? 's' : ''} left!`,
      class: 'expiring'
    };
  }

  // Grace period (7 days after trial ends)
  const gracePeriodEnd = new Date(trialEnd);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
  const graceDaysLeft = Math.ceil((gracePeriodEnd - now) / (1000 * 60 * 60 * 24));

  if (graceDaysLeft > 0) {
    return {
      status: 'grace_period',
      text: `Grace period: ${graceDaysLeft} day${graceDaysLeft > 1 ? 's' : ''} left`,
      class: 'expired'
    };
  }

  // Expired completely
  return {
    status: 'expired',
    text: 'Trial expired',
    class: 'expired'
  };
}

// ========================================
// URL PARAMETERS
// ========================================

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    plan: urlParams.get('plan') || 'professional', // Default to professional
    companyId: urlParams.get('company')
  };
}

// ========================================
// LOAD COMPANY DATA
// ========================================

async function loadCompanyData() {
  try {
    console.log('📊 Loading company data...');

    // If companyId is in URL, use that
    const params = getUrlParams();
    console.log('URL Params:', params);
    let companyId = params.companyId;

    // Otherwise, use the authenticated user's ID
    if (!companyId && currentUser) {
      companyId = currentUser.uid;
      console.log('Using authenticated user UID:', companyId);
    }

    if (!companyId) {
      console.error('❌ No company ID found!');
      throw new Error('No company ID found. Please log in first.');
    }

    console.log('🔍 Fetching company document for ID:', companyId);

    // Fetch company document
    const companyDoc = await getDoc(doc(db, 'companies', companyId));

    if (!companyDoc.exists()) {
      throw new Error('Company not found');
    }

    companyData = {
      id: companyDoc.id,
      ...companyDoc.data()
    };

    console.log('✅ Company data loaded:', companyData);
    console.log('   Company Name:', companyData.name);
    console.log('   Admin Name:', companyData.adminFirstName, companyData.adminLastName);
    console.log('   Trial End:', companyData.trialEndDate);

    // Display company info
    displayCompanyInfo();

    // Pre-select plan from URL if specified
    if (params.plan) {
      const planPrices = {
        'starter': 9,
        'professional': 29,
        'business': 49
      };

      // Highlight the plan card
      highlightPlanCard(params.plan);

      // Auto-select the plan (optional - you can remove this if you want user to click)
      // selectPlan(params.plan, planPrices[params.plan]);
    }

  } catch (error) {
    console.error('❌ Error loading company data:', error);
    showError(error.message || 'Failed to load company information');
  }
}

// ========================================
// DISPLAY COMPANY INFO
// ========================================

function displayCompanyInfo() {
  console.log('🖼️ Displaying company info...');

  // Update company name
  const companyNameEl = document.getElementById('companyName');
  console.log('Company name element:', companyNameEl);
  if (companyNameEl) {
    companyNameEl.textContent = companyData.name || '-';
    console.log('Set company name to:', companyData.name);
  }

  // Update admin name
  const adminName = `${companyData.adminFirstName || ''} ${companyData.adminLastName || ''}`.trim() || '-';
  const adminNameEl = document.getElementById('adminName');
  console.log('Admin name element:', adminNameEl);
  if (adminNameEl) {
    adminNameEl.textContent = adminName;
    console.log('Set admin name to:', adminName);
  }

  // Update trial status
  const trialStatus = getTrialStatus(companyData);
  console.log('Trial status:', trialStatus);
  const trialStatusEl = document.getElementById('trialStatus');
  console.log('Trial status element:', trialStatusEl);
  if (trialStatusEl) {
    trialStatusEl.textContent = trialStatus.text;
    trialStatusEl.className = `info-value trial-status ${trialStatus.class}`;
    console.log('Set trial status to:', trialStatus.text);
  }

  console.log('✅ Company info display complete');
}

// ========================================
// HIGHLIGHT PLAN CARD
// ========================================

function highlightPlanCard(planName) {
  // Remove selected class from all cards
  document.querySelectorAll('.plan-card').forEach(card => {
    card.classList.remove('selected');
  });

  // Add selected class to the specified plan
  const planCard = document.querySelector(`.plan-card[data-plan="${planName}"]`);
  if (planCard) {
    planCard.classList.add('selected');
  }
}

// ========================================
// PLAN SELECTION
// ========================================

window.selectPlan = function(planName, price) {
  console.log(`✅ Plan selected: ${planName} ($${price}/month)`);

  selectedPlan = planName;
  selectedPrice = price;

  // Highlight the selected plan card
  highlightPlanCard(planName);

  // Update checkout section
  document.getElementById('selectedPlanName').textContent = planName.charAt(0).toUpperCase() + planName.slice(1);
  document.getElementById('selectedPlanPrice').textContent = `$${price}/month`;
  document.getElementById('totalPrice').textContent = `$${price}/month`;

  // Show checkout section
  document.getElementById('checkoutSection').style.display = 'block';

  // Scroll to checkout section
  document.getElementById('checkoutSection').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
};

// ========================================
// CHECKOUT HANDLER
// ========================================

async function handleCheckout() {
  console.log('💳 Initiating checkout...');

  if (!selectedPlan || !selectedPrice) {
    showError('Please select a plan first');
    return;
  }

  // Disable button and show loading
  const checkoutBtn = document.getElementById('checkoutBtn');
  const btnText = document.getElementById('checkoutBtnText');
  const loadingSpinner = document.getElementById('loadingSpinner');

  checkoutBtn.disabled = true;
  btnText.style.display = 'none';
  loadingSpinner.style.display = 'block';

  // Simulate processing time
  setTimeout(() => {
    // Hide all sections
    document.querySelector('.company-info-section').style.display = 'none';
    document.querySelector('.pricing-section').style.display = 'none';
    document.querySelector('.checkout-section').style.display = 'none';

    // Show "Coming Soon" success message
    document.getElementById('successMessage').style.display = 'block';

    // Re-enable button (in case user goes back)
    checkoutBtn.disabled = false;
    btnText.style.display = 'block';
    loadingSpinner.style.display = 'none';
  }, 1500);

  // TODO: When Stripe is integrated, replace above with:
  /*
  try {
    // Call Firebase Cloud Function to create Stripe Checkout Session
    const response = await fetch('/createCheckoutSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: companyData.id,
        plan: selectedPlan,
        price: selectedPrice
      })
    });

    const { sessionId } = await response.json();

    // Redirect to Stripe Checkout
    const stripe = Stripe('pk_test_YOUR_PUBLISHABLE_KEY');
    const { error } = await stripe.redirectToCheckout({ sessionId });

    if (error) {
      showError(error.message);
    }
  } catch (error) {
    console.error('❌ Checkout error:', error);
    showError('Failed to initiate checkout. Please try again.');
  }
  */
}

// ========================================
// ERROR HANDLING
// ========================================

function showError(message) {
  // Hide all sections
  document.querySelector('.company-info-section').style.display = 'none';
  document.querySelector('.pricing-section').style.display = 'none';
  document.querySelector('.checkout-section').style.display = 'none';

  // Show error message
  document.getElementById('errorText').textContent = message;
  document.getElementById('errorMessage').style.display = 'block';
}

// ========================================
// AUTHENTICATION STATE LISTENER
// ========================================

onAuthStateChanged(auth, async (user) => {
  console.log('🔐 Auth state changed:', user ? user.email : 'null');

  if (user) {
    currentUser = user;
    await loadCompanyData();
  } else {
    // User not logged in - redirect to admin login
    console.log('❌ User not authenticated, redirecting to admin login...');
    window.location.href = '/admin.html';
  }
});

// ========================================
// INITIALIZE
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Payment page initializing...');

  // Attach checkout button handler
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }

  console.log('✅ Payment page ready');
});
