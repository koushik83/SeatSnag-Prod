// This script is your "reset button" for the development database.
// It clears out old data and builds a clean, predictable schema
// for testing SSO, teams, and gamification features.

// Import necessary Firebase SDK functions for Node.js environment
// NOTE: Make sure you have run "npm install firebase"
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, Timestamp } from "firebase/firestore";

// --- CONFIGURATION ---
// IMPORTANT: This uses your DEVELOPMENT Firebase project credentials.
const firebaseConfig = {
  apiKey: "AIzaSyD0aKw1vkbjN02dpTP3jGRayVqS127IObs",
  authDomain: "seatsnag-sso-dev.firebaseapp.com",
  projectId: "seatsnag-sso-dev",
  storageBucket: "seatsnag-sso-dev.firebasestorage.app",
  messagingSenderId: "138133397720",
  appId: "1:138133397720:web:9fc75b262986e1cf0677ad"
};

// --- INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("🔥 Connected to Firebase project:", firebaseConfig.projectId);

// --- ENHANCED SEED DATA ---
// This is the test data that will be added to your database.
const seedData = {
  company: {
    id: "tech-corp-123",
    data: {
      name: "Tech Corp",
      companyCode: "TECH",
      adminFirstName: "Sarah",
      adminLastName: "Wilson",
      adminEmail: "sarah@techcorp.com",
      secretPin: "1234",
      domain: "techcorp.com",
      ssoEnabled: true,
      ssoProviders: ["google", "microsoft"],
      allowPinFallback: true,
      isActive: true
    }
  },
  teams: [
    {
      id: "eng-team-456",
      data: {
        name: "Engineering",
        description: "Software development team",
        department: "Technology",
        memberCount: 2,
        leaderId: "user-john-doe",
        leaderName: "John Doe",
        leaderEmail: "john.doe@techcorp.com",
        stats: {
          totalBookings: 15,
          currentTeamStreak: 3,
          longestTeamStreak: 7,
          avgOfficePresence: 0.6,
          lastSyncDate: "2025-01-07"
        },
        syncGoals: {
          minMembersForSync: 2,
          targetSyncDays: 3,
          notifyOnSync: true
        },
        isActive: true
      }
    },
    {
      id: "sales-team-789",
      data: {
        name: "Sales",
        description: "Revenue generation team",
        department: "Business",
        memberCount: 1,
        leaderId: "user-bob-jones",
        leaderName: "Bob Jones",
        leaderEmail: null,
        stats: {
          totalBookings: 25,
          currentTeamStreak: 5,
          longestTeamStreak: 10,
          avgOfficePresence: 0.8,
          lastSyncDate: "2025-01-06"
        },
        syncGoals: {
          minMembersForSync: 1,
          targetSyncDays: 4,
          notifyOnSync: true
        },
        isActive: true
      }
    },
    {
      id: "design-team-101",
      data: {
        name: "Design",
        description: "Product design and UX team",
        department: "Product",
        memberCount: 1,
        leaderId: null,
        leaderName: null,
        leaderEmail: null,
        stats: {
          totalBookings: 8,
          currentTeamStreak: 1,
          longestTeamStreak: 3,
          avgOfficePresence: 0.4,
          lastSyncDate: "2025-01-05"
        },
        syncGoals: {
          minMembersForSync: 1,
          targetSyncDays: 2,
          notifyOnSync: false
        },
        isActive: true
      }
    }
  ],
  users: [
    {
      id: "user-john-doe",
      data: {
        uid: "google:111111111111111111111", // Example SSO UID
        email: "john.doe@techcorp.com",
        name: "John Doe",
        firstName: "John",
        lastName: "Doe",
        profilePicture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
        teamId: "eng-team-456", // Belongs to Engineering
        teamName: "Engineering",
        role: "Software Engineer",
        defaultLocationId: "loc-hq-sf",
        authMethod: "google",
        stats: {
          totalBookings: 10,
          currentStreak: 2,
          longestStreak: 8,
          teamCollaborations: 5,
          lastBookingDate: "2025-01-06"
        },
        preferences: {
          reminderHours: 24,
          notifyOnTeamSync: true,
          autoBookDays: ["tuesday", "thursday"]
        },
        onboardingCompleted: true,
        isActive: true
      }
    },
    {
      id: "user-jane-smith",
      data: {
        uid: "microsoft:22222222222222222", // Example SSO UID
        email: "jane.smith@techcorp.com",
        name: "Jane Smith",
        firstName: "Jane",
        lastName: "Smith",
        profilePicture: "https://graph.microsoft.com/v1.0/me/photo/$value",
        teamId: "eng-team-456", // Belongs to Engineering
        teamName: "Engineering",
        role: "QA Engineer",
        defaultLocationId: "loc-hq-sf",
        authMethod: "microsoft",
        stats: {
          totalBookings: 5,
          currentStreak: 0,
          longestStreak: 4,
          teamCollaborations: 3,
          lastBookingDate: "2025-01-04"
        },
        preferences: {
          reminderHours: 48,
          notifyOnTeamSync: true,
          autoBookDays: ["wednesday"]
        },
        onboardingCompleted: true,
        isActive: true
      }
    },
    {
      id: "user-bob-jones",
      data: {
        uid: null, // PIN-based user
        email: null,
        name: "Bob Jones",
        firstName: "Bob",
        lastName: "Jones",
        profilePicture: null,
        teamId: "sales-team-789", // Belongs to Sales
        teamName: "Sales",
        role: "Account Executive",
        defaultLocationId: "loc-austin",
        authMethod: "pin",
        stats: {
          totalBookings: 20,
          currentStreak: 5,
          longestStreak: 12,
          teamCollaborations: 2,
          lastBookingDate: "2025-01-07"
        },
        preferences: {
          reminderHours: 24,
          notifyOnTeamSync: false,
          autoBookDays: []
        },
        onboardingCompleted: false, // PIN users may not complete full onboarding
        isActive: true
      }
    },
    {
      id: "user-alice-wilson",
      data: {
        uid: "google:333333333333333333333",
        email: "alice.wilson@techcorp.com",
        name: "Alice Wilson",
        firstName: "Alice",
        lastName: "Wilson",
        profilePicture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
        teamId: "design-team-101", // Belongs to Design
        teamName: "Design",
        role: "UX Designer",
        defaultLocationId: "loc-hq-sf",
        authMethod: "google",
        stats: {
          totalBookings: 8,
          currentStreak: 1,
          longestStreak: 5,
          teamCollaborations: 1,
          lastBookingDate: "2025-01-05"
        },
        preferences: {
          reminderHours: 24,
          notifyOnTeamSync: true,
          autoBookDays: ["monday", "friday"]
        },
        onboardingCompleted: true,
        isActive: true
      }
    }
  ],
  locations: [
    {
      id: "loc-hq-sf",
      data: {
        name: "HQ San Francisco",
        address: "123 Market St, SF, CA",
        pin: "5678",
        capacity: 50,
        timezone: "America/Los_Angeles",
        isActive: true
      }
    },
    {
      id: "loc-austin",
      data: {
        name: "Austin Office",
        address: "456 Congress Ave, Austin, TX",
        pin: "1122",
        capacity: 25,
        timezone: "America/Chicago",
        isActive: true
      }
    }
  ],
  locationSettings: [
    {
      id: "loc-hq-sf", // Same as location ID
      data: {
        locationId: "loc-hq-sf",
        bookingWindowDays: 30,
        maxBookingsPerUser: 5,
        allowWeekendBookings: false,
        notificationSettings: {
          emailReminders: true,
          slackIntegration: false,
          reminderHours: 24
        }
      }
    },
    {
      id: "loc-austin",
      data: {
        locationId: "loc-austin",
        bookingWindowDays: 21,
        maxBookingsPerUser: 3,
        allowWeekendBookings: true,
        notificationSettings: {
          emailReminders: true,
          slackIntegration: false,
          reminderHours: 48
        }
      }
    }
  ],
  ssoConfig: {
    id: "tech-corp-123", // Same as company ID
    data: {
      companyId: "tech-corp-123",
      google: {
        enabled: true,
        clientId: "123456789-test-google-client.apps.googleusercontent.com",
        hostedDomain: "techcorp.com",
        adminEmail: "sarah@techcorp.com",
        configuredAt: Timestamp.now()
      },
      microsoft: {
        enabled: true,
        clientId: "aaaaaaaa-bbbb-cccc-dddd-test-microsoft-id",
        tenantId: "ffffffff-gggg-hhhh-iiii-test-tenant-id",
        adminEmail: "sarah@techcorp.com",
        configuredAt: Timestamp.now()
      },
      pinFallback: {
        enabled: true,
        requireApproval: false,
        notifyAdmin: true
      }
    }
  },
  sampleBookings: [
    {
      id: "booking-john-today",
      data: {
        locationId: "loc-hq-sf",
        userId: "user-john-doe",
        userName: "John Doe",
        userEmail: "john.doe@techcorp.com",
        userProfilePicture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
        teamId: "eng-team-456",
        teamName: "Engineering",
        locationName: "HQ San Francisco",
        bookingDate: "2025-01-08", // Tomorrow
        status: "active",
        isTeamSync: true,
        teammatesPresent: 2,
        teammatesList: [
          {
            userId: "user-jane-smith",
            name: "Jane Smith",
            teamId: "eng-team-456"
          }
        ]
      }
    },
    {
      id: "booking-jane-today",
      data: {
        locationId: "loc-hq-sf",
        userId: "user-jane-smith",
        userName: "Jane Smith",
        userEmail: "jane.smith@techcorp.com",
        userProfilePicture: "https://graph.microsoft.com/v1.0/me/photo/$value",
        teamId: "eng-team-456",
        teamName: "Engineering",
        locationName: "HQ San Francisco",
        bookingDate: "2025-01-08", // Tomorrow
        status: "active",
        isTeamSync: true,
        teammatesPresent: 2,
        teammatesList: [
          {
            userId: "user-john-doe",
            name: "John Doe",
            teamId: "eng-team-456"
          }
        ]
      }
    },
    {
      id: "booking-bob-tomorrow",
      data: {
        locationId: "loc-austin",
        userId: "user-bob-jones",
        userName: "Bob Jones",
        userEmail: null,
        userProfilePicture: null,
        teamId: "sales-team-789",
        teamName: "Sales",
        locationName: "Austin Office",
        bookingDate: "2025-01-09", // Day after tomorrow
        status: "active",
        isTeamSync: false,
        teammatesPresent: 1,
        teammatesList: []
      }
    }
  ],
  analyticsEvents: [
    {
      id: "event-team-sync-1",
      data: {
        companyId: "tech-corp-123",
        locationId: "loc-hq-sf",
        teamId: "eng-team-456",
        userId: "user-john-doe",
        eventType: "team_sync_achieved",
        eventData: {
          bookingDate: "2025-01-08",
          teamMembersPresent: 2,
          totalTeamSize: 2,
          syncPercentage: 1.0,
          isStreakDay: true
        }
      }
    },
    {
      id: "event-user-streak-1",
      data: {
        companyId: "tech-corp-123",
        locationId: "loc-austin",
        teamId: "sales-team-789",
        userId: "user-bob-jones",
        eventType: "user_streak_milestone",
        eventData: {
          streakDays: 5,
          milestone: "5_day_streak",
          bookingDate: "2025-01-07"
        }
      }
    }
  ]
};

