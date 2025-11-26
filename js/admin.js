
import { db, auth } from './firebase-init.js'; // <-- Added this

// Keep these Firestore function imports
import {
  
  collection,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
   } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';


// Import Firebase Authentication functions
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
  } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';


  // Helper function to calculate trial status dynamically
  function getTrialStatus(company) {
    const now = new Date();
    const trialEnd = company.trialEndDate?.toDate ? company.trialEndDate.toDate() : new Date(company.trialEndDate);
    
    // Not yet started
    if (!company.trialStartDate) {
      return { status: 'pending', daysLeft: 0, message: 'Trial not started', showBanner: false };
    }
    
    // Calculate days remaining
    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    
    // Active trial (more than 3 days)
    if (daysLeft > 3) {
      return { 
        status: 'active', 
        daysLeft: daysLeft, 
        message: `${daysLeft} days left in trial`,
        showBanner: false,
        readOnly: false,
        locked: false,
        text: `${daysLeft} days left in trial`,
        class: ''
      };
    }
    
    // Trial ending soon (3 days or less)
    if (daysLeft > 0) {
      return { 
        status: 'expiring', 
        daysLeft: daysLeft, 
        message: `Only ${daysLeft} day${daysLeft > 1 ? 's' : ''} left in trial!`,
        showBanner: true,
        urgent: true,
        readOnly: false,
        locked: false,
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
        daysLeft: graceDaysLeft, 
        message: `Trial expired. ${graceDaysLeft} day${graceDaysLeft > 1 ? 's' : ''} grace period remaining`,
        showBanner: true,
        urgent: true,
        readOnly: true,
        locked: false,
        text: `Grace period: ${graceDaysLeft} day${graceDaysLeft > 1 ? 's' : ''} left`,
        class: 'expired'
      };
    }
    
    // Expired completely
    return { 
      status: 'expired', 
      daysLeft: 0, 
      message: 'Trial and grace period expired. Upgrade to continue.',
      showBanner: true,
      urgent: true,
      readOnly: true,
      locked: true,
      text: 'Trial expired',
      class: 'expired'
    };
  } 

   // ========================================
// Access Code Generation Functions
// ========================================

// Generate random access code (6 characters, alphanumeric, no confusing chars)
    function generateAccessCode() {
      // Exclude confusing characters: 0, O, I, 1, l
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      
      // Generate 6-character code
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      
      return code;
    }

    // Generate and display code in the form (called by Generate button)
    window.generateAndDisplayCode = function() {
      const code = generateAccessCode();
      const input = document.getElementById('locationAccessCode');
      input.value = code;
      
      // Visual feedback
      input.style.borderColor = '#22c55e';
      input.style.boxShadow = '0 0 0 4px rgba(34, 197, 94, 0.1)';
      
      setTimeout(() => {
        input.style.borderColor = '';
        input.style.boxShadow = '';
      }, 1000);
      
      console.log('✅ Generated access code:', code);
    };

    // Check if access code already exists in database
    async function isAccessCodeUnique(code) {
      try {
        const locationsQuery = query(
          collection(db, 'locations'),
          where('accessCode', '==', code.toUpperCase())
        );
        const snapshot = await getDocs(locationsQuery);
        return snapshot.empty; // Returns true if code is unique
      } catch (error) {
        console.error('Error checking code uniqueness:', error);
        return false;
      }
    }


  // Function to show trial banner
  function showTrialBanner(trialStatus) {
    const banner = document.getElementById('trialBanner');
    const icon = document.getElementById('bannerIcon');
    const message = document.getElementById('bannerMessage');
    const upgradeBtn = document.getElementById('upgradeBtn');
    
    if (!trialStatus.showBanner) {
      banner.style.display = 'none';
      return;
    }
    
    banner.style.display = 'block';
    message.textContent = trialStatus.message;
    
    // Remove existing classes
    banner.classList.remove('urgent', 'grace');
    
    if (trialStatus.status === 'expiring') {
      banner.classList.add('urgent');
      icon.textContent = '⚠️';
    } else if (trialStatus.status === 'grace_period') {
      banner.classList.add('grace');
      icon.textContent = '📢';
      message.textContent = `Grace Period: ${trialStatus.message}`;
    }
    
    upgradeBtn.onclick = function() {
      // Redirect to payment page with professional plan and current company ID
      window.location.href = `/payment.html?plan=professional&company=${currentUser.id}`;
    };
  }

  // Global variables
  let companies = [];
  let locations = [];
  let bookings = [];
  let currentUser = null;
  let userType = null; // 'super_admin' or 'company_admin'

  const SUPER_ADMIN_EMAILS = [
  'seatsnagbusiness@gmail.com',
  'koushik83@gmail.com'
  ];

  // Check if user is super admin
  function isSuperAdmin(email) {
    return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

  // ========================================
  // Authentication & User Management
  // ========================================
 /*
  async function loadCompaniesForLogin() {
    try {
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      companies = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const select = document.getElementById('loginCompany');
      select.innerHTML = '<option value="">Choose your company...</option>';
      
      companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = company.name;
        select.appendChild(option);
      });
      
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  }
    

  window.handleLogin = async function() {
    const companyId = document.getElementById('loginCompany').value;
    const pin = document.getElementById('loginPin').value.trim();

    if (!companyId || !pin) {
      alert('Please select a company and enter your PIN');
      return;
    }

    const company = companies.find(c => c.id === companyId);
    if (!company) {
      alert('Company not found');
      return;
    }

    if (company.secretPin !== pin) {
      alert('Invalid PIN for this company');
      return;
    }
      
    // Check trial status
    const trialStatus = getTrialStatus(company);

    if (trialStatus.locked) {
      alert('Your trial and grace period have expired. Please upgrade to continue using SeatSnag.');
      return;
    }
    
    // Successful login
    currentUser = company;
    currentUser.trialStatus = trialStatus;
    userType = 'company_admin';
    
    showDashboard();
    await loadAllData();

    if (trialStatus.showBanner) {
      showTrialBanner(trialStatus);
    }
  };

  window.switchToSuperAdmin = function() {
    currentUser = { name: 'Super Admin', role: 'Super Admin' };
    userType = 'super_admin';
    
    showDashboard();
    loadAllData();
  };
    
  window.logout = function() {
    currentUser = null;
    userType = null;
    
    document.getElementById('loginCompany').value = '';
    document.getElementById('loginPin').value = '';
    
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('mainDashboard').style.display = 'none';
  };
  */ 
// Showdashboard function

// ========================================
// NEW SECURE AUTHENTICATION
// ========================================

/**
 * Handles secure login using Firebase Authentication
 * Sends credentials to Firebase servers for verification
 */
async function handleSecureLogin() {
  // Step 1: Get the form elements
  const emailInput = document.getElementById('adminEmailInput');
  const passwordInput = document.getElementById('adminPasswordInput');
  const loginButton = document.getElementById('loginBtn');
  
  // Step 2: Get the values from inputs
  const email = emailInput.value.trim();
  const password = passwordInput.value; // Don't trim password - spaces might be intentional
  
  // Step 3: Validate inputs are not empty
  if (!email || !password) {
    alert('Please enter both email and password.');
    return;
  }
  
  // Step 4: Basic email format check
  if (!email.includes('@') || !email.includes('.')) {
    alert('Please enter a valid email address.');
    return;
  }
  
  // Step 5: Show loading state (prevents double-clicks)
  loginButton.textContent = 'Logging in...';
  loginButton.disabled = true;
  
  try {
    // Step 6: THE MAGIC LINE - Send to Firebase servers
    // This is where real security happens!
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Step 7: Success! User is authenticated
    console.log('✅ Admin logged in successfully:', userCredential.user.email);
    console.log('   User UID:', userCredential.user.uid);
    
    // Note: We DON'T manually show the dashboard here
    // onAuthStateChanged will automatically detect this and update UI
    
  } catch (error) {
    // Step 8: Login failed - handle the error
    console.error('❌ Login failed:', error.code, error.message);
    
    // Step 9: Show user-friendly error message
    let errorMessage = 'Login failed. ';
    
    // Translate Firebase error codes to human-readable messages
    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage += 'Invalid email address format.';
        break;
      case 'auth/user-not-found':
        errorMessage += 'No account found with this email.';
        break;
      case 'auth/wrong-password':
        errorMessage += 'Incorrect password.';
        break;
      case 'auth/too-many-requests':
        errorMessage += 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/network-request-failed':
        errorMessage += 'Network error. Check your internet connection.';
        break;
      case 'auth/user-disabled':
        errorMessage += 'This account has been disabled.';
        break;
      default:
        errorMessage += error.message;
    }
    
    alert(errorMessage);
    
    // Step 10: Reset button state so user can try again
    loginButton.textContent = 'Admin Login';
    loginButton.disabled = false;
  }
}
/*
  function showDashboard() {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('mainDashboard').style.display = 'block';
      
      if (userType === 'super_admin') {
        document.getElementById('dashboardSubtitle').textContent = 'Super Admin - Full System Access';
        document.getElementById('superAdminSection').style.display = 'block';
        document.getElementById('recentSignupsSection').style.display = 'block';
        document.getElementById('companyAdminSection').style.display = 'none';
        document.getElementById('companiesTitle').textContent = 'All Companies';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userAvatar').textContent = 'SA';
        document.getElementById('userName').textContent = 'Super Admin';
        document.getElementById('userRole').textContent = 'Full Access';
      } else {
        document.getElementById('dashboardSubtitle').textContent = `Company Admin - ${currentUser.name}`;
        document.getElementById('superAdminSection').style.display = 'none';
        document.getElementById('recentSignupsSection').style.display = 'none';
        document.getElementById('companyAdminSection').style.display = 'block';
        document.getElementById('companiesTitle').textContent = 'Your Locations';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userAvatar').textContent = (currentUser.adminFirstName?.[0] || 'A').toUpperCase();
        document.getElementById('userName').textContent = `${currentUser.adminFirstName} ${currentUser.adminLastName}`;
        document.getElementById('userRole').textContent = currentUser.name;
        
        // NEW: Auto-generate access code when company admin logs in
        setTimeout(() => {
          const accessCodeInput = document.getElementById('locationAccessCode');
          if (accessCodeInput && accessCodeInput.value === '') {
            generateAndDisplayCode();
            console.log('🎲 Auto-generated initial access code');
          }
        }, 500);
      }
    }
  */

 // ========================================
