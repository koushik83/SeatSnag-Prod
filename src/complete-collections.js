import { db } from './firebase-config.js';
import { collection, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';

async function createRemainingCollections() {
  try {
    console.log('🔄 Creating remaining 5 collections...');
    
    // Get existing company and location IDs (replace with your actual IDs)
    const companyId = '8MvL9XwSp0Oal7RsRv46';
    const locationId = 'nVMPcdrIz1Iv4z4LnOWL';
    const userId = 'dRjH53tKYyLE5gvHM0iU';
    
    // 4. Create Bookings Collection
    const bookingRef = await addDoc(collection(db, 'bookings'), {
      locationId: locationId,
      userId: userId,
      userName: 'John Doe',
      locationName: 'HQ San Francisco',
      bookingDate: '2025-01-20',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('✅ Bookings collection created:', bookingRef.id);
    
    // 5. Create Trials Collection
    await setDoc(doc(db, 'trials', companyId), {
      companyId: companyId,
      contactEmail: 'admin@techcorp.com',
      teamSize: '26-50',
      isActive: true,
      startDate: serverTimestamp(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdAt: serverTimestamp()
    });
    console.log('✅ Trials collection created');
    
    // 6. Create Subscriptions Collection
    await setDoc(doc(db, 'subscriptions', companyId), {
      companyId: companyId,
      planType: 'professional',
      status: 'active',
      stripeCustomerId: 'cus_placeholder',
      stripeSubscriptionId: 'sub_placeholder',
      currentPeriodStart: serverTimestamp(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('✅ Subscriptions collection created');
    
    // 7. Create Location Settings Collection
    await setDoc(doc(db, 'locationSettings', locationId), {
      locationId: locationId,
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
    console.log('✅ Location Settings collection created');
    
    // 8. Create Analytics Events Collection
    await addDoc(collection(db, 'analyticsEvents'), {
      companyId: companyId,
      locationId: locationId,
      userId: userId,
      eventType: 'booking_created',
      eventData: {
        bookingDate: '2025-01-20',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        ipAddress: '192.168.1.1'
      },
      createdAt: serverTimestamp()
    });
    console.log('✅ Analytics Events collection created');
    
    console.log('🎉 All 8 collections now complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createRemainingCollections();