// --- HELPER FUNCTIONS ---

// Function to wipe existing data in a collection
async function clearCollection(collectionName) {
  console.log(`🗑️  Wiping collection: ${collectionName}...`);
  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);
  for (const doc of snapshot.docs) {
    await deleteDoc(doc.ref);
  }
  console.log(`✅ Collection ${collectionName} wiped.`);
}

// --- MAIN SEEDING FUNCTION ---
async function runSeed() {
  try {
    console.log("\n🚀 Starting enhanced database seed process...");
    console.log("🛡️  TARGET: Development database only (seatsnag-sso-dev)");

    // 1. Clear existing dev data to ensure a clean slate
    const collectionsToWipe = [
      "companies", 
      "teams", 
      "users", 
      "locations", 
      "locationSettings",
      "ssoConfigs",
      "bookings", 
      "analyticsEvents"
    ];
    
    for (const collectionName of collectionsToWipe) {
      await clearCollection(collectionName);
    }
    console.log("\n----------------------------------------\n");
    
    // 2. Create the Company
    console.log("🏢 Creating company: Tech Corp...");
    const companyRef = doc(db, "companies", seedData.company.id);
    await setDoc(companyRef, { 
      ...seedData.company.data, 
      createdAt: Timestamp.now(), 
      updatedAt: Timestamp.now() 
    });
    const companyId = seedData.company.id;
    console.log("✅ Company created successfully.");

    // 3. Create Teams
    console.log("\n👨‍👩‍👧‍👦 Creating teams...");
    for (const team of seedData.teams) {
      const teamRef = doc(db, "teams", team.id);
      await setDoc(teamRef, { 
        ...team.data, 
        companyId: companyId, 
        createdAt: Timestamp.now(), 
        updatedAt: Timestamp.now() 
      });
      console.log(`   - Team "${team.data.name}" created (${team.data.memberCount} members).`);
    }
    console.log("✅ Teams created successfully.");

    // 4. Create Users with Enhanced Profiles
    console.log("\n🆔 Creating users with enhanced profiles...");
    for (const user of seedData.users) {
      const userRef = doc(db, "users", user.id);
      await setDoc(userRef, { 
        ...user.data, 
        companyId: companyId, 
        createdAt: Timestamp.now(), 
        updatedAt: Timestamp.now() 
      });
      console.log(`   - User "${user.data.name}" (${user.data.authMethod}) -> Team: ${user.data.teamName}`);
    }
    console.log("✅ Users created successfully.");

    // 5. Create Locations
    console.log("\n📍 Creating locations...");
    for (const location of seedData.locations) {
      const locationRef = doc(db, "locations", location.id);
      await setDoc(locationRef, { 
        ...location.data, 
        companyId: companyId, 
        createdAt: Timestamp.now(), 
        updatedAt: Timestamp.now() 
      });
      console.log(`   - Location "${location.data.name}" (${location.data.capacity} seats)`);
    }
    console.log("✅ Locations created successfully.");

    // 6. Create Location Settings
    console.log("\n⚙️ Creating location settings...");
    for (const setting of seedData.locationSettings) {
      const settingRef = doc(db, "locationSettings", setting.id);
      await setDoc(settingRef, { 
        ...setting.data, 
        createdAt: Timestamp.now(), 
        updatedAt: Timestamp.now() 
      });
      console.log(`   - Settings for "${setting.id}" configured`);
    }
    console.log("✅ Location settings created successfully.");

    // 7. Create SSO Configuration
    console.log("\n🔐 Creating SSO configuration...");
    const ssoConfigRef = doc(db, "ssoConfigs", seedData.ssoConfig.id);
    await setDoc(ssoConfigRef, {
      ...seedData.ssoConfig.data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    console.log("   - Google SSO: Enabled");
    console.log("   - Microsoft SSO: Enabled");
    console.log("   - PIN Fallback: Enabled");
    console.log("✅ SSO configuration created.");

    // 8. Create Sample Bookings
    console.log("\n📅 Creating sample bookings...");
    for (const booking of seedData.sampleBookings) {
      const bookingRef = doc(db, "bookings", booking.id);
      await setDoc(bookingRef, {
        ...booking.data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      console.log(`   - Booking: ${booking.data.userName} @ ${booking.data.locationName} (${booking.data.bookingDate})`);
    }
    console.log("✅ Sample bookings created.");

    // 9. Create Analytics Events
    console.log("\n📊 Creating analytics events...");
    for (const event of seedData.analyticsEvents) {
      const eventRef = doc(db, "analyticsEvents", event.id);
      await setDoc(eventRef, {
        ...event.data,
        createdAt: Timestamp.now()
      });
      console.log(`   - Event: ${event.data.eventType}`);
    }
    console.log("✅ Analytics events created.");

    console.log("\n========================================");
    console.log("🎉 ENHANCED DATABASE SEED COMPLETE!");
    console.log("========================================");
    console.log("\n📋 What was created:");
    console.log("   • 1 Company (Tech Corp)");
    console.log("   • 3 Teams (Engineering, Sales, Design)");
    console.log("   • 4 Users (Google SSO, Microsoft SSO, PIN)");
    console.log("   • 2 Locations (SF HQ, Austin)");
    console.log("   • SSO Configuration (Google + Microsoft)");
    console.log("   • 3 Sample Bookings (with team sync data)");
    console.log("   • 2 Analytics Events (gamification ready)");
    console.log("\n🔗 Next Steps:");
    console.log("   1. Visit: https://console.firebase.google.com/project/seatsnag-sso-dev/firestore");
    console.log("   2. Refresh the page to see your enhanced schema");
    console.log("   3. Test SSO features with the sample users");
    console.log("   4. Try team collaboration features");
    console.log("\n🛡️ Production database remains completely untouched!\n");
    
    process.exit(0); // Exit successfully

  } catch (error) {
    console.error("\n❌ An error occurred during the seed process:");
    console.error(error);
    console.error("\n🔍 Make sure you have:");
    console.error("   1. Run 'npm install firebase'");
    console.error("   2. Set your Firebase project to 'seatsnag-sso-dev'");
    console.error("   3. Have proper Firebase permissions");
    process.exit(1); // Exit with an error
  }
}

// Run the main function
runSeed();