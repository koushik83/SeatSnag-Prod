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
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// Import Firebase Auth functions for Google SSO
import {
  GoogleAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

  let currentCompany = null;
  let currentLocation = null;
  let bookingsData = {};
  let selectMode = false;
  let selectedDays = new Set();
  let viewMode = 'week';
  let googleUserInfo = null; // Store Google user info

// ========================================
// GOOGLE WORKSPACE SSO
// ========================================

/**
 * Handle Google Sign-In for employees
 */
async function handleGoogleSignIn() {
  try {
    console.log('🔵 Starting Google Sign-In...');

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    // Show Google sign-in popup
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    console.log('✅ Google Sign-In successful');
    console.log('   Email:', user.email);
    console.log('   Name:', user.displayName);

    // Extract domain from email
    const emailDomain = user.email.split('@')[1].toLowerCase();
    console.log('   Domain:', emailDomain);

    // Check if this domain belongs to a company
    const company = await findCompanyByDomain(emailDomain);

    if (!company) {
      throw new Error(`Your email domain (@${emailDomain}) is not registered with SeatSnag. Please contact your admin or use the access code.`);
    }

    console.log('✅ Company found:', company.name);

    // Store Google user info
    googleUserInfo = {
      name: user.displayName,
      email: user.email,
      photoURL: user.photoURL
    };

    // Pre-fill user info
    prefillUserInfo(googleUserInfo);

    // Show success message
    showSuccessMessage(`Welcome ${user.displayName}! You're signed in as ${company.name} employee.`);

    // User still needs to enter access code for location
    focusOnAccessCode();

  } catch (error) {
    console.error('❌ Google Sign-In error:', error);

    if (error.code === 'auth/popup-closed-by-user') {
      // User closed the popup, do nothing
      return;
    }

    if (error.code === 'auth/cancelled-popup-request') {
      // Another popup is already open
      return;
    }

    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
      errorDiv.textContent = error.message || 'Failed to sign in with Google. Please try again.';
      errorDiv.style.display = 'block';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 8000);
    }
  }
}

/**
 * Find company by email domain
 */