// AUTHENTICATION STATE LISTENER
// ========================================

/**
 * Firebase Auth State Listener
 * THE CORE of the authentication system
 * Automatically runs whenever auth state changes
 */

// ========================================
// AUTHENTICATION STATE LISTENER
// ========================================

/**
 * Firebase Auth State Listener
 * THE CORE of the authentication system
 * Automatically runs whenever auth state changes
 */
onAuthStateChanged(auth, async (user) => {
  console.log('🔐 Auth state changed, user:', user ? user.email : 'null');
  
  // Get DOM elements
  const loginScreen = document.getElementById('loginScreen');
  const mainDashboard = document.getElementById('mainDashboard');
  const userInfoDisplay = document.getElementById('userInfo');
  const superAdminSection = document.getElementById('superAdminSection');
  const recentSignupsSection = document.getElementById('recentSignupsSection');
  const companyAdminSection = document.getElementById('companyAdminSection');
  
  if (user) {
    // ========== USER IS LOGGED IN ==========
    console.log('✅ User is authenticated:', user.email);
    console.log('   User UID:', user.uid);
    
    
    // Store user info globally
      currentUser = { 
        email: user.email, 
        uid: user.uid,
        emailVerified: user.emailVerified,
        id: user.uid  // CRITICAL for where('companyId', '==', currentUser.id)
      };

      // Check if super admin and SET userType
      const isAdmin = isSuperAdmin(user.email);
      userType = isAdmin ? 'super_admin' : 'company_admin';
      console.log('User Type set to:', userType);
      console.log('Is Super Admin:', isAdmin);

      // For company admins, load their company data
      if (!isAdmin) {
        try {
          const companyDoc = await getDoc(doc(db, 'companies', user.uid));
          if (companyDoc.exists()) {
            const companyData = companyDoc.data();
            currentUser.name = companyData.name;
            currentUser.companyCode = companyData.companyCode;
            currentUser.trialStatus = getTrialStatus(companyData);
            console.log('Company data loaded:', currentUser.name);
          } else {
            console.error('No company document found for UID:', user.uid);
          }
        } catch (error) {
          console.error('Error loading company data:', error);
        }
      }

      // Update user info display in header
      if (userInfoDisplay) {
        if (isAdmin) {
          document.getElementById('userName').textContent = user.email || 'Admin';
          document.getElementById('userRole').textContent = 'Super Administrator';
          document.getElementById('userAvatar').textContent = 'SA';
        } else {
          document.getElementById('userName').textContent = currentUser.name || user.email;
          document.getElementById('userRole').textContent = 'Company Administrator';
          const firstLetter = currentUser.name ? currentUser.name[0].toUpperCase() : user.email[0].toUpperCase();
          document.getElementById('userAvatar').textContent = firstLetter;
        }
        userInfoDisplay.style.display = 'flex';
      }

      // Switch screens: hide login, show dashboard
      if (loginScreen) loginScreen.style.display = 'none';
      if (mainDashboard) mainDashboard.style.display = 'block';

      // Show/hide sections based on role
      if (isAdmin) {
        // SUPER ADMIN - Show everything
        console.log('Super Admin view activated');
        if (superAdminSection) superAdminSection.style.display = 'block';
        if (recentSignupsSection) recentSignupsSection.style.display = 'block';
        if (companyAdminSection) companyAdminSection.style.display = 'block';
        
        // Update titles for super admin
        const companiesTitle = document.getElementById('companiesTitle');
        if (companiesTitle) companiesTitle.textContent = 'All Companies';
        
        const dashboardSubtitle = document.getElementById('dashboardSubtitle');
        if (dashboardSubtitle) dashboardSubtitle.textContent = 'Super Admin - Full System Access';
        
      } else {
        // COMPANY ADMIN - Hide super admin sections
        console.log('Company Admin view activated');
        if (superAdminSection) superAdminSection.style.display = 'none';
        if (recentSignupsSection) recentSignupsSection.style.display = 'none';
        if (companyAdminSection) companyAdminSection.style.display = 'block';
        
        // Update titles for company admin
        const companiesTitle = document.getElementById('companiesTitle');
        if (companiesTitle) companiesTitle.textContent = 'Your Locations';
        
        const dashboardSubtitle = document.getElementById('dashboardSubtitle');
        if (dashboardSubtitle) {
          dashboardSubtitle.textContent = `Company Admin - ${currentUser.name || 'Manage Your Workspace'}`;
        }
        
        // Show trial banner if needed
        if (currentUser.trialStatus && currentUser.trialStatus.showBanner) {
          showTrialBanner(currentUser.trialStatus);
        }

        // Show upgrade button in header for company admins
        const upgradeBtnHeader = document.getElementById('upgradeBtnHeader');
        if (upgradeBtnHeader) {
          upgradeBtnHeader.style.display = 'block';
        }
      }
        
    // Load data
    try {
      await loadAllData();
      console.log('📊 Data loaded successfully');

      // Show analytics dashboard
      showAnalytics();
    } catch (error) {
      console.error('❌ Error loading data:', error);
    }

  } else {
    // ========== USER IS LOGGED OUT ==========
    console.log('❌ User is not authenticated');

    currentUser = null;

    // Hide user info
    if (userInfoDisplay) userInfoDisplay.style.display = 'none';

    // Hide analytics
    const analyticsSection = document.getElementById('analyticsSection');
    if (analyticsSection) analyticsSection.style.display = 'none';

    // Switch screens: show login, hide dashboard
    if (loginScreen) loginScreen.style.display = 'block';
    if (mainDashboard) mainDashboard.style.display = 'none';
    
    // Clear data
    const dataList = document.getElementById('dataList');
    if (dataList) {
      dataList.innerHTML = '<div class="loading">Please log in to view data.</div>';
    }
    
    // Reset stats
    const stats = {
      'totalCompanies': '-',
      'totalLocations': '-',
      'totalSeats': '-',
      'activeBookings': '-'
    };
    
    for (const [id, value] of Object.entries(stats)) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }
  }
  
  // Reset login button state
  const loginButton = document.getElementById('loginBtn');
  if (loginButton) {
    loginButton.textContent = 'Admin Login';
    loginButton.disabled = false;
  }
});


// ========================================
// UPGRADE NAVIGATION FUNCTION
// ========================================

/**
 * Navigate to upgrade/payment page
 * Redirects company admin to payment page with their company ID
 */
window.goToUpgrade = function() {
  console.log('🚀 Navigating to upgrade page...');

  if (!currentUser || !currentUser.id) {
    console.error('❌ No current user found');
    alert('Please log in first');
    return;
  }

  // Redirect to payment page with professional plan (default) and company ID
  window.location.href = `/payment.html?plan=professional&company=${currentUser.id}`;
};

// ========================================
// LOGOUT FUNCTION
// ========================================

/**
 * Logout function
 * Calls Firebase signOut, which destroys the authentication token
 * onAuthStateChanged will automatically detect this and update UI
 */
