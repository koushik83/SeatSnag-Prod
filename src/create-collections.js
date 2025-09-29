import { db } from './firebase-config.js';
import { collection, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';

async function createCollections() {
  try {
    console.log('🔄 Creating SeatSnag database collections...');
    
    // 1. Create Companies Collection
    const companyRef = await addDoc(collection(db, 'companies'), {
      name: 'Tech Corp',
      companyCode: 'TECH',
      headquartersAddress: '123 Main St, San Francisco, CA',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('✅ Companies collection created:', companyRef.id);
    
    // 2. Create Locations Collection
    const locationRef = await addDoc(collection(db, 'locations'), {
      companyId: companyRef.id,
      name: 'HQ San Francisco',
      address: '123 Main St, San Francisco, CA 94105',
      pin: '1234',
      capacity: 50,
      timezone: 'America/Los_Angeles',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('✅ Locations collection created:', locationRef.id);
    
    // 3. Create Users Collection
    const userRef = await addDoc(collection(db, 'users'), {
      companyId: companyRef.id,
      name: 'John Doe',
      email: 'john@techcorp.com',
      defaultLocationId: locationRef.id,
      isActive: true,
      lastLogin: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('✅ Users collection created:', userRef.id);
    
    console.log('🎉 Basic collections created!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createCollections();
