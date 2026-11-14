# Quest AI Companion - Workspace Rules

## Meta Quest 3 Wireless ADB Connection
- Whenever the user asks to connect to their **Meta Quest 3** (or mentions "connect Quest 3", "quick three", "connect the headset", etc.), automatically use the connection script:
  `C:\Users\eranr\.gemini\antigravity\scratch\connect_quest_wifi.bat`
  or execute:
  `& "C:\Users\eranr\.gemini\antigravity\scratch\platform-tools\adb.exe" connect 192.168.1.120:5555`
- The headset's Wi-Fi IP is `192.168.1.120:5555`.