window.logout = async function() {
  console.log('🚪 Logging out...');
  
  try {
    // Call Firebase to sign out
    // This destroys the auth token on Firebase servers
    await signOut(auth);
    
    console.log('✅ User signed out successfully');
    
    // onAuthStateChanged will automatically:
    // - Detect the logout
    // - Hide dashboard
    // - Show login screen
    // - Clear data
    // No need to do anything else here!
    
  } catch (error) {
    console.error('❌ Sign out failed:', error);
    alert('Logout failed. Please try again.');
  }
};

  // ========================================
  // Firebase Database Functions
  // ========================================

  async function loadAllData() {
    try {
      // Load companies
      const companiesSnapshot = await getDocs(collection(db, 'companies'));
      companies = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const trialsSnapshot = await getDocs(collection(db, 'trials'));
      const trialsMap = {};
      trialsSnapshot.docs.forEach(doc => {
        trialsMap[doc.id] = doc.data();
      });

      // Merge trial data with companies
      companies = companies.map(company => ({
        ...company,
        trialStartDate: trialsMap[company.id]?.startDate,
        trialEndDate: trialsMap[company.id]?.endDate,
        trialActive: trialsMap[company.id]?.isActive
      }));

      // Load locations
      let locationsQuery;
      if (userType === 'company_admin') {
        locationsQuery = query(
          collection(db, 'locations'),
          where('companyId', '==', currentUser.id)
        );
      } else {
        locationsQuery = collection(db, 'locations');
      }
      
      const locationsSnapshot = await getDocs(locationsQuery);
      locations = locationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load today's bookings for stats
      const today = new Date().toISOString().split('T')[0];
      let bookingsQuery;
      if (userType === 'company_admin') {
        const companyLocationIds = locations.map(loc => loc.id);
        if (companyLocationIds.length > 0) {
          bookingsQuery = query(
            collection(db, 'bookings'),
            where('locationId', 'in', companyLocationIds),
            where('bookingDate', '==', today),
            where('status', '==', 'active')
          );
        } else {
          bookings = [];
          renderData();
          updateStats();
          return;
        }
      } else {
        bookingsQuery = query(
          collection(db, 'bookings'),
          where('bookingDate', '==', today),
          where('status', '==', 'active')
        );
      }
      
      const bookingsSnapshot = await getDocs(bookingsQuery);
      bookings = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      renderData();
      updateStats();

      // Load recent signups only for super admins
      if (currentUser && isSuperAdmin(currentUser.email)) {
        await loadRecentSignups();
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load data. Please refresh and try again.');
    }
  }

  // ========================================
  // ANALYTICS DASHBOARD
  // ========================================

  // Analytics state
  let currentAnalyticsPeriod = '1w';
  let analyticsBookings = [];

  /**
   * Calculate date range for analytics period
   * @param {string} period - '1w', '1m', '3m', '1y'
   * @returns {Object} { startDate, endDate, daysCount }
   */
  function getAnalyticsDateRange(period) {
    const endDate = new Date();
    const startDate = new Date();

    let daysCount;
    switch(period) {
      case '1w':
        daysCount = 7;
        break;
      case '1m':
        daysCount = 30;
        break;
      case '3m':
        daysCount = 90;
        break;
      case '1y':
        daysCount = 365;
        break;
      default:
        daysCount = 7;
    }

    startDate.setDate(endDate.getDate() - daysCount);

    // Format as YYYY-MM-DD (Firestore storage format)
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      daysCount
    };
  }

  /**
   * Load analytics data from Firestore
   * Respects role-based access (super admin vs company admin)
   */
  async function loadAnalyticsData(period) {
    try {
      console.log('📊 Loading analytics for period:', period);
      console.log('📍 Current locations array:', locations);
      console.log('👤 Current user type:', userType);

      // Show loading states
      document.getElementById('trendChartLoading').style.display = 'flex';
      document.getElementById('locationPerformanceLoading').style.display = 'flex';
      document.getElementById('heatmapLoading').style.display = 'flex';
      document.getElementById('trendChart').innerHTML = '';
      document.getElementById('locationPerformance').innerHTML = '';
      document.getElementById('weeklyHeatmap').innerHTML = '';

      const dateRange = getAnalyticsDateRange(period);
      console.log('📅 Date range:', dateRange);

      // Check if locations are loaded
      if (!locations || locations.length === 0) {
        console.warn('⚠️ No locations found, showing empty state');
        analyticsBookings = [];
        renderAnalytics();
        return;
      }

      // Build query based on user role
      let bookingsQuery;
      if (userType === 'company_admin') {
        // Company admin: only their locations
        const companyLocationIds = locations.map(loc => loc.id);
        if (companyLocationIds.length === 0) {
          console.log('⚠️ No locations found for company admin');
          analyticsBookings = [];
          renderAnalytics();
          return;
        }

        bookingsQuery = query(
          collection(db, 'bookings'),
          where('locationId', 'in', companyLocationIds.slice(0, 10)), // Firestore 'in' limit
          where('bookingDate', '>=', dateRange.startDate),
          where('bookingDate', '<=', dateRange.endDate),
          where('status', '==', 'active')
        );
      } else {
        // Super admin: all bookings
        bookingsQuery = query(
          collection(db, 'bookings'),
          where('bookingDate', '>=', dateRange.startDate),
          where('bookingDate', '<=', dateRange.endDate),
          where('status', '==', 'active')
        );
      }

      const bookingsSnapshot = await getDocs(bookingsQuery);
      analyticsBookings = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`✅ Loaded ${analyticsBookings.length} bookings`);

      // Render all analytics visualizations
      renderAnalytics();

    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      console.error('Error details:', error.message, error.code);

      // Check if it's a Firestore index error
      if (error.message && error.message.includes('index')) {
        console.error('🔴 Firestore index required. Check console for link to create index.');
      }

      document.getElementById('trendChartLoading').innerHTML = `Failed to load: ${error.message || 'Unknown error'}`;
      document.getElementById('locationPerformanceLoading').innerHTML = 'Failed to load';
      document.getElementById('heatmapLoading').innerHTML = 'Failed to load';
    }
  }

  /**
   * Calculate daily utilization percentage
   * Returns array of {date, utilization, bookings, capacity}
   */
  function calculateDailyUtilization() {
    const dateRange = getAnalyticsDateRange(currentAnalyticsPeriod);
    const dailyData = [];

    // Generate all dates in range
    const currentDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Calculate utilization for this date
      const dayBookings = analyticsBookings.filter(b => b.bookingDate === dateStr);

      // Calculate per-location utilization, then average
      let totalUtilization = 0;
      let locationCount = 0;

      locations.forEach(location => {
        const locationBookings = dayBookings.filter(b => b.locationId === location.id);
        const locationUtilization = (locationBookings.length / location.capacity) * 100;
        totalUtilization += locationUtilization;
        locationCount++;
      });

      const avgUtilization = locationCount > 0 ? totalUtilization / locationCount : 0;
      const totalCapacity = locations.reduce((sum, loc) => sum + loc.capacity, 0);

      dailyData.push({
        date: dateStr,
        utilization: Math.round(avgUtilization * 10) / 10, // Round to 1 decimal
        bookings: dayBookings.length,
        capacity: totalCapacity
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyData;
  }

  /**
   * Calculate location performance over the period
   * Returns array sorted by utilization descending
   */
  function calculateLocationPerformance() {
    const dateRange = getAnalyticsDateRange(currentAnalyticsPeriod);
    const locationPerf = [];

    locations.forEach(location => {
      const locationBookings = analyticsBookings.filter(b => b.locationId === location.id);
      const totalPossibleBookings = location.capacity * dateRange.daysCount;
      const utilizationPct = (locationBookings.length / totalPossibleBookings) * 100;
      const avgDailyBookings = locationBookings.length / dateRange.daysCount;

      locationPerf.push({
        id: location.id,
        name: location.name,
        utilization: Math.round(utilizationPct * 10) / 10,
        totalBookings: locationBookings.length,
        avgDailyBookings: Math.round(avgDailyBookings * 10) / 10,
        capacity: location.capacity
      });
    });

    // Sort by utilization descending
    locationPerf.sort((a, b) => b.utilization - a.utilization);

    return locationPerf;
  }

  /**
   * Calculate weekly heatmap data (4 weeks × 5 weekdays)
   * Returns 2D array [week][day] with {utilization, bookings, capacity}
   */
  function calculateWeeklyHeatmap() {
    const heatmapData = [];
    const today = new Date();

    // Calculate last 4 weeks
    for (let weekIndex = 3; weekIndex >= 0; weekIndex--) {
      const weekData = [];

      // For each weekday (Mon-Fri)
      for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (weekIndex * 7) - (today.getDay() - 1 - dayIndex));

        // Adjust if date is not a weekday
        if (date.getDay() === 0) date.setDate(date.getDate() + 1); // Sunday -> Monday
        if (date.getDay() === 6) date.setDate(date.getDate() + 2); // Saturday -> Monday

        const dateStr = date.toISOString().split('T')[0];
        const dayBookings = analyticsBookings.filter(b => b.bookingDate === dateStr);
        const totalCapacity = locations.reduce((sum, loc) => sum + loc.capacity, 0);
        const utilization = totalCapacity > 0 ? (dayBookings.length / totalCapacity) * 100 : 0;

        weekData.push({
          date: dateStr,
          utilization: Math.round(utilization),
          bookings: dayBookings.length,
          capacity: totalCapacity,
          dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][dayIndex]
        });
      }

      heatmapData.push(weekData);
    }

    return heatmapData;
  }

  /**
   * Render utilization trend chart as SVG
   */
  function renderUtilizationTrendChart(dailyData) {
    const container = document.getElementById('trendChart');
    container.innerHTML = '';

    if (dailyData.length === 0) {
      container.innerHTML = '<div class="analytics-empty"><div class="analytics-empty-icon">📊</div><h4>No booking data</h4><p>No bookings found for this period</p></div>';
      return;
    }

    // Calculate summary stats
    const totalBookings = dailyData.reduce((sum, d) => sum + d.bookings, 0);
    const avgUtilization = dailyData.reduce((sum, d) => sum + d.utilization, 0) / dailyData.length;
    const peakDay = dailyData.reduce((max, d) => d.utilization > max.utilization ? d : max, dailyData[0]);

    document.getElementById('avgUtilization').textContent = `${Math.round(avgUtilization)}%`;
    document.getElementById('totalBookings').textContent = totalBookings;
    document.getElementById('peakDay').textContent = new Date(peakDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // SVG dimensions
    const width = container.clientWidth || 800;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Scales
    const maxUtilization = Math.max(...dailyData.map(d => d.utilization), 100);
    const xScale = (index) => padding.left + (index / (dailyData.length - 1)) * chartWidth;
    const yScale = (value) => padding.top + chartHeight - (value / maxUtilization) * chartHeight;

    // Grid lines (horizontal)
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartHeight;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padding.left);
      line.setAttribute('y1', y);
      line.setAttribute('x2', padding.left + chartWidth);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', '#e5e7eb');
      line.setAttribute('stroke-width', '1');
      gridGroup.appendChild(line);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', padding.left - 10);
      label.setAttribute('y', y + 4);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '12');
      label.setAttribute('fill', '#6b7280');
      label.textContent = `${Math.round((1 - i / 4) * maxUtilization)}%`;
      gridGroup.appendChild(label);
    }
    svg.appendChild(gridGroup);

    // Create gradient area path
    let areaPath = `M ${xScale(0)} ${yScale(0)}`;
    dailyData.forEach((d, i) => {
      areaPath += ` L ${xScale(i)} ${yScale(d.utilization)}`;
    });
    areaPath += ` L ${xScale(dailyData.length - 1)} ${yScale(0)} Z`;

    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', areaPath);
    area.setAttribute('fill', 'url(#gradient)');
    area.setAttribute('opacity', '0.3');
    svg.appendChild(area);

    // Gradient definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('style', 'stop-color:#667eea;stop-opacity:1');
    gradient.appendChild(stop1);

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('style', 'stop-color:#764ba2;stop-opacity:0.3');
    gradient.appendChild(stop2);

    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Create line path
    let linePath = `M ${xScale(0)} ${yScale(dailyData[0].utilization)}`;
    dailyData.forEach((d, i) => {
      if (i > 0) {
        linePath += ` L ${xScale(i)} ${yScale(d.utilization)}`;
      }
    });

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#667eea');
    line.setAttribute('stroke-width', '3');
    svg.appendChild(line);

    // Data points with tooltips
    dailyData.forEach((d, i) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', xScale(i));
      circle.setAttribute('cy', yScale(d.utilization));
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', '#667eea');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      circle.style.cursor = 'pointer';

      // Tooltip on hover
      circle.addEventListener('mouseenter', (e) => {
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.innerHTML = `
          <div class="chart-tooltip-date">${new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          <div class="chart-tooltip-value">${d.utilization}% utilization</div>
          <div>${d.bookings} / ${d.capacity} seats</div>
        `;
        tooltip.style.left = `${xScale(i)}px`;
        tooltip.style.top = `${yScale(d.utilization) - 80}px`;
        container.appendChild(tooltip);
        circle.tooltip = tooltip;
      });

      circle.addEventListener('mouseleave', () => {
        if (circle.tooltip) {
          circle.tooltip.remove();
        }
      });

      svg.appendChild(circle);
    });

    // X-axis labels (show 5-7 dates evenly spaced)
    const labelCount = Math.min(7, dailyData.length);
    const labelStep = Math.floor(dailyData.length / labelCount);
    for (let i = 0; i < dailyData.length; i += labelStep) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', xScale(i));
      label.setAttribute('y', height - 10);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('fill', '#6b7280');
      label.textContent = new Date(dailyData[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      svg.appendChild(label);
    }

    container.appendChild(svg);
  }

  /**
   * Render location performance cards
   */
  function renderLocationPerformance(locationPerf) {
    const container = document.getElementById('locationPerformance');

    if (locationPerf.length === 0) {
      container.innerHTML = '<div class="analytics-empty"><div class="analytics-empty-icon">🏢</div><h4>No locations</h4></div>';
      return;
    }

    container.innerHTML = locationPerf.map(loc => `
      <div class="location-perf-card">
        <div class="location-perf-header">
          <span class="location-perf-name">${loc.name}</span>
          <span class="location-perf-percentage">${loc.utilization}%</span>
        </div>
        <div class="location-perf-meta">
          <span>📊 ${loc.totalBookings} bookings</span>
          <span>📅 ${loc.avgDailyBookings}/day avg</span>
          <span>💺 ${loc.capacity} capacity</span>
        </div>
        <div class="location-perf-bar">
          <div class="location-perf-bar-fill" style="width: ${Math.min(loc.utilization, 100)}%"></div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render weekly heatmap
   */
  function renderWeeklyHeatmap(heatmapData) {
    const container = document.getElementById('weeklyHeatmap');

    if (heatmapData.length === 0) {
      container.innerHTML = '<div class="analytics-empty"><div class="analytics-empty-icon">🗓️</div><h4>No data</h4></div>';
      return;
    }

    let html = '';

    // Header row (day labels)
    html += '<div class="heatmap-label"></div>'; // Empty corner
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
      html += `<div class="heatmap-label">${day}</div>`;
    });

    // Data rows
    heatmapData.forEach((week, weekIndex) => {
      html += `<div class="heatmap-label">Week ${4 - weekIndex}</div>`;

      week.forEach(day => {
        let colorClass = 'empty';
        if (day.capacity > 0) {
          if (day.utilization >= 85) colorClass = 'peak';
          else if (day.utilization >= 70) colorClass = 'high';
          else if (day.utilization >= 40) colorClass = 'medium';
          else colorClass = 'low';
        }

        html += `
          <div class="heatmap-cell ${colorClass}" title="${day.dayName} ${new Date(day.date).toLocaleDateString()}">
            <div class="heatmap-percentage">${day.utilization}%</div>
            <div class="heatmap-seats">${day.bookings}/${day.capacity}</div>
          </div>
        `;
      });
    });

    container.innerHTML = html;
  }

  /**
   * Render all analytics visualizations
   */
  function renderAnalytics() {
    console.log('🎨 Rendering analytics visualizations');

    // Hide loading indicators
    document.getElementById('trendChartLoading').style.display = 'none';
    document.getElementById('locationPerformanceLoading').style.display = 'none';
    document.getElementById('heatmapLoading').style.display = 'none';

    // Calculate all data
    const dailyData = calculateDailyUtilization();
    const locationPerf = calculateLocationPerformance();
    const heatmapData = calculateWeeklyHeatmap();

    // Render visualizations
    renderUtilizationTrendChart(dailyData);
    renderLocationPerformance(locationPerf);
    renderWeeklyHeatmap(heatmapData);
  }

  /**
   * Switch analytics period (button handler)
   */
  window.switchAnalyticsPeriod = function(period) {
    console.log('🔄 Switching to period:', period);

    currentAnalyticsPeriod = period;

    // Update button states
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.period === period) {
        btn.classList.add('active');
      }
    });

    // Reload analytics data
    loadAnalyticsData(period);
  };

  /**
   * Show analytics section (called after successful login)
   */
  function showAnalytics() {
    console.log('📊 Showing analytics section');

    const analyticsSection = document.getElementById('analyticsSection');
    if (analyticsSection) {
      analyticsSection.style.display = 'block';
      loadAnalyticsData(currentAnalyticsPeriod);
    }
  }

  async function loadRecentSignups() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentSignups = companies.filter(company => {
        const createdAt = company.createdAt?.toDate ? company.createdAt.toDate() : new Date(company.createdAt);
        return createdAt >= sevenDaysAgo;
      });

      recentSignups.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });

      renderRecentSignups(recentSignups);
      
    } catch (error) {
      console.error('Error loading recent signups:', error);
    }
  }

  // NEW: Manually verify a company
    async function manuallyVerifyCompany(companyId, companyName) {
      if (!confirm(`Manually verify and activate trial for "${companyName}"?`)) {
        return;
      }

      try {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        // Get company data first (we need it for the email)
        const companyDoc = await getDoc(doc(db, 'companies', companyId));
        if (!companyDoc.exists()) {
          throw new Error('Company not found');
        }
        const companyData = companyDoc.data();

        await updateDoc(doc(db, 'companies', companyId), {
          emailVerified: true,
          verificationToken: null,
          trialStatus: 'active',
          trialStartDate: serverTimestamp(),
          trialEndDate: trialEndDate,
          isActive: true,
          updatedAt: serverTimestamp()
        });

        // Create trial record
        await setDoc(doc(db, 'trials', companyId), {
          companyId: companyId,
          contactEmail: companyData.adminEmail,
          teamSize: companyData.teamSize || 'unknown',
          isActive: true,
          startDate: serverTimestamp(),
          endDate: trialEndDate,
          manuallyActivated: true,
          activatedBy: 'super_admin',
          createdAt: serverTimestamp()
        });

        // Create subscription record
        await setDoc(doc(db, 'subscriptions', companyId), {
          companyId: companyId,
          planType: 'trial',
          status: 'active',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          currentPeriodStart: serverTimestamp(),
          currentPeriodEnd: trialEndDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // NEW: Send welcome email with credentials
        await sendWelcomeEmail(companyData);

        // Log analytics event
        await addDoc(collection(db, 'analyticsEvents'), {
          companyId: companyId,
          eventType: 'email_verified',
          eventData: {
            companyName: companyData.name,
            adminEmail: companyData.adminEmail,
            trialStarted: true,
            manuallyVerified: true
          },
          createdAt: serverTimestamp()
        });

        alert(`Trial activated successfully for "${companyName}"! Welcome email sent to ${companyData.adminEmail}.`);
        await loadAllData();
      } catch (error) {
        console.error('Error verifying company:', error);
        alert('Failed to verify company. Please try again.');
      }
    }

  // NEW: Extend trial by X days
  async function extendTrial(companyId, companyName, currentEndDate) {
    const days = prompt('Extend trial by how many days?', '7');
    if (!days || isNaN(days)) return;

    const daysNum = parseInt(days);
    if (daysNum < 1 || daysNum > 90) {
      alert('Please enter a number between 1 and 90 days.');
      return;
    }

    try {
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + daysNum);

      await updateDoc(doc(db, 'companies', companyId), {
        trialEndDate: newEndDate,
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'trials', companyId), {
        endDate: newEndDate,
        extended: true,
        extensionDays: daysNum,
        extendedBy: 'super_admin',
        extendedAt: serverTimestamp()
      });

      alert(`Trial extended by ${daysNum} days for "${companyName}"!`);
      await loadAllData();
    } catch (error) {
      console.error('Error extending trial:', error);
      alert('Failed to extend trial. Please try again.');
    }
  }

   // Send welcome email with credentials (same as verify.html)
    async function sendWelcomeEmail(companyData) {
      try {
        await addDoc(collection(db, 'mail'), {
          to: [companyData.adminEmail],
          message: {
            subject: 'Welcome to SeatSnag! Your trial is active',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #667eea;">Welcome to SeatSnag, ${companyData.adminFirstName}!</h1>
                <p>Your email has been verified and your 14-day free trial is now active!</p>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>🔑 Your Admin Credentials</h3>
                  <p><strong>Company:</strong> ${companyData.name}</p>
                  <p><strong>Admin PIN:</strong> ${companyData.secretPin}</p>
                  <p><strong>Admin Portal:</strong> <a href="https://seatsnag-sso-dev.web.app/admin">Access Here</a></p>
                </div>
                
                <h3>🚀 Getting Started</h3>
                <ol>
                  <li>Set up your office locations</li>
                  <li>Share the employee portal with your team</li>
                  <li>Start managing seat bookings!</li>
                </ol>
                
                <p style="margin-top: 30px;">
                  <a href="https://seatsnag-sso-dev.web.app/admin" 
                    style="background: #667eea; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 8px; display: inline-block;">
                    Set Up Your Office →
                  </a>
                </p>
                
                <p style="margin-top: 20px; color: #666;">
                  Need help? Reply to this email or contact our support team.
                </p>
              </div>
            `
          }
        });
        console.log('✅ Welcome email sent successfully');
      } catch (error) {
        console.error('Error sending welcome email:', error);
        // Don't throw - we don't want to block verification if email fails
      }
    }

  // NEW: Resend verification email
  async function resendVerificationEmail(companyId, companyData) {
  if (!confirm(`Resend verification email to ${companyData.adminEmail}?`)) {
    return;
  }

      try {
        const verificationToken = Math.random().toString(36).substring(2, 15) + 
                                Math.random().toString(36).substring(2, 15);

        await updateDoc(doc(db, 'companies', companyId), {
          verificationToken: verificationToken,
          updatedAt: serverTimestamp()
        });

        // Use the SAME hardcoded URL as signup.html
        const verificationUrl = `https://seatsnag-sso-dev.web.app/verify?token=${verificationToken}&company=${companyId}`;

        await addDoc(collection(db, 'mail'), {
          to: [companyData.adminEmail],
          message: {
            subject: 'Verify your SeatSnag account - Activate your trial',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #667eea;">Almost there, ${companyData.adminFirstName}!</h1>
                <p>Thanks for signing up for SeatSnag. To activate your 14-day free trial, please verify your email address.</p>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>Company: ${companyData.name}</h3>
                  <p>Admin: ${companyData.adminFirstName} ${companyData.adminLastName}</p>
                </div>
                
                <a href="${verificationUrl}" 
                  style="background: #667eea; color: white; padding: 16px 32px; 
                          text-decoration: none; border-radius: 8px; display: inline-block;
                          font-weight: 600; margin: 20px 0;">
                  Verify Email & Start Trial →
                </a>
                
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  If the button doesn't work, copy and paste this link:<br>
                  <a href="${verificationUrl}">${verificationUrl}</a>
                </p>
                
                <p style="margin-top: 20px; color: #666; font-size: 14px;">
                  This link will expire in 24 hours. If you didn't sign up for SeatSnag, you can ignore this email.
                </p>
              </div>
            `
          }
        });

        alert(`Verification email resent to ${companyData.adminEmail}!`);
      } catch (error) {
        console.error('Error resending verification email:', error);
        alert('Failed to resend email. Please try again.');
      }
    }

    
  function renderRecentSignups(signups) {
    const list = document.getElementById('recentSignupsList');
    
    if (signups.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">📭</span>
          <h3>No Recent Signups</h3>
          <p>No new companies have signed up in the last 7 days.</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = signups.map(company => {
      const createdAt = company.createdAt?.toDate ? company.createdAt.toDate() : new Date(company.createdAt);
      const timeAgo = getTimeAgo(createdAt);
      const companyLocations = locations.filter(loc => loc.companyId === company.id);
      
      // Determine verification status
      const isVerified = company.emailVerified === true;
      const verificationBadge = isVerified 
        ? '<span class="signup-badge active">✓ Verified</span>'
        : '<span class="signup-badge pending">⏳ Pending Verification</span>';
      
      // Admin actions based on status
      let adminActions = '';
      if (!isVerified) {
        const companyDataStr = JSON.stringify(company).replace(/"/g, '&quot;');
        adminActions = `
          <button class="admin-action-btn verify-btn" onclick="manuallyVerifyCompany('${company.id}', '${company.name}')">
            Verify Manually
          </button>
          <button class="admin-action-btn resend-btn" onclick='resendVerificationEmail("${company.id}", ${companyDataStr})'>
            Resend Email
          </button>
        `;
      } else if (company.trialEndDate) {
        const trialEnd = company.trialEndDate?.toDate ? company.trialEndDate.toDate() : new Date(company.trialEndDate);
        adminActions = `
          <button class="admin-action-btn extend-btn" onclick="extendTrial('${company.id}', '${company.name}', '${trialEnd.toISOString()}')">
            Extend Trial
          </button>
        `;
      }
      
      return `
        <div class="signup-card">
          <div class="signup-header">
            <div class="signup-info">
              <h3>${company.name} (${company.companyCode})</h3>
              <div class="signup-meta">
                <span class="meta-item">
                  <span>👨‍💼</span>
                  ${company.adminFirstName} ${company.adminLastName}
                </span>
                <span class="meta-item">
                  <span>📧</span>
                  ${company.adminEmail}
                </span>
                <span class="meta-item">
                  <span>🔑</span>
                  PIN: ${company.secretPin}
                </span>
                <span class="meta-item">
                  <span>📍</span>
                  ${companyLocations.length} location${companyLocations.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div class="time-ago">
                Signed up ${timeAgo}
              </div>
              <div class="admin-actions">
                ${verificationBadge}
                ${adminActions}
              </div>
            </div>
            <div class="signup-actions">
              <a href="mailto:${company.adminEmail}?subject=Welcome to SeatSnag&body=Hi ${company.adminFirstName},%0A%0AWelcome to SeatSnag!" 
                 class="contact-btn">
                Email Admin
              </a>
              <button class="action-btn delete-btn" onclick="deleteCompany('${company.id}', '${company.name}')" style="font-size: 10px; padding: 6px 8px;">
                Delete
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  }

  async function createCompany(name, code, firstName, lastName, pin, email) {
    try {
      // Extract domain from admin email for Google Workspace SSO
      const emailDomain = email.split('@')[1].toLowerCase();
      console.log('📧 Extracted domain:', emailDomain);

      const companyRef = await addDoc(collection(db, 'companies'), {
        name: name,
        companyCode: code.toUpperCase(),
        adminFirstName: firstName,
        adminLastName: lastName,
        adminEmail: email,
        domain: emailDomain, // For Google Workspace SSO employee matching
        secretPin: pin,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Create trial record
      await setDoc(doc(db, 'trials', companyRef.id), {
        companyId: companyRef.id,
        contactEmail: email,
        teamSize: 'unknown',
        isActive: true,
        startDate: serverTimestamp(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        createdAt: serverTimestamp()
      });

      // Log analytics event
      await addDoc(collection(db, 'analyticsEvents'), {
        companyId: companyRef.id,
        eventType: 'company_created',
        eventData: { 
          companyName: name,
          companyCode: code.toUpperCase(),
          adminName: `${firstName} ${lastName}`,
          source: 'super_admin'
        },
        createdAt: serverTimestamp()
      });

      return companyRef.id;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  }

 async function createLocation(companyId, name, address, accessCode, pin, capacity, monthlyRental) {
  try {
    const locationRef = await addDoc(collection(db, 'locations'), {
      companyId: companyId,
      name: name,
      address: address || '',
      accessCode: accessCode.toUpperCase(), // NEW: Access code
      pin: pin || null, // Legacy PIN (optional, for backward compatibility)
      capacity: parseInt(capacity),
      monthlyRental: parseFloat(monthlyRental) || 0,
      timezone: 'America/Los_Angeles',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Create default location settings
    await setDoc(doc(db, 'locationSettings', locationRef.id), {
      locationId: locationRef.id,
      bookingWindowDays: 30,
      maxBookingsPerUser: 5,
      allowWeekendBookings: false,
      notificationSettings: {
        emailReminders: true,
        slackIntegration: false,
        reminderHours: 24
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Log analytics event
    await addDoc(collection(db, 'analyticsEvents'), {
      companyId: companyId,
      locationId: locationRef.id,
      eventType: 'location_created',
      eventData: {
        locationName: name,
        capacity: parseInt(capacity),
        monthlyRental: parseFloat(monthlyRental) || 0,
        accessCode: accessCode.toUpperCase(),
        hasLegacyPin: !!pin,
        source: userType === 'super_admin' ? 'super_admin' : 'company_admin'
      },
      createdAt: serverTimestamp()
    });

    return locationRef.id;
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
  }
  

  async function deleteCompanyById(companyId) {
    try {
      const companyLocations = locations.filter(l => l.companyId === companyId);
      
      for (const location of companyLocations) {
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('locationId', '==', location.id)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        
        for (const bookingDoc of bookingsSnapshot.docs) {
          await deleteDoc(doc(db, 'bookings', bookingDoc.id));
        }

        try {
          await deleteDoc(doc(db, 'locationSettings', location.id));
        } catch (e) {
          console.log('No settings found for location:', location.id);
        }
        
        await deleteDoc(doc(db, 'locations', location.id));
      }

      try {
        await deleteDoc(doc(db, 'trials', companyId));
        await deleteDoc(doc(db, 'subscriptions', companyId));
      } catch (e) {
        console.log('No trial/subscription found for company:', companyId);
      }

      await deleteDoc(doc(db, 'companies', companyId));

      await addDoc(collection(db, 'analyticsEvents'), {
        companyId: companyId,
        eventType: 'company_deleted',
        eventData: { 
          locationsDeleted: companyLocations.length,
          source: 'super_admin'
        },
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  }

  async function deleteLocationById(locationId) {
    try {
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('locationId', '==', locationId)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      
      for (const bookingDoc of bookingsSnapshot.docs) {
        await deleteDoc(doc(db, 'bookings', bookingDoc.id));
      }

      try {
        await deleteDoc(doc(db, 'locationSettings', locationId));
      } catch (e) {
        console.log('No settings found for location:', locationId);
      }
      
      await deleteDoc(doc(db, 'locations', locationId));

      const location = locations.find(l => l.id === locationId);
      if (location) {
        await addDoc(collection(db, 'analyticsEvents'), {
          companyId: location.companyId,
          locationId: locationId,
          eventType: 'location_deleted',
          eventData: { 
            locationName: location.name,
            source: userType === 'super_admin' ? 'super_admin' : 'company_admin'
          },
          createdAt: serverTimestamp()
        });
      }

    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  }

      /**
     * Edit an existing location
     * @param {string} locationId - The ID of the location to edit
     */
    window.editLocation = async function(locationId) {
      try {
        // Find the location
        const location = locations.find(loc => loc.id === locationId);
        if (!location) {
          showError('Location not found');
          return;
        }
        
        // Check permission - company admins can only edit their locations
        if (userType === 'company_admin' && location.companyId !== currentUser.uid) {
          alert('You can only edit your own locations');
          return;
        }
        
        // Populate form with current values
        document.getElementById('locationName').value = location.name;
        document.getElementById('locationAddress').value = location.address || '';
        document.getElementById('locationAccessCode').value = location.accessCode || '';
        document.getElementById('locationPin').value = location.pin || '';
        document.getElementById('locationCapacity').value = location.capacity || '';
        
        // Change form title
        const formTitle = document.querySelector('#companyAdminSection h2');
        if (formTitle) formTitle.textContent = 'Edit Location';
        
        // Change button to "Update Location"
        const addBtn = document.querySelector('#companyAdminSection .add-btn');
        if (addBtn) {
          addBtn.textContent = 'Update Location';
          addBtn.onclick = () => updateLocation(locationId);
        }
        
        // Scroll to form
        document.getElementById('companyAdminSection').scrollIntoView({ behavior: 'smooth' });
        
      } catch (error) {
        console.error('Error loading location for edit:', error);
        showError('Failed to load location data');
      }
    };

    /**
 * Reset the location form back to "Add Location" mode
 */
    function resetLocationForm() {
      // Clear all form fields
      document.getElementById('locationName').value = '';
      document.getElementById('locationAddress').value = '';
      document.getElementById('locationAccessCode').value = '';
      document.getElementById('locationPin').value = '';
      document.getElementById('locationCapacity').value = '';
      
      // Reset form title
      const formTitle = document.querySelector('#companyAdminSection h2');
      if (formTitle) formTitle.textContent = 'Add New Location';
      
      // Reset button back to "Add Location"
      const addBtn = document.querySelector('#companyAdminSection .add-btn');
      if (addBtn) {
        addBtn.textContent = 'Add Location';
        addBtn.onclick = addLocation;
      }
    }


    /**
 * Update an existing location
 * @param {string} locationId - The ID of the location to update
 */
    window.updateLocation = async function(locationId) {
      try {
        // Get form values
        const name = document.getElementById('locationName').value.trim();
        const address = document.getElementById('locationAddress').value.trim();
        const accessCode = document.getElementById('locationAccessCode').value.trim();
        const pin = document.getElementById('locationPin').value.trim();
        const capacity = parseInt(document.getElementById('locationCapacity').value);
        
        // Validation
        if (!name || !accessCode || !capacity) {
          showError('Please fill in location name, access code, and capacity', 'locationError');
          return;
        }
        
        if (accessCode.length < 6 || accessCode.length > 8) {
          showError('Access code must be 6-8 characters', 'locationError');
          return;
        }
        
        if (capacity < 1 || capacity > 500) {
          showError('Capacity must be between 1 and 500 seats', 'locationError');
          return;
        }
        
        // Check if access code changed and is unique
        const existingLocation = locations.find(loc => loc.id === locationId);
        if (existingLocation.accessCode !== accessCode.toUpperCase()) {
          const isUnique = await isAccessCodeUnique(accessCode);
          if (!isUnique) {
            showError('This access code is already in use. Please choose another.', 'locationError');
            return;
          }
        }
        
        // Update location in Firestore
        await updateDoc(doc(db, 'locations', locationId), {
          name: name,
          address: address,
          accessCode: accessCode.toUpperCase(),
          pin: pin || null,
          capacity: capacity,
          updatedAt: serverTimestamp()
        });
        
        // Reset form
        resetLocationForm();
        
        // Reload data
        await loadAllData();
        
        showSuccess(`Location "${name}" updated successfully!`, 'locationSuccess');
        
      } catch (error) {
        console.error('Error updating location:', error);
        showError('Failed to update location', 'locationError');
      }
    };



  // ========================================
  // UI Functions
  // ========================================

  function showSuccess(message, elementId) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
      element.style.display = 'none';
    }, 5000);
  }

  function showError(message, elementId = 'companyError') {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
      element.style.display = 'none';
    }, 8000);
  }

  function updateStats() {
    let totalCompanies, totalLocations, totalSeats, activeBookings;

    if (userType === 'company_admin') {
      totalCompanies = 1;
      totalLocations = locations.length;
      totalSeats = locations.reduce((sum, loc) => sum + (loc.capacity || 0), 0);
      activeBookings = bookings.length;
    } else {
      totalCompanies = companies.length;
      totalLocations = locations.length;
      totalSeats = locations.reduce((sum, loc) => sum + (loc.capacity || 0), 0);
      activeBookings = bookings.length;
    }

    document.getElementById('totalCompanies').textContent = totalCompanies;
    document.getElementById('totalLocations').textContent = totalLocations;
    document.getElementById('totalSeats').textContent = totalSeats;
    document.getElementById('activeBookings').textContent = activeBookings;
  }

  function renderData() {
  // Check if super admin using our new function
  if (currentUser && isSuperAdmin(currentUser.email)) {
    renderCompanies();  // Show companies (with nested locations)
  } else {
    renderLocations();  // Show only locations (for company admin)
  }
  }

     function renderCompanies() {
      const list = document.getElementById('dataList');
      
      if (companies.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">🏢</span>
            <h3>No Companies Yet</h3>
            <p>Add your first company to get started with SeatSnag workspace management.</p>
          </div>
        `;
        return;
      }
      
      list.innerHTML = companies.map(company => {
        const companyLocations = locations.filter(loc => loc.companyId === company.id);
        const totalCapacity = companyLocations.reduce((sum, loc) => sum + (loc.capacity || 0), 0);
        const totalBookings = bookings.filter(booking => 
          companyLocations.some(loc => loc.id === booking.locationId)
        ).length;
        const trial = getTrialStatus(company);
        
        return `
          <div class="company-card" data-name="${company.name.toLowerCase()}">
            <div class="card-header">
              <div class="card-info">
                <h3>${company.name} (${company.companyCode})</h3>
                <div class="card-meta">
                  <span class="meta-item">
                    <span>👨‍💼</span>
                    ${company.adminFirstName} ${company.adminLastName}
                  </span>
                  <span class="meta-item">
                    <span>📧</span>
                    ${company.adminEmail}
                  </span>
                  <span class="meta-item">
                    <span>🔑</span>
                    PIN: ${company.secretPin}
                  </span>
                  <span class="meta-item">
                    <span>📍</span>
                    ${companyLocations.length} location${companyLocations.length !== 1 ? 's' : ''}
                  </span>
                  <span class="meta-item">
                    <span>💺</span>
                    ${totalCapacity} total seats
                  </span>
                  <span class="meta-item">
                    <span>📊</span>
                    ${totalBookings} bookings today
                  </span>
                </div>
                <div class="trial-status ${trial.class}">
                  🕒 ${trial.text}
                </div>
              </div>
              <div class="card-actions">
                <button class="action-btn delete-btn" onclick="deleteCompany('${company.id}', '${company.name}')">
                  Delete
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
    function renderLocations() {
      const list = document.getElementById('dataList');
      
      if (locations.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-icon">📍</span>
            <h3>No Locations Yet</h3>
            <p>Add your first office location to start managing seat bookings.</p>
          </div>
        `;
        return;
      }
      
      list.innerHTML = locations.map(location => {
        const locationBookings = bookings.filter(b => b.locationId === location.id);
        const utilizationRate = location.capacity > 0 ? Math.round((locationBookings.length / location.capacity) * 100) : 0;
        
        return `
          <div class="location-card" data-name="${location.name.toLowerCase()}">
            <div class="card-header">
              <div class="card-info">
                <h3>${location.name}</h3>
                <div class="card-meta">
                  <span class="meta-item">
                    <span>📍</span>
                    ${location.address || 'No address set'}
                  </span>
                  <span class="meta-item" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 8px 16px; border-radius: 8px; font-weight: 700; color: #1e40af; border: 2px solid #3b82f6;">
                    <span>🔑</span>
                    Code: ${location.accessCode || 'N/A'}
                  </span>
                  ${location.pin ? `
                    <span class="meta-item" style="opacity: 0.5; font-size: 0.85em;">
                      <span>🔢</span>
                      Legacy PIN: ${location.pin}
                    </span>
                  ` : ''}
                  <span class="meta-item">
                    <span>💺</span>
                    ${location.capacity} seats/day
                  </span>
                  <span class="meta-item">
                    <span>💰</span>
                    $${(location.monthlyRental || 0).toLocaleString()}/month
                  </span>
                  <span class="meta-item">
                    <span>📊</span>
                    ${locationBookings.length} bookings today
                  </span>
                  <span class="meta-item">
                    <span>📈</span>
                    ${utilizationRate}% utilization
                  </span>
                </div>
              </div>
              <div class="card-actions">
                <button class="action-btn edit-btn" onclick="editLocation('${location.id}')">
                  Edit
                </button>
                <button class="action-btn delete-btn" onclick="deleteLocation('${location.id}', '${location.name}')">
                  Delete
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  function filterResults() {
    const query = document.getElementById('searchFilter').value.toLowerCase();
    const cards = document.querySelectorAll('.company-card, .location-card');
    
    cards.forEach(card => {
      const name = card.dataset.name;
      if (name.includes(query)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // ========================================
  // Global Functions (for onclick handlers)
  // ========================================

  window.addCompany = async function() {
    const name = document.getElementById('companyName').value.trim();
    const code = document.getElementById('companyCode').value.trim();
    const firstName = document.getElementById('adminFirstName').value.trim();
    const lastName = document.getElementById('adminLastName').value.trim();
    const pin = document.getElementById('secretPin').value.trim();
    const email = document.getElementById('adminEmail').value.trim();

    if (!name || !code || !firstName || !lastName || !pin || !email) {
      showError('Please fill in all company fields', 'companyError');
      return;
    }

    if (code.length < 2 || code.length > 10) {
      showError('Company code must be 2-10 characters', 'companyError');
      return;
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      showError('Secret PIN must be exactly 4 digits', 'companyError');
      return;
    }

    if (!email.includes('@')) {
      showError('Please enter a valid email address', 'companyError');
      return;
    }

    if (companies.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      showError('A company with this name already exists', 'companyError');
      return;
    }

    if (companies.some(c => c.companyCode === code.toUpperCase())) {
      showError('A company with this code already exists', 'companyError');
      return;
    }

    if (companies.some(c => c.secretPin === pin)) {
      showError('This PIN is already in use by another company', 'companyError');
      return;
    }

    try {
      const companyId = await createCompany(name, code, firstName, lastName, pin, email);
      
      document.getElementById('companyName').value = '';
      document.getElementById('companyCode').value = '';
      document.getElementById('adminFirstName').value = '';
      document.getElementById('adminLastName').value = '';
      document.getElementById('secretPin').value = '';
      document.getElementById('adminEmail').value = '';
      
      await loadAllData();
      showSuccess(`Company "${name}" created successfully! Send credentials to ${firstName}.`, 'companySuccess');
      
    } catch (error) {
      console.error('Error adding company:', error);
      showError('Failed to create company. Please try again.', 'companyError');
    }
  };

  window.addLocation = async function() {
  const name = document.getElementById('locationName').value.trim();
  const address = document.getElementById('locationAddress').value.trim();
  const accessCode = document.getElementById('locationAccessCode').value.trim();
  const pin = document.getElementById('locationPin').value.trim();
  const capacity = document.getElementById('locationCapacity').value.trim();
  const monthlyRental = parseFloat(document.getElementById('locationMonthlyRental').value) || 0;

  // Validation: Required fields
  if (!name || !accessCode || !capacity) {
    showError('Please fill in location name, access code, and capacity', 'locationError');
    return;
  }

  // Validation: Access code length
  if (accessCode.length < 6 || accessCode.length > 8) {
    showError('Access code must be 6-8 characters', 'locationError');
    return;
  }

  // Validation: Access code format (alphanumeric only)
  if (!/^[A-Z0-9-]+$/i.test(accessCode)) {
    showError('Access code can only contain letters, numbers, and hyphens', 'locationError');
    return;
  }

  // Check if access code is unique
  console.log('🔍 Checking if access code is unique:', accessCode);
  const isUnique = await isAccessCodeUnique(accessCode);
  if (!isUnique) {
    showError('This access code is already in use. Please click "Generate" for a new one.', 'locationError');
    return;
  }

  // Validation: Optional PIN (if provided)
  if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
    showError('If provided, Employee PIN must be exactly 4 digits', 'locationError');
    return;
  }

  // Validation: Capacity range
  const capacityNum = parseInt(capacity);
  if (capacityNum < 1 || capacityNum > 500) {
    showError('Capacity must be between 1 and 500 seats', 'locationError');
    return;
  }

  // Check if PIN conflicts with existing locations (if provided)
  if (pin) {
    const existingLocation = locations.find(l => 
      l.companyId === currentUser.id && l.pin === pin
    );
    if (existingLocation) {
      showError('You already have a location with this PIN. Please use a different PIN or leave blank.', 'locationError');
      return;
    }
  }

  try {
    console.log('✅ Creating location with access code:', accessCode.toUpperCase());
    
    const locationId = await createLocation(
      currentUser.id,
      name,
      address,
      accessCode,
      pin,
      capacityNum,
      monthlyRental
    );
    
    // Clear form
    document.getElementById('locationName').value = '';
    document.getElementById('locationAddress').value = '';
    document.getElementById('locationAccessCode').value = '';
    document.getElementById('locationPin').value = '';
    document.getElementById('locationCapacity').value = '';
    document.getElementById('locationMonthlyRental').value = '';
    
    await loadAllData();
    
    // Show success with access code
    showSuccess(
      `Location "${name}" created successfully! 🎉\n\nAccess Code: ${accessCode.toUpperCase()}\n\nShare this code with your employees!`, 
      'locationSuccess'
    );
    
    // Auto-generate new code for next location
    setTimeout(() => {
      generateAndDisplayCode();
    }, 2000);
    
  } catch (error) {
    console.error('Error adding location:', error);
    showError('Failed to create location. Please try again.', 'locationError');
  }
};

  window.deleteCompany = async function(companyId, companyName) {
    if (userType !== 'super_admin') {
      alert('Only super admins can delete companies');
      return;
    }

    const companyLocations = locations.filter(l => l.companyId === companyId);
    const totalBookings = bookings.filter(booking => 
      companyLocations.some(loc => loc.id === booking.locationId)
    ).length;
    
    let confirmMessage = `Are you sure you want to delete "${companyName}"?`;
    if (companyLocations.length > 0) {
      confirmMessage += `\n\nThis will also delete:`;
      confirmMessage += `\n• ${companyLocations.length} location${companyLocations.length !== 1 ? 's' : ''}`;
      if (totalBookings > 0) {
        confirmMessage += `\n• ${totalBookings} active booking${totalBookings !== 1 ? 's' : ''}`;
      }
      confirmMessage += `\n\nThis action cannot be undone.`;
    }
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      await deleteCompanyById(companyId);
      await loadAllData();
      showSuccess(`Company "${companyName}" and all associated data deleted successfully!`, 'companySuccess');
    } catch (error) {
      console.error('Error deleting company:', error);
      showError('Failed to delete company. Please try again.', 'companyError');
    }
  };

  window.deleteLocation = async function(locationId, locationName) {

    const location = locations.find(loc => loc.id === locationId);
  
    // Company admins can only delete their own locations
      if (userType === 'company_admin' && location.companyId !== currentUser.uid) {
        alert('You can only delete your own locations');
        return;
      }
    const locationBookings = bookings.filter(b => b.locationId === locationId);
    
    let confirmMessage = `Are you sure you want to delete location "${locationName}"?`;
    if (locationBookings.length > 0) {
      confirmMessage += `\n\nThis will also delete ${locationBookings.length} active booking${locationBookings.length !== 1 ? 's' : ''}.`;
      confirmMessage += `\n\nThis action cannot be undone.`;
    }
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      await deleteLocationById(locationId);
      await loadAllData();
      showSuccess(`Location "${locationName}" deleted successfully!`, 'locationSuccess');
      
    } catch (error) {
      console.error('Error deleting location:', error);
      showError('Failed to delete location. Please try again.', 'locationError');
    }
  };

  // Make functions global for onclick handlers
  window.manuallyVerifyCompany = manuallyVerifyCompany;
  window.extendTrial = extendTrial;
  window.resendVerificationEmail = resendVerificationEmail;

  // ========================================
  // Initialize Application
  // ========================================

 /**
 * Initialize the admin page
 * Set up event listeners and let Firebase Auth handle login state
 */
 
  /**
 * Toggle password visibility (show/hide password)
 */
window.togglePasswordVisibility = function() {
  const passwordInput = document.getElementById('adminPasswordInput');
  const eyeIcon = document.getElementById('eyeIcon');
  const eyeSlashIcon = document.getElementById('eyeSlashIcon');
  
  if (passwordInput.type === 'password') {
    // Show password
    passwordInput.type = 'text';
    eyeIcon.style.display = 'none';
    eyeSlashIcon.style.display = 'block';
  } else {
    // Hide password
    passwordInput.type = 'password';
    eyeIcon.style.display = 'block';
    eyeSlashIcon.style.display = 'none';
  }
};

// ========================================
// FORGOT PASSWORD FUNCTIONS
// ========================================

/**
 * Show forgot password modal
 */
window.showForgotPasswordModal = function() {
  const modal = document.getElementById('forgotPasswordModal');
  if (modal) {
    modal.style.display = 'flex';
    // Clear previous input and messages
    document.getElementById('resetEmailInput').value = '';
    const resetMessage = document.getElementById('resetMessage');
    resetMessage.style.display = 'none';
    resetMessage.className = '';
  }
};

/**
 * Close forgot password modal
 */
window.closeForgotPasswordModal = function() {
  const modal = document.getElementById('forgotPasswordModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

/**
 * Handle password reset
 */
window.handlePasswordReset = async function() {
  const emailInput = document.getElementById('resetEmailInput');
  const email = emailInput.value.trim();
  const resetMessage = document.getElementById('resetMessage');
  const sendResetBtn = document.getElementById('sendResetBtn');

  // Validate email
  if (!email) {
    resetMessage.textContent = 'Please enter your email address';
    resetMessage.className = 'error';
    resetMessage.style.display = 'block';
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    resetMessage.textContent = 'Please enter a valid email address';
    resetMessage.className = 'error';
    resetMessage.style.display = 'block';
    return;
  }

  try {
    console.log('🔵 Attempting to send password reset email to:', email);

    // Disable button and show loading
    sendResetBtn.disabled = true;
    sendResetBtn.textContent = 'Sending...';

    // Send password reset email
    await sendPasswordResetEmail(auth, email);

    console.log('✅ Password reset email sent successfully to:', email);
    console.log('📧 Check your email inbox (and spam folder)');
    console.log('📧 Email should be from: noreply@' + auth.app.options.authDomain);

    // Show success message
    resetMessage.textContent = '✓ Password reset email sent! Check your inbox.';
    resetMessage.className = 'success';
    resetMessage.style.display = 'block';

    // Clear input
    emailInput.value = '';

    // Close modal after 3 seconds
    setTimeout(() => {
      closeForgotPasswordModal();
      sendResetBtn.disabled = false;
      sendResetBtn.textContent = 'Send Reset Link';
    }, 3000);

  } catch (error) {
    console.error('❌ Password reset error:', error);

    let errorMessage = 'Failed to send reset email. ';

    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email address.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many requests. Please try again later.';
    } else {
      errorMessage += error.message;
    }

    resetMessage.textContent = errorMessage;
    resetMessage.className = 'error';
    resetMessage.style.display = 'block';

    // Re-enable button
    sendResetBtn.disabled = false;
    sendResetBtn.textContent = 'Send Reset Link';
  }
};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 SeatSnag Admin Panel initializing...');

  // Attach login button handler
  const loginButton = document.getElementById('loginBtn');
  if (loginButton) {
    loginButton.addEventListener('click', handleSecureLogin);
    console.log('✅ Login button connected');
  } else {
    console.error("❌ Login button ('loginBtn') not found!");
  }

  // Note: We do NOT load data here
  // onAuthStateChanged will handle loading data after authentication

  console.log('✅ Admin panel ready');
  console.log('🔐 Waiting for authentication...');
});