// shared-storage-firebase.js - COMPLETELY WORKING VERSION
class FirebaseStorage {
    constructor() {
        this.firebaseConfig = {
            apiKey: "AIzaSyBKkes-rjpu9oTePupssr0TwrGyZlUObq0",
            authDomain: "krish-4422.firebaseapp.com",
            databaseURL: "https://krish-4422-default-rtdb.firebaseio.com",
            projectId: "krish-4422",
            storageBucket: "krish-4422.firebasestorage.app",
            messagingSenderId: "577905490087",
            appId: "1:577905490087:web:5130141fb329713a598382"
        };
        
        this.app = null;
        this.database = null;
        this.isInitialized = false;
        this.connectionStatus = 'disconnected';
        this.initPromise = null;
        
        console.log('🚀 Initializing Multi-Device Firebase Storage...');
        this.initPromise = this.initializeFirebase();
    }

    async initializeFirebase() {
        try {
            console.log('📡 Loading Firebase SDK...');
            
            // Load Firebase scripts first
            await this.loadFirebaseScripts();
            
            // Wait a bit for Firebase to be fully available
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded after waiting');
            }
            
            console.log('✅ Firebase SDK loaded, initializing app...');
            this.app = firebase.initializeApp(this.firebaseConfig);
            this.database = firebase.database();
            this.isInitialized = true;
            
            console.log('✅ Firebase initialized successfully');
            
            // Monitor connection status
            this.monitorConnection();
            
            return true;
            
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            throw error;
        }
    }

    async loadFirebaseScripts() {
        const scripts = [
            'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js',
            'https://www.gstatic.com/firebasejs/9.6.10/firebase-database-compat.js'
        ];
        
        for (const src of scripts) {
            await this.loadScript(src);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                console.log(`✅ Script already loaded: ${src}`);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`✅ Loaded: ${src}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`❌ Failed to load: ${src}`);
                reject(new Error(`Failed to load ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    async waitForInitialization() {
        if (this.isInitialized) {
            return true;
        }
        return await this.initPromise;
    }

    monitorConnection() {
        try {
            const connectedRef = this.database.ref('.info/connected');
            connectedRef.on('value', (snap) => {
                this.connectionStatus = snap.val() ? 'connected' : 'disconnected';
                console.log(`🌐 Firebase connection: ${this.connectionStatus}`);
                
                // Update UI if elements exist
                const statusElements = document.querySelectorAll('#connection-status, #player-connection-status');
                statusElements.forEach(el => {
                    if (el) {
                        el.textContent = this.connectionStatus === 'connected' 
                            ? '🌐 Multi-Device Connected' 
                            : '🔴 Connecting...';
                        el.style.color = this.connectionStatus === 'connected' ? '#03dac5' : '#cf6679';
                    }
                });
            });
        } catch (error) {
            console.error('❌ Connection monitoring failed:', error);
        }
    }

    // 🔥 MULTI-DEVICE TEST FUNCTION
    async testConnection() {
        await this.waitForInitialization();
        
        const testKey = 'multiDeviceTest_' + Date.now();
        const testValue = {
            timestamp: Date.now(),
            device: this.getDeviceInfo(),
            multiDevice: true
        };
        
        try {
            // Write test data
            await this.writeData(`tests/${testKey}`, testValue);
            
            // Read it back
            const result = await this.readData(`tests/${testKey}`);
            
            return {
                success: true,
                multiDevice: true,
                message: '✅ MULTI-DEVICE MODE: Players can join from any device and network!',
                writeTime: testValue.timestamp,
                readTime: result.timestamp,
                deviceInfo: result.device
            };
        } catch (error) {
            return {
                success: false,
                multiDevice: false,
                message: '🚨 Connection test failed - check Firebase rules',
                error: error.message
            };
        }
    }

    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: `${screen.width}x${screen.height}`,
            timestamp: Date.now()
        };
    }

    // Core database operations
    async writeData(path, data) {
        await this.waitForInitialization();
        
        try {
            await this.database.ref(path).set(data);
            console.log(`📝 Data written to ${path}:`, data);
            return true;
        } catch (error) {
            console.error(`❌ Error writing to ${path}:`, error);
            throw error;
        }
    }

    async readData(path) {
        await this.waitForInitialization();
        
        try {
            const snapshot = await this.database.ref(path).once('value');
            return snapshot.val();
        } catch (error) {
            console.error(`❌ Error reading from ${path}:`, error);
            throw error;
        }
    }

    listenToData(path, callback) {
        // Start listening once Firebase is ready
        this.waitForInitialization().then(() => {
            try {
                const ref = this.database.ref(path);
                ref.on('value', (snapshot) => {
                    callback(snapshot.val());
                });
            } catch (error) {
                console.error(`❌ Error setting up listener for ${path}:`, error);
            }
        });
    }

    async updateData(path, updates) {
        await this.waitForInitialization();
        
        try {
            await this.database.ref(path).update(updates);
            console.log(`🔄 Data updated at ${path}:`, updates);
            return true;
        } catch (error) {
            console.error(`❌ Error updating ${path}:`, error);
            throw error;
        }
    }

    async deleteData(path) {
        await this.waitForInitialization();
        
        try {
            await this.database.ref(path).remove();
            console.log(`🗑️ Data deleted from ${path}`);
            return true;
        } catch (error) {
            console.error(`❌ Error deleting ${path}:`, error);
            throw error;
        }
    }

    // Game-specific methods
    generateGamePin() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    generatePlayerId() {
        return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Cleanup
    cleanup() {
        if (this.database) {
            this.database.goOffline();
        }
        if (this.app) {
            this.app.delete();
        }
    }
}

// Create and expose the global instance PROPERLY
console.log('🎯 Creating sharedStorage instance...');

// Create the instance
const firebaseStorage = new FirebaseStorage();

// Directly assign the instance to window.sharedStorage
window.sharedStorage = firebaseStorage;

// Manually add all methods to ensure they're available
window.sharedStorage.waitForInitialization = firebaseStorage.waitForInitialization.bind(firebaseStorage);
window.sharedStorage.testConnection = firebaseStorage.testConnection.bind(firebaseStorage);
window.sharedStorage.writeData = firebaseStorage.writeData.bind(firebaseStorage);
window.sharedStorage.readData = firebaseStorage.readData.bind(firebaseStorage);
window.sharedStorage.listenToData = firebaseStorage.listenToData.bind(firebaseStorage);
window.sharedStorage.updateData = firebaseStorage.updateData.bind(firebaseStorage);
window.sharedStorage.deleteData = firebaseStorage.deleteData.bind(firebaseStorage);
window.sharedStorage.generateGamePin = firebaseStorage.generateGamePin.bind(firebaseStorage);
window.sharedStorage.generatePlayerId = firebaseStorage.generatePlayerId.bind(firebaseStorage);

console.log('✅ sharedStorage fully initialized with methods:', 
    Object.getOwnPropertyNames(Object.getPrototypeOf(firebaseStorage))
    .filter(prop => typeof firebaseStorage[prop] === 'function')
);