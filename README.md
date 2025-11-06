# 🎮 Multi-Device Kahoot-Style Game

A real-time multiplayer quiz game that works across any device and network using Firebase.

## 🌟 Features

- **Multi-Device Ready**: Works on phones, tablets, computers simultaneously
- **Cross-Network**: Players can join from different networks
- **Real-time Sync**: Live updates across all connected devices
- **No Installation**: Pure web app - just share the URL
- **Responsive Design**: Optimized for all screen sizes

## 🚀 Quick Start

1. **Host Setup**:
   - Open `index.html` in a browser
   - Click "Enter as Host"
   - Create a game and add questions
   - Share the Game PIN with players

2. **Player Setup**:
   - Open the shared URL on any device
   - Click "Enter as Player"
   - Enter the Game PIN and your name
   - Start playing!

## 📱 Device Compatibility

| Device Type | Supported | Features |
|-------------|-----------|----------|
| Desktop/Laptop | ✅ | Full admin controls, large display |
| Tablet | ✅ | Touch-friendly, responsive layout |
| Mobile Phone | ✅ | Optimized for small screens |
| Different Networks | ✅ | Cloud-synced via Firebase |

## 🛠️ Technical Setup

### Firebase Configuration
The app uses your existing Firebase project with these settings:
- **Database**: Realtime Database
- **Security**: Configure rules for multi-device access
- **Hosting**: Can be deployed to Firebase Hosting

### File Structure
- `index.html` - Home page with role selection
- `admin.html` - Game host interface
- `player.html` - Player interface
- `styles/main.css` - Responsive styling
- `scripts/admin.js` - Game host logic
- `scripts/player.js` - Player logic
- `scripts/shared-storage-firebase.js` - Firebase integration