async function findCompanyByDomain(domain) {
  try {
    console.log('🔍 Searching for company with domain:', domain);

    const companiesQuery = query(
      collection(db, 'companies'),
      where('domain', '==', domain),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(companiesQuery);

    if (snapshot.empty) {
      console.log('❌ No company found for domain:', domain);
      return null;
    }

    const companyDoc = snapshot.docs[0];
    const companyData = {
      id: companyDoc.id,
      ...companyDoc.data()
    };

    console.log('✅ Found company:', companyData.name);
    return companyData;

  } catch (error) {
    console.error('❌ Error finding company by domain:', error);
    return null;
  }
}

/**
 * Pre-fill user information from Google account
 */
function prefillUserInfo(userData) {
  console.log('📝 Pre-filling user info:', userData.name);

  // Pre-fill name field
  const nameInput = document.getElementById('userName');
  if (nameInput) {
    nameInput.value = userData.name;
    nameInput.style.backgroundColor = '#f0fdf4';
    nameInput.style.borderColor = '#22c55e';
    nameInput.readOnly = true;
  }

  // Store email for later use (when booking)
  sessionStorage.setItem('googleUserEmail', userData.email);
  sessionStorage.setItem('googleUserName', userData.name);
  sessionStorage.setItem('googleUserPhoto', userData.photoURL || '');
}

/**
 * Show success message to user
 */
function showSuccessMessage(message) {
  console.log('✅ Showing success message');

  // Remove any existing success message
  const existingMsg = document.querySelector('.google-signin-success');
  if (existingMsg) {
    existingMsg.remove();
  }

  // Create success message element
  const successDiv = document.createElement('div');
  successDiv.className = 'google-signin-success';
  successDiv.innerHTML = `
    <span class="success-icon">✓</span>
    <span>${message}</span>
  `;

  // Insert at the top of the login section
  const loginSection = document.getElementById('loginSection');
  const formContainer = loginSection.querySelector('div[style*="max-width"]');
  if (formContainer) {
    formContainer.insertBefore(successDiv, formContainer.firstChild);
  }

  // Auto-hide after 10 seconds
  setTimeout(() => {
    successDiv.remove();
  }, 10000);
}

/**
 * Focus on access code input
 */
function focusOnAccessCode() {
  const accessCodeInput = document.getElementById('accessCodeInput');
  if (accessCodeInput) {
    accessCodeInput.focus();
    accessCodeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ========================================
  // Access Code Authentication
  // ========================================

  async function findLocationByAccessCode(accessCode) {
    try {
      console.log('🔍 Searching for access code:', accessCode.toUpperCase());

      const accessCodeQuery = query(
        collection(db, 'locations'),
        where('accessCode', '==', accessCode.toUpperCase()),
        where('isActive', '==', true)
      );

      const accessCodeSnapshot = await getDocs(accessCodeQuery);

      if (!accessCodeSnapshot.empty) {
        // Collect all locations with this access code
        const locations = [];
        for (const doc of accessCodeSnapshot.docs) {
          locations.push({ id: doc.id, ...doc.data() });
        }

        // Get company data (same for all locations)
        const companyDoc = await getDoc(doc(db, 'companies', locations[0].companyId));
        if (!companyDoc.exists()) {
          throw new Error('Company not found');
        }

        const companyData = { id: companyDoc.id, ...companyDoc.data() };

        console.log(`✅ Found ${locations.length} location(s) via access code:`, locations.map(l => l.name).join(', '));

        return {
          locations,
          company: companyData,
          multipleLocations: locations.length > 1
        };
      }
      
      console.log('⚠️ Access code not found, trying legacy PIN...');
      const pinQuery = query(
        collection(db, 'locations'),
        where('pin', '==', accessCode),
        where('isActive', '==', true)
      );

      const pinSnapshot = await getDocs(pinQuery);

      if (!pinSnapshot.empty) {
        // Collect all locations with this PIN (should only be one, but handle multiple)
        const locations = [];
        for (const doc of pinSnapshot.docs) {
          locations.push({ id: doc.id, ...doc.data() });
        }

        const companyDoc = await getDoc(doc(db, 'companies', locations[0].companyId));
        if (!companyDoc.exists()) {
          throw new Error('Company not found');
        }

        const companyData = { id: companyDoc.id, ...companyDoc.data() };

        console.log('✅ Found location via legacy PIN:', locations[0].name);
        return {
          locations,
          company: companyData,
          multipleLocations: locations.length > 1
        };
      }
      
      console.log('❌ No location found for code:', accessCode);
      return null;
      
    } catch (error) {
      console.error('Error finding location:', error);
      throw error;
    }
  }

  window.handleLogin = async function() {
    const accessCode = document.getElementById('accessCodeInput').value.trim().toUpperCase();
    const userName = document.getElementById('userName').value.trim();
    const errorMsg = document.getElementById('errorMessage');
    
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';
    
    if (!accessCode) {
      errorMsg.textContent = '⚠️ Please enter your access code';
      errorMsg.style.display = 'block';
      return;
    }
    
    if (!userName) {
      errorMsg.textContent = '⚠️ Please enter your name';
      errorMsg.style.display = 'block';
      return;
    }
    
    const loginBtn = document.getElementById('loginBtn');
    const originalBtnText = loginBtn.textContent;
    loginBtn.textContent = '🔄 Logging in...';
    loginBtn.disabled = true;
    loginBtn.style.opacity = '0.7';
    loginBtn.style.cursor = 'not-allowed';
    
    try {
      const result = await findLocationByAccessCode(accessCode);
      
      if (!result) {
        errorMsg.textContent = '❌ Invalid access code. Please check and try again.';
        errorMsg.style.display = 'block';
        loginBtn.textContent = originalBtnText;
        loginBtn.disabled = false;
        loginBtn.style.opacity = '1';
        loginBtn.style.cursor = 'pointer';
        return;
      }
      
      const { locations, company, multipleLocations } = result;

      let location;

      // Check if multiple locations found
      if (multipleLocations) {
        // Check if user has a saved location preference
        const savedLocationId = localStorage.getItem('locationId');

        if (savedLocationId) {
          // Try to find the saved location in available locations
          location = locations.find(loc => loc.id === savedLocationId);

          if (location) {
            console.log('✅ Using previously selected location:', location.name);
            // Continue with login using saved location
          } else {
            console.log('✨ Multiple locations found - showing selector');
            loginBtn.textContent = originalBtnText;
            loginBtn.disabled = false;
            loginBtn.style.opacity = '1';
            loginBtn.style.cursor = 'pointer';

            // Show location selector popup
            showLocationSelector(locations, company, accessCode, userName);
            return;
          }
        } else {
          console.log('✨ Multiple locations found - showing selector');
          loginBtn.textContent = originalBtnText;
          loginBtn.disabled = false;
          loginBtn.style.opacity = '1';
          loginBtn.style.cursor = 'pointer';

          // Show location selector popup
          showLocationSelector(locations, company, accessCode, userName);
          return;
        }
      } else {
        // Single location - proceed normally
        location = locations[0];
      }

      if (!location.isActive) {
        errorMsg.textContent = '⚠️ This location is currently inactive. Please contact your admin.';
        errorMsg.style.display = 'block';
        loginBtn.textContent = originalBtnText;
        loginBtn.disabled = false;
        loginBtn.style.opacity = '1';
        loginBtn.style.cursor = 'pointer';
        return;
      }

      currentCompany = company;
      currentLocation = location;

      localStorage.setItem('accessCode', accessCode);
      localStorage.setItem('userName', userName);
      localStorage.setItem('locationId', location.id);
      localStorage.setItem('companyId', company.id);

      await loadBookingsForLocation(location.id);

      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('loggedInSection').style.display = 'block';
      document.getElementById('companyNameDisplay').textContent = `${company.name} - ${location.name}`;
      
      const chip = document.getElementById('profileChip');
      if (chip) {
        chip.style.display = 'block';
        chip.textContent = `👤 ${userName} @ ${location.name}`;
      }
      
      updateSubtitle();
      updateUI(false);
      
      console.log('✅ Login successful!', { company: company.name, location: location.name, user: userName });
      
      await addDoc(collection(db, 'analyticsEvents'), {
        companyId: company.id,
        locationId: location.id,
        eventType: 'employee_login',
        eventData: {
          userName: userName,
          accessCode: accessCode,
          loginMethod: location.accessCode ? 'access_code' : 'legacy_pin'
        },
        createdAt: serverTimestamp()
      });

      // Initialize location switcher if multiple locations
      await initializeLocationSwitcher(accessCode);

    } catch (error) {
      console.error('Login error:', error);
      errorMsg.textContent = '❌ An error occurred. Please try again.';
      errorMsg.style.display = 'block';
      loginBtn.textContent = originalBtnText;
      loginBtn.disabled = false;
      loginBtn.style.opacity = '1';
      loginBtn.style.cursor = 'pointer';
    }
  };

  function showLocationSelector(locations, company, accessCode, userName) {
    console.log('✨ Showing location selector for', locations.length, 'locations');

    // Hide login section
    document.getElementById('loginSection').style.display = 'none';

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'location-selector-overlay';
    overlay.onclick = () => {
      // Close and return to login
      overlay.remove();
      document.getElementById('loginSection').style.display = 'block';
    };

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'location-selector-popup';
    popup.onclick = (e) => e.stopPropagation(); // Prevent closing when clicking inside

    // Header
    const header = document.createElement('div');
    header.className = 'location-selector-header';
    header.innerHTML = `
      <div class="selector-title">
        <span class="sparkle">✨</span>
        <span>Choose Your Location</span>
        <span class="sparkle">✨</span>
      </div>
      <p class="selector-subtitle">${company.name} has multiple locations</p>
    `;

    // Location cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'location-cards-container';

    // Create location cards
    locations.forEach((location, index) => {
      const card = document.createElement('div');
      card.className = 'location-card';
      card.onclick = async () => {
        console.log('📍 Location selected:', location.name);

        // Show loading state
        card.classList.add('loading');
        card.innerHTML = '<div class="card-loading">Loading...</div>';

        try {
          // Set current location and company
          currentCompany = company;
          currentLocation = location;

          // Save credentials and selected location
          localStorage.setItem('accessCode', accessCode);
          localStorage.setItem('userName', userName);
          localStorage.setItem('locationId', location.id);

          // Load bookings
          await loadBookingsForLocation(location.id);

          // Remove overlay
          overlay.remove();

          // Show booking section
          document.getElementById('loggedInSection').style.display = 'block';
          document.getElementById('companyNameDisplay').textContent = `${company.name} - ${location.name}`;

          const chip = document.getElementById('profileChip');
          if (chip) {
            chip.style.display = 'block';
            chip.textContent = `👤 ${userName} @ ${location.name}`;
          }

          document.getElementById('userName').value = userName;
          document.getElementById('accessCodeInput').value = accessCode;

          updateSubtitle();
          updateUI(false);

          console.log('✅ Location selected successfully!');

          // Log analytics event
          await addDoc(collection(db, 'analyticsEvents'), {
            companyId: company.id,
            locationId: location.id,
            eventType: 'employee_login',
            eventData: {
              userName: userName,
              accessCode: accessCode,
              loginMethod: 'access_code',
              multipleLocations: true
            },
            createdAt: serverTimestamp()
          });

          // Initialize location switcher for multi-location company
          await initializeLocationSwitcher(accessCode);

        } catch (error) {
          console.error('Error selecting location:', error);
          card.classList.remove('loading');
          card.innerHTML = '<div class="card-error">❌ Error loading location. Try again.</div>';
        }
      };

      card.innerHTML = `
        <div class="location-card-icon">🏢</div>
        <div class="location-card-content">
          <h3 class="location-card-name">${location.name}</h3>
          <p class="location-card-address">${location.address || 'Office Location'}</p>
          <div class="location-card-capacity">
            <span class="capacity-icon">💺</span>
            <span class="capacity-text">${location.capacity} seats</span>
          </div>
        </div>
        <div class="location-card-arrow">→</div>
      `;

      cardsContainer.appendChild(card);
    });

    // Assemble popup
    popup.appendChild(header);
    popup.appendChild(cardsContainer);
    overlay.appendChild(popup);

    // Add to page
    document.body.appendChild(overlay);

    // Add entrance animation
    setTimeout(() => {
      popup.classList.add('show');
    }, 10);
  }

  async function initializeLocationSwitcher(accessCode) {
    console.log('🔄 Initializing location switcher...');

    try {
      // Fetch all locations for this access code
      const result = await findLocationByAccessCode(accessCode);

      if (!result || !result.multipleLocations) {
        // Hide switcher for single location or no locations
        document.getElementById('locationSwitcherBar').style.display = 'none';
        return;
      }

      const { locations } = result;

      // Show the switcher bar
      const switcherBar = document.getElementById('locationSwitcherBar');
      switcherBar.style.display = 'block';

      // Populate dropdown
      const dropdown = document.getElementById('locationDropdown');
      dropdown.innerHTML = ''; // Clear existing options

      locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location.id;
        option.textContent = `${location.name} - ${location.address || 'Office'}`;

        // Mark current location as selected
        if (currentLocation && currentLocation.id === location.id) {
          option.selected = true;
        }

        dropdown.appendChild(option);
      });

      // Add change event listener
      dropdown.onchange = async (e) => {
        await handleLocationSwitch(e.target.value, locations);
      };

      console.log('✅ Location switcher initialized with', locations.length, 'locations');

    } catch (error) {
      console.error('Error initializing location switcher:', error);
      document.getElementById('locationSwitcherBar').style.display = 'none';
    }
  }

  async function handleLocationSwitch(newLocationId, availableLocations) {
    console.log('🔄 Switching to location:', newLocationId);

    // Find the selected location
    const newLocation = availableLocations.find(loc => loc.id === newLocationId);

    if (!newLocation) {
      console.error('❌ Location not found:', newLocationId);
      return;
    }

    if (!newLocation.isActive) {
      alert('⚠️ This location is currently inactive.');
      // Reset dropdown to current location
      document.getElementById('locationDropdown').value = currentLocation.id;
      return;
    }

    try {
      // Show loading state
      const dropdown = document.getElementById('locationDropdown');
      dropdown.disabled = true;
      dropdown.style.opacity = '0.6';
      dropdown.style.cursor = 'wait';

      // Update current location
      currentLocation = newLocation;

      // Save to localStorage
      localStorage.setItem('locationId', newLocation.id);

      // Reload bookings for new location
      await loadBookingsForLocation(newLocation.id);

      // Update UI
      document.getElementById('companyNameDisplay').textContent = `${currentCompany.name} - ${newLocation.name}`;

      const chip = document.getElementById('profileChip');
      if (chip) {
        const userName = localStorage.getItem('userName');
        chip.textContent = `👤 ${userName} @ ${newLocation.name}`;
      }

      updateSubtitle();
      updateUI(false);

      // Re-enable dropdown
      dropdown.disabled = false;
      dropdown.style.opacity = '1';
      dropdown.style.cursor = 'pointer';

      console.log('✅ Location switched successfully to:', newLocation.name);

      // Log analytics event
      await addDoc(collection(db, 'analyticsEvents'), {
        companyId: currentCompany.id,
        locationId: newLocation.id,
        eventType: 'location_switch',
        eventData: {
          userName: localStorage.getItem('userName'),
          fromLocationId: currentLocation.id,
          toLocationId: newLocation.id
        },
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error('Error switching location:', error);
      alert('❌ Failed to switch location. Please try again.');

      // Reset dropdown to current location
      document.getElementById('locationDropdown').value = currentLocation.id;
      dropdown.disabled = false;
      dropdown.style.opacity = '1';
      dropdown.style.cursor = 'pointer';
    }
  }

  async function attemptAutoLogin() {
    const accessCode = localStorage.getItem('accessCode');
    const userName = localStorage.getItem('userName');
    
    if (!accessCode || !userName) {
      console.log('ℹ️ No saved credentials found');
      return;
    }
    
    console.log('🔄 Attempting auto-login...');
    
    try {
      const result = await findLocationByAccessCode(accessCode);
      
      if (!result) {
        console.log('⚠️ Saved access code is no longer valid');
        localStorage.clear();
        return;
      }
      
      const { locations, company, multipleLocations } = result;

      let location;

      if (multipleLocations) {
        // Check if user has a saved location preference
        const savedLocationId = localStorage.getItem('locationId');

        if (savedLocationId) {
          // Try to find the saved location in available locations
          location = locations.find(loc => loc.id === savedLocationId);

          if (location) {
            console.log('✅ Using saved location:', location.name);
          } else {
            console.log('⚠️ Saved location not found - showing selector');
            showLocationSelector(locations, company, accessCode, userName);
            return;
          }
        } else {
          console.log('✨ Multiple locations found - showing selector for auto-login');
          showLocationSelector(locations, company, accessCode, userName);
          return;
        }
      } else {
        // Single location - proceed normally
        location = locations[0];
      }

      if (!location.isActive) {
        console.log('⚠️ Location is inactive');
        localStorage.clear();
        return;
      }

      currentCompany = company;
      currentLocation = location;
      
      await loadBookingsForLocation(location.id);
      
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('loggedInSection').style.display = 'block';
      document.getElementById('companyNameDisplay').textContent = `${company.name} - ${location.name}`;
      
      const chip = document.getElementById('profileChip');
      if (chip) {
        chip.style.display = 'block';
        chip.textContent = `👤 ${userName} @ ${location.name}`;
      }
      
      document.getElementById('userName').value = userName;
      document.getElementById('accessCodeInput').value = accessCode;
      
      updateSubtitle();
      updateUI(false);
      
      console.log('✅ Auto-login successful!');

      // Initialize location switcher if multiple locations
      await initializeLocationSwitcher(accessCode);

    } catch (error) {
      console.error('Auto-login error:', error);
      localStorage.clear();
    }
  }

  // ========================================
  // Firestore Functions
  // ========================================

  async function loadBookingsForLocation(locationId) {
    try {
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('locationId', '==', locationId),
        where('status', '==', 'active')
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      
      bookingsData = {};
      bookingsSnapshot.docs.forEach(doc => {
        const booking = doc.data();
        const date = booking.bookingDate;
        if (!bookingsData[date]) {
          bookingsData[date] = [];
        }
        bookingsData[date].push({
          id: doc.id,
          userName: booking.userName,
          userId: booking.userId
        });
      });
      
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }

  async function createBooking(locationId, userName, bookingDate) {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('companyId', '==', currentCompany.id),
        where('name', '==', userName)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      let userId;
      if (usersSnapshot.empty) {
        const userRef = await addDoc(collection(db, 'users'), {
          companyId: currentCompany.id,
          name: userName,
          email: null,
          defaultLocationId: locationId,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        userId = userRef.id;
      } else {
        userId = usersSnapshot.docs[0].id;
      }

      const bookingRef = await addDoc(collection(db, 'bookings'), {
        locationId: locationId,
        userId: userId,
        userName: userName,
        locationName: currentLocation.name,
        bookingDate: bookingDate,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'analyticsEvents'), {
        companyId: currentCompany.id,
        locationId: locationId,
        userId: userId,
        eventType: 'booking_created',
        eventData: { bookingDate },
        createdAt: serverTimestamp()
      });

      return bookingRef.id;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async function removeBookingFromFirestore(date, userName) {
    try {
      if (!bookingsData[date]) return;
      
      const booking = bookingsData[date].find(b => b.userName === userName);
      if (booking) {
        await deleteDoc(doc(db, 'bookings', booking.id));
        
        await addDoc(collection(db, 'analyticsEvents'), {
          companyId: currentCompany.id,
          locationId: currentLocation.id,
          userId: booking.userId,
          eventType: 'booking_cancelled',
          eventData: { bookingDate: date },
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error removing booking:', error);
      throw error;
    }
  }

  // ========================================
  // UI Functions
  // ========================================

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    renderSkeleton();
    await attemptAutoLogin();

    // Attach Google Sign-In button event listener
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    if (googleSignInBtn) {
      googleSignInBtn.addEventListener('click', handleGoogleSignIn);
      console.log('✅ Google Sign-In button attached');
    }
  }

  function updateSubtitle() {
    const sub = document.getElementById('subtitle');
    if (currentLocation) {
      const cap = currentLocation.capacity || 10;
      const viewText = viewMode === 'week' ? 'next 8 working days' : 'next month';
      sub.textContent = `${cap} seats available per day at ${currentLocation.name} - Showing ${viewText}`;
    } else {
      sub.textContent = 'Enter your access code to start booking seats.';
    }
  }

  function setViewMode(mode) {
    viewMode = mode;
    
    document.getElementById('weekBtn').classList.toggle('active', mode === 'week');
    document.getElementById('monthBtn').classList.toggle('active', mode === 'month');
    
    updateSubtitle();
    if (currentLocation) {
      updateUI(selectMode);
    } else {
      renderSkeleton();
    }
  }

  function renderSkeleton() {
    const container = document.getElementById('weekContainer');
    container.innerHTML = '';
    const today = new Date();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const maxDays = viewMode === 'week' ? 10 : 35;
    
    let workingDaysShown = 0;
    const targetWorkingDays = viewMode === 'week' ? 8 : 22;
    
    for (let i = 0; i < maxDays && workingDaysShown < targetWorkingDays; i++) {
      const d = new Date(today); 
      d.setDate(today.getDate() + i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      
      workingDaysShown++;
      const div = document.createElement('div');
      div.className = 'day-card';
      div.innerHTML = `
        <div class="day-header">${d.toDateString() === today.toDateString() ? 'Today' : dayNames[d.getDay()]}</div>
        <div class="date">${monthNames[d.getMonth()]} ${d.getDate()}</div>
        <div class="seat-counter">
          <span class="seat-icon">ℹ️</span>
          <span class="seat-status">Login to view bookings</span>
        </div>`;
      container.appendChild(div);
    }
  }

  async function toggleSelectMode() {
    const isLoggedIn = document.getElementById('loggedInSection').style.display !== 'none';
    if (!isLoggedIn) return;

    const btn = document.getElementById('actionBtnLoggedIn');
    const modeIndicator = document.getElementById('modeIndicator');

    if (!selectMode) {
      selectMode = true; 
      selectedDays.clear();
      btn.textContent = 'Done Selecting'; 
      btn.className = 'done-mode';
      modeIndicator.className = 'mode-indicator active'; 
      updateUI(true);
    } else {
      selectMode = false; 
      btn.textContent = 'Saving...'; 
      btn.disabled = true;
      
      try {
        await saveSelections();
        btn.textContent = 'Select Days'; 
        btn.className = ''; 
        btn.disabled = false;
        modeIndicator.className = 'mode-indicator'; 
        selectedDays.clear();
        await loadBookingsForLocation(currentLocation.id);
        updateUI(false);
      } catch (error) {
        alert('Error saving bookings. Please try again.');
        btn.disabled = false;
      }
    }
  }

  async function saveSelections() {
    const user = localStorage.getItem('userName');
    
    try {
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (bookingsData[dateStr]) {
          const userBooking = bookingsData[dateStr].find(b => b.userName === user);
          if (userBooking) {
            await removeBookingFromFirestore(dateStr, user);
          }
        }
      }
      
      for (const dateStr of selectedDays) {
        if (!bookingsData[dateStr]) {
          bookingsData[dateStr] = [];
        }
        
        if (bookingsData[dateStr].length < currentLocation.capacity) {
          await createBooking(currentLocation.id, user, dateStr);
        }
      }
      
      document.getElementById('syncStatus').textContent = '🟢 Firebase Live';
    } catch (error) {
      console.error('Save error', error);
      document.getElementById('syncStatus').textContent = '❌ Save Error';
      throw error;
    }
  }

  function toggleDaySelection(dateStr, card) {
    if (!selectMode) return;
    
    const cap = currentLocation?.capacity || 10;
    const user = localStorage.getItem('userName');
    
    if (selectedDays.has(dateStr)) { 
      selectedDays.delete(dateStr); 
      card.classList.remove('selected'); 
    } else {
      if (bookingsData[dateStr] && bookingsData[dateStr].length >= cap && 
          !bookingsData[dateStr].some(b => b.userName === user)) {
        alert(`This day is already full! (${cap}/${cap})`); 
        return;
      }
      selectedDays.add(dateStr); 
      card.classList.add('selected');
    }
  }

  async function removeBooking(date, name) {
    const isLoggedIn = document.getElementById('loggedInSection').style.display !== 'none';
    
    if (!isLoggedIn) {
      alert('Please login to remove bookings.'); 
      return;
    }

        // 🔒 SECURITY CHECK - ADD THESE 5 LINES
      const currentUser = localStorage.getItem('userName');
      if (name !== currentUser) {
        alert('You can only remove your own bookings!');
        return;
      }
    
    try {
      await removeBookingFromFirestore(date, name);
      await loadBookingsForLocation(currentLocation.id);
      updateUI(selectMode);
    } catch (error) {
      alert('Error removing booking. Please try again.');
    }
  }

  function updateUI(makeSelectable = false) {
    const container = document.getElementById('weekContainer');
    container.innerHTML = '';
    const today = new Date();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const cap = currentLocation?.capacity || 10;
    const maxDays = viewMode === 'week' ? 10 : 35;
    
    let workingDaysShown = 0;
    const targetWorkingDays = viewMode === 'week' ? 8 : 22;

    for (let i = 0; i < maxDays && workingDaysShown < targetWorkingDays; i++) {
      const d = new Date(today); 
      d.setDate(today.getDate() + i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      
      workingDaysShown++;
      const dateStr = d.toISOString().split('T')[0];
      const bookings = bookingsData[dateStr] || [];

      let statusClass = 'available', statusEmoji = '✅';
      if (bookings.length >= cap) { 
        statusClass = 'full'; 
        statusEmoji = '🚫'; 
      } else if (bookings.length >= Math.ceil(cap * 0.7)) { 
        statusClass = 'warning'; 
        statusEmoji = '⚠️'; 
      }

      const isToday = d.toDateString() === today.toDateString();
      const dayLabel = isToday ? 'Today' : dayNames[d.getDay()];

      const visibleBookings = bookings.slice(0, 4);
      
      const currentUser = localStorage.getItem('userName');
      const attendeesHtml = visibleBookings.map(booking => {
        const canDelete = booking.userName === currentUser;
        return `
          <div class="attendee">
            <span class="attendee-name">${booking.userName}</span>
            ${canDelete ? `<button class="remove-btn" onclick="removeBooking('${dateStr}','${booking.userName}')">×</button>` : ''}
          </div>`;
      }).join('');

      const div = document.createElement('div');
      div.className = 'day-card'; 
      if (makeSelectable) div.classList.add('selectable'); 
      if (bookings.length > 0) div.classList.add('has-attendees');
      div.dataset.date = dateStr;
      div.innerHTML = `
        <div class="selection-indicator">✓</div>
        <div class="day-header">${dayLabel}</div>
        <div class="date">${monthNames[d.getMonth()]} ${d.getDate()}</div>
        <div class="seat-counter">
          <span class="seat-icon">${statusEmoji}</span>
          <span class="seat-status ${statusClass}">${bookings.length}/${cap} seats</span>
        </div>
        <div class="attendees-list">
          ${attendeesHtml}
        </div>`;

      if (makeSelectable && bookings.some(b => b.userName === localStorage.getItem('userName'))) {
        div.classList.add('selected'); 
        selectedDays.add(dateStr);
      }
      
      div.onclick = (event) => {
        if (event.target.classList.contains('remove-btn')) {
          return;
        }
        
        if (selectMode) {
          toggleDaySelection(dateStr, div);
        } else if (bookings.length > 0) {
          showAllAttendees(dateStr, dayLabel, `${monthNames[d.getMonth()]} ${d.getDate()}`);
        }
      };
      
      container.appendChild(div);
    }
  }

  function showAllAttendees(dateStr, dayLabel, dateDisplay) {
    const bookings = bookingsData[dateStr] || [];
    const modal = document.getElementById('attendeesModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalAttendees = document.getElementById('modalAttendees');
    
    modalTitle.textContent = `${dayLabel} - ${dateDisplay} (${bookings.length} people)`;
    
    const currentUser = localStorage.getItem('userName');
    modalAttendees.innerHTML = bookings.map(booking => {
      const initial = booking.userName.charAt(0).toUpperCase();
      const canDelete = booking.userName === currentUser;
      return `
        <div class="modal-attendee">
          <div class="attendee-info">
            <div class="attendee-avatar">${initial}</div>
            <div class="attendee-details">
              <h4>${booking.userName}</h4>
              <p>Coming to office</p>
            </div>
          </div>
          ${canDelete ? `<button class="modal-remove-btn" onclick="removeBookingFromModal('${dateStr}','${booking.userName}')">Remove</button>` : ''}
        </div>
      `;
    }).join('');
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('attendeesModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  async function removeBookingFromModal(date, name) {
    await removeBooking(date, name);
    const bookings = bookingsData[date] || [];
    if (bookings.length === 0) {
      closeModal();
    } else {
      const modalTitle = document.getElementById('modalTitle').textContent;
      const parts = modalTitle.split(' - ');
      if (parts.length >= 2) {
        const dayLabel = parts[0];
        const datePart = parts[1].split(' (')[0];
        showAllAttendees(date, dayLabel, datePart);
      }
    }
  }

  function clearProfile() {
    localStorage.clear();
    document.getElementById('profileChip').style.display = 'none';
    
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('loggedInSection').style.display = 'none';
    
    selectMode = false; 
    currentCompany = null; 
    currentLocation = null;
    selectedDays.clear();
    document.getElementById('modeIndicator').className = 'mode-indicator';
    document.getElementById('userName').value = ''; 
    document.getElementById('accessCodeInput').value = '';
    updateSubtitle(); 
    renderSkeleton();
  }

  // Global functions for onclick handlers
  window.toggleSelectMode = toggleSelectMode;
  window.removeBooking = removeBooking;
  window.removeBookingFromModal = removeBookingFromModal;
  window.clearProfile = clearProfile;
  window.setViewMode = setViewMode;
  window.showAllAttendees = showAllAttendees;
  window.closeModal = closeModal;
  window.toggleDaySelection = toggleDaySelection;

  // Auto-refresh every 30 seconds
  setInterval(async () => { 
    if (!selectMode && currentLocation) {
      await loadBookingsForLocation(currentLocation.id);
      updateUI(false);
    }
  }, 30000